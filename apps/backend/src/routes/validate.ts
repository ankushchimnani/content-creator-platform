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
      const contentRecord = await prisma.content.findUnique({
        where: { id: contentId }
      });

      if (contentRecord) {
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
              guidelines: assignmentData.guidelines || undefined
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
  type Issue = { start: number; end: number; message: string; severity: 'critical' | 'important' | 'minor' };
  const computeIssues = (text: string): Issue[] => {
    const issues: Issue[] = [];
    if (!/^#\s+/m.test(text)) {
      issues.push({ start: 0, end: Math.min(20, text.length), message: 'Add an H1 heading at the top', severity: 'important' });
    }
    const todoRegex = /\bTODO\b/g;
    for (let m = todoRegex.exec(text); m; m = todoRegex.exec(text)) {
      issues.push({ start: m.index, end: m.index + m[0].length, message: 'Resolve TODO', severity: 'minor' });
    }
    const lines = text.split(/\n/);
    let offset = 0;
    for (const line of lines) {
      if (line.length > 120) {
        issues.push({ start: offset, end: offset + line.length, message: 'Line exceeds 120 characters', severity: 'minor' });
      }
      offset += line.length + 1;
    }
    return issues;
  };
  const documentationIssues = computeIssues(content);
  res.json({
    criteria: {
      relevance: { score: consensus.relevance, confidence: confidence.relevance, feedback: '', suggestions: [], issues: [] },
      continuity: { score: consensus.continuity, confidence: confidence.continuity, feedback: '', suggestions: [], issues: [] },
      documentation: { score: consensus.documentation, confidence: confidence.documentation, feedback: '', suggestions: [], issues: documentationIssues },
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

// Validate content specifically for an assignment
validateRouter.post('/assignment/:assignmentId', requireAuth, async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
    const { content, brief } = parsed.data;

    // Fetch assignment details
    const assignmentQuery = await prisma.$queryRaw`
      SELECT topic, "prerequisiteTopics", guidelines, "assignedToId", "assignedById"
      FROM "ContentAssignment" 
      WHERE id = ${assignmentId}
    ` as Array<{
      topic: string;
      prerequisiteTopics: string[];
      guidelines: string | null;
      assignedToId: string;
      assignedById: string;
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
      guidelines: assignment?.guidelines || undefined
    };

    const start = Date.now();
    const { consensus, overall, successes, confidence, overallConfidence } = await runDualValidation(content, brief, assignmentContext);
    const processingTime = Date.now() - start;
    
    type Issue = { start: number; end: number; message: string; severity: 'critical' | 'important' | 'minor' };
    const computeIssues = (text: string): Issue[] => {
      const issues: Issue[] = [];
      if (!/^#\s+/m.test(text)) {
        issues.push({ start: 0, end: Math.min(20, text.length), message: 'Add an H1 heading at the top', severity: 'important' });
      }
      const todoRegex = /\bTODO\b/g;
      for (let m = todoRegex.exec(text); m; m = todoRegex.exec(text)) {
        issues.push({ start: m.index, end: m.index + m[0].length, message: 'Resolve TODO', severity: 'minor' });
      }
      const lines = text.split(/\n/);
      let offset = 0;
      for (const line of lines) {
        if (line.length > 120) {
          issues.push({ start: offset, end: offset + line.length, message: 'Line exceeds 120 characters', severity: 'minor' });
        }
        offset += line.length + 1;
      }
      return issues;
    };

    const documentationIssues = computeIssues(content);

    res.json({
      criteria: {
        relevance: { 
          score: consensus.relevance, 
          confidence: confidence.relevance, 
          feedback: successes.length > 0 ? (successes[0]?.feedback?.relevance || '') : '', 
          suggestions: [], 
          issues: [] 
        },
        continuity: { 
          score: consensus.continuity, 
          confidence: confidence.continuity, 
          feedback: successes.length > 0 ? (successes[0]?.feedback?.continuity || '') : '', 
          suggestions: [], 
          issues: [] 
        },
        documentation: { 
          score: consensus.documentation, 
          confidence: confidence.documentation, 
          feedback: successes.length > 0 ? (successes[0]?.feedback?.documentation || '') : '', 
          suggestions: [], 
          issues: documentationIssues 
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


