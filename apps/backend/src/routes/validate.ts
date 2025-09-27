import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { runDualValidation, type AssignmentContext } from '../services/validation';
import { prisma } from '../lib/prisma';

export const validateRouter = Router();

const requestSchema = z.object({
  content: z.string().min(1),
  brief: z.string().optional(),
  contentId: z.string().optional(), // Optional content ID to check for assignment
});

validateRouter.post('/', requireAuth, async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { content, brief, contentId } = parsed.data;

  // Check if content is linked to an assignment
  let assignmentContext: AssignmentContext | undefined;
  if (contentId) {
    try {
      const contentRecord = await prisma.$queryRaw`
        SELECT "contentType" FROM "Content" WHERE id = ${contentId}
      ` as Array<{ contentType: string }>;

      if (contentRecord.length > 0) {
        const assignment = await prisma.$queryRaw`
          SELECT topic, "prerequisiteTopics", guidelines 
          FROM "ContentAssignment" 
          WHERE "contentId" = ${contentId}
        ` as Array<{
          topic: string;
          prerequisiteTopics: string[];
          guidelines: string | null;
        }>;

        if (assignment.length > 0) {
          const assignmentData = assignment[0];
          if (assignmentData) {
            assignmentContext = {
              topic: assignmentData.topic,
              prerequisiteTopics: assignmentData.prerequisiteTopics,
              guidelines: assignmentData.guidelines || undefined,
              contentType: contentRecord[0]?.contentType as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'
            };
          }
        }
      }
    } catch (error) {
      console.error('Error fetching assignment context:', error);
      // Continue without assignment context if there's an error
    }
  }

  const start = Date.now();
  const { consensus, overall, successes, confidence, overallConfidence } = await runDualValidation(content, brief, assignmentContext);
  const processingTime = Date.now() - start;
  // Let AI handle all issue detection instead of hardcoded rules
  res.json({
    criteria: {
      relevance: { 
        score: consensus.relevance, 
        confidence: confidence.relevance, 
        feedback: successes.length > 0 ? (successes[0]?.feedback?.relevance || '') : '', 
        issues: [] 
      },
      continuity: { 
        score: consensus.continuity, 
        confidence: confidence.continuity, 
        feedback: successes.length > 0 ? (successes[0]?.feedback?.continuity || '') : '', 
        issues: [] 
      },
      documentation: { 
        score: consensus.documentation, 
        confidence: confidence.documentation, 
        feedback: successes.length > 0 ? (successes[0]?.feedback?.documentation || '') : '', 
        issues: [] 
      },
    },
    providers: successes.map(s => s.provider),
    overallScore: overall,
    overallConfidence,
    processingTime,
    assignmentContext: assignmentContext ? {
      topic: assignmentContext.topic,
      prerequisiteTopics: assignmentContext.prerequisiteTopics,
      hasGuidelines: !!assignmentContext.guidelines
    } : null,
  });
});

