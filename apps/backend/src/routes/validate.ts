import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { runDualLLMValidation, runDualValidation, type AssignmentContext } from '../services/validation';
import { prisma } from '../lib/prisma';

export const validateRouter = Router();

const requestSchema = z.object({
  content: z.string().min(1),
  contentId: z.string().optional(), // Optional content ID to check for assignment
});

validateRouter.post('/', requireAuth, async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { content, contentId } = parsed.data;

  // Check if content is linked to an assignment
  let assignmentContext: AssignmentContext | undefined;
  if (contentId) {
    try {
      const contentRecord = await prisma.$queryRaw`
        SELECT "contentType" FROM "Content" WHERE id = ${contentId}
      ` as Array<{ contentType: string }>;

      if (contentRecord.length > 0) {
        const assignment = await prisma.$queryRaw`
          SELECT topic, "topicsTaughtSoFar", guidelines 
          FROM "ContentAssignment" 
          WHERE "contentId" = ${contentId}
        ` as Array<{
          topic: string;
          topicsTaughtSoFar: string[];
          guidelines: string | null;
        }>;

        if (assignment.length > 0) {
          const assignmentData = assignment[0];
          if (assignmentData) {
        assignmentContext = {
          topic: assignmentData.topic,
          topicsTaughtSoFar: assignmentData.topicsTaughtSoFar,
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
  
  // Use new dual LLM validation system for enhanced accuracy
  try {
    const dualResult = await runDualLLMValidation(content, assignmentContext);
    
    res.json({
      criteria: {
        relevance: { 
          score: dualResult.finalScore.relevance, 
          confidence: 0.95, // High confidence from dual validation
          feedback: dualResult.finalFeedback.relevance, 
          issues: [] 
        },
        continuity: { 
          score: dualResult.finalScore.continuity, 
          confidence: 0.95,
          feedback: dualResult.finalFeedback.continuity, 
          issues: [] 
        },
        documentation: { 
          score: dualResult.finalScore.documentation, 
          confidence: 0.95,
          feedback: dualResult.finalFeedback.documentation, 
          issues: [] 
        },
      },
      overall: Math.round((dualResult.finalScore.relevance + dualResult.finalScore.continuity + dualResult.finalScore.documentation) / 3),
      processingTime: dualResult.processingTime,
      confidence: 0.95,
      // Include detailed dual validation results for debugging
      dualValidationDetails: {
        round1: dualResult.round1Results,
        round2: dualResult.round2Results
      }
    });
    return;
  } catch (error) {
    console.error('Dual LLM validation failed, falling back to legacy system:', error);
    // Fall back to legacy dual validation system
  }
  
  const { consensus, overall, successes, confidence, overallConfidence } = await runDualValidation(content, assignmentContext);
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
      topicsTaughtSoFar: assignmentContext.topicsTaughtSoFar,
      hasGuidelines: false
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
        SELECT topic, "topicsTaughtSoFar", guidelines 
        FROM "ContentAssignment" 
        WHERE "contentId" = ${contentId}
      ` as Array<{
        topic: string;
        topicsTaughtSoFar: string[];
        guidelines: string | null;
      }>;

      if (assignment.length > 0) {
        const assignmentData = assignment[0];
        if (assignmentData) {
          assignmentContext = {
            topic: assignmentData.topic,
            topicsTaughtSoFar: assignmentData.topicsTaughtSoFar,
            contentType: (content as any).contentType as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'
          };
        }
      }
    } catch (error) {
      console.error('Error fetching assignment context:', error);
      // Continue without assignment context if there's an error
    }

    const start = Date.now();
    const { consensus, overall, successes, confidence, overallConfidence } = await runDualValidation(content.content, assignmentContext);
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
    const { content } = parsed.data;

    // Fetch assignment details
    const assignmentQuery = await prisma.$queryRaw`
      SELECT topic, "topicsTaughtSoFar", guidelines, "assignedToId", "assignedById", "contentType"
      FROM "ContentAssignment" 
      WHERE id = ${assignmentId}
    ` as Array<{
      topic: string;
      topicsTaughtSoFar: string[];
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
      topicsTaughtSoFar: assignment?.topicsTaughtSoFar || [],
      contentType: assignment?.contentType as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'
    };

    const start = Date.now();
    const { consensus, overall, successes, confidence, overallConfidence } = await runDualValidation(content, assignmentContext);
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
        topicsTaughtSoFar: assignmentContext.topicsTaughtSoFar,
        hasGuidelines: false,
        guidelines: null
      },
    });
  } catch (error) {
    console.error('Error validating assignment content:', error);
    res.status(500).json({ error: 'Failed to validate assignment content' });
  }
});