// Re-validate existing content by ID
validateRouter.post('/:id', requireAuth, async (req, res) => {
  try {
    const contentId = req.params.id;
    const user = req.user!;
    
    if (!contentId) {
      return res.status(400).json({ error: 'Content ID is required' });
    }

    // Fetch the content
    let content;
    if (user.role === 'ADMIN') {
      // Admins can re-validate content assigned to them for review or their own content
      content = await prisma.content.findFirst({
        where: {
          id: contentId,
          OR: [
            { authorId: user.id },
            { 
              author: { assignedAdminId: user.id }
            }
          ]
        },
        include: {
          author: {
            select: { id: true, name: true, email: true }
          }
        }
      });
    } else {
      // Creators can only re-validate their own content
      content = await prisma.content.findFirst({
        where: { 
          id: contentId,
          authorId: user.id 
        },
        include: {
          author: {
            select: { id: true, name: true, email: true }
          }
        }
      });
    }

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Check if content is linked to an assignment
    let assignmentContext: AssignmentContext | undefined;
    try {
      const assignment = await prisma.$queryRaw`
        SELECT topic, "prerequisiteTopics", guidelines 
        FROM "ContentAssignment" 
        WHERE "contentId" = ${contentId}
      ` as Array<{
        topic: string;
        prerequisiteTopics: string[];
        guidelines: string | null;
      }>;

      if (assignment.length > 0) {
        const assignmentData = assignment[0];
        if (assignmentData) {
          assignmentContext = {
            topic: assignmentData.topic,
            prerequisiteTopics: assignmentData.prerequisiteTopics,
            guidelines: assignmentData.guidelines || undefined,
            contentType: (content as any).contentType as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'
          };
        }
      }
    } catch (error) {
      console.error('Error fetching assignment context:', error);
      // Continue without assignment context if there's an error
    }

    const start = Date.now();
    const { consensus, overall, successes, confidence, overallConfidence } = await runDualValidation(content.content, content.brief || undefined, assignmentContext);
    const processingTime = Date.now() - start;

    // Store validation results in database
    const validationResults = [];
    for (const result of successes) {
      const validationResult = await prisma.validationResult.create({
        data: {
          contentId: content.id,
          llmProvider: result.provider === 'openai' ? 'OPENAI' : result.provider === 'gemini' ? 'ANTHROPIC' : 'LOCAL',
          modelVersion: result.provider === 'openai' ? 'gpt-4o-mini' : result.provider === 'gemini' ? 'gemini-1.5-flash' : 'stub',
          criteria: {
            relevance: { score: result.scores.relevance, feedback: result.feedback.relevance, issues: [] },
            continuity: { score: result.scores.continuity, feedback: result.feedback.continuity, issues: [] },
            documentation: { score: result.scores.documentation, feedback: result.feedback.documentation, issues: [] }
          },
          overallScore: Math.round((result.scores.relevance + result.scores.continuity + result.scores.documentation) / 3),
          processingTimeMs: processingTime,
        },
      });
      validationResults.push(validationResult);
    }

    res.json({
      validationResults,
      overallScore: overall,
      confidence: overallConfidence,
      processingTimeMs: processingTime,
      successes,
    });
  } catch (error) {
    console.error('Error re-validating content:', error);
    res.status(500).json({ error: 'Failed to re-validate content' });
  }
});

// Validate content specifically for an assignment
validateRouter.post('/assignment/:assignmentId', requireAuth, async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
    const { content, brief } = parsed.data;

    // Fetch assignment details
    const assignmentQuery = await prisma.$queryRaw`
      SELECT topic, "prerequisiteTopics", guidelines, "assignedToId", "assignedById", "contentType"
      FROM "ContentAssignment" 
      WHERE id = ${assignmentId}
    ` as Array<{
      topic: string;
      prerequisiteTopics: string[];
      guidelines: string | null;
      assignedToId: string;
      assignedById: string;
      contentType: string;
    }>;

    if (assignmentQuery.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = assignmentQuery[0];

    // Check if user has access to this assignment
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    if (userRole === 'CREATOR' && assignment?.assignedToId !== userId) {
      return res.status(403).json({ error: 'Assignment not assigned to you' });
    }
    
    if (userRole === 'ADMIN' && assignment?.assignedById !== userId) {
      return res.status(403).json({ error: 'Assignment not created by you' });
    }

    const assignmentContext: AssignmentContext = {
      topic: assignment?.topic || '',
      prerequisiteTopics: assignment?.prerequisiteTopics || [],
      guidelines: assignment?.guidelines || undefined,
      contentType: assignment?.contentType as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'
    };

    const start = Date.now();
    const { consensus, overall, successes, confidence, overallConfidence } = await runDualValidation(content, brief, assignmentContext);
    const processingTime = Date.now() - start;
    
    // Let AI handle all issue detection instead of hardcoded rules

    res.json({
      criteria: {
        relevance: { 
          score: consensus.relevance, 
          confidence: confidence.relevance, 
          feedback: successes.length > 0 ? (successes[0]?.feedback?.relevance || '') : '', 
          issues: [] 
        },
        continuity: { 
          score: consensus.continuity, 
          confidence: confidence.continuity, 
          feedback: successes.length > 0 ? (successes[0]?.feedback?.continuity || '') : '', 
          issues: [] 
        },
        documentation: { 
          score: consensus.documentation, 
          confidence: confidence.documentation, 
          feedback: successes.length > 0 ? (successes[0]?.feedback?.documentation || '') : '', 
          issues: [] 
        },
      },
      providers: successes.map(s => s.provider),
      overallScore: overall,
      overallConfidence,
      processingTime,
      assignmentContext: {
        topic: assignmentContext.topic,
        prerequisiteTopics: assignmentContext.prerequisiteTopics,
        hasGuidelines: !!assignmentContext.guidelines,
        guidelines: assignmentContext.guidelines
      },
    });
  } catch (error) {
    console.error('Error validating assignment content:', error);
    res.status(500).json({ error: 'Failed to validate assignment content' });
  }
});


