import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { runDualLLMValidation, type AssignmentContext } from '../services/validation.js';
import { prisma } from '../lib/prisma.js';
import { preprocessContent, validateContentStructure } from '../utils/contentPreprocessing.js';

export const validateRouter = Router();

// Helper function to extract topic from content for backward compatibility
function extractTopicFromContent(title: string, content: string): string {
  // Try to extract topic from title first
  if (title) {
    // Remove common prefixes like "LECTURE NOTE:", "ASSIGNMENT:", etc.
    const cleanTitle = title.replace(/^(LECTURE NOTE|ASSIGNMENT|PRE-READ):\s*/i, '').trim();
    if (cleanTitle && cleanTitle.length > 0) {
      return cleanTitle;
    }
  }
  
  // Try to extract from content headers (markdown headers)
  const headerMatch = content.match(/^#+\s*(.+)$/m);
  if (headerMatch && headerMatch[1]) {
    return headerMatch[1].trim();
  }
  
  // Try to extract from first sentence or paragraph
  const firstSentence = content.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length > 10 && firstSentence.length < 100) {
    return firstSentence.trim();
  }
  
  // Fallback to generic topic
  return 'General Content';
}

const requestSchema = z.object({
  content: z.string()
    .min(1, "Content cannot be empty")
    .max(50000, "Content must be less than 50,000 characters")
    .refine((val) => val.trim().length > 0, "Content cannot be only whitespace"),
  contentId: z.string().optional(),
  contentType: z.enum(['PRE_READ', 'ASSIGNMENT', 'LECTURE_NOTE']).optional(),
  topic: z.string().optional(),
  topicsTaughtSoFar: z.array(z.string()).optional()
});

// Unified validation endpoint - uses runDualLLMValidation consistently
validateRouter.post('/', requireAuth, async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ 
      error: 'Invalid payload', 
      details: parsed.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    });
  }
  
  const { content, contentId, contentType, topic, topicsTaughtSoFar } = parsed.data;
  
  // Preprocess and validate content structure
  const { cleanedContent, warnings, metadata } = preprocessContent(content);
  const structureValidation = validateContentStructure(cleanedContent);
  
  // Log preprocessing warnings
  if (warnings.length > 0) {
    console.log('Content preprocessing warnings:', warnings);
  }
  
  // Use cleaned content for validation
  const contentToValidate = cleanedContent;

  // Check if content is linked to an assignment
  let assignmentContext: AssignmentContext | undefined;
  if (contentId) {
    try {
      const contentRecord = await prisma.$queryRaw`
        SELECT ca.topic, ca."topicsTaughtSoFar", ca.guidelines, c."contentType"
        FROM "ContentAssignment" ca
        JOIN "Content" c ON ca."contentId" = c.id
        WHERE ca."contentId" = ${contentId}
      ` as Array<{
        topic: string;
        topicsTaughtSoFar: string[];
        guidelines: string | null;
        contentType: string;
      }>;

      if (contentRecord.length > 0) {
        const record = contentRecord[0];
        if (record) {
          assignmentContext = {
            topic: record.topic,
            topicsTaughtSoFar: record.topicsTaughtSoFar,
            contentType: record.contentType as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'
          };
        }
      }
    } catch (error) {
      console.error('Error fetching assignment context:', error);
    }
  }

  // Enhanced fallback assignment context from request parameters
  if (!assignmentContext && (topic || topicsTaughtSoFar || contentType)) {
    assignmentContext = {
      topic: topic || 'General Content',
      topicsTaughtSoFar: topicsTaughtSoFar || ['General Knowledge'],
      contentType: contentType as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE' || 'LECTURE_NOTE'
    };
    console.log(`Created fallback assignment context from request parameters: ${assignmentContext.topic}`);
  }
  
  // Final fallback: extract topic from content if no context available
  if (!assignmentContext) {
    const extractedTopic = extractTopicFromContent('', content);
    assignmentContext = {
      topic: extractedTopic,
      topicsTaughtSoFar: ['General Knowledge'],
      contentType: contentType as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE' || 'LECTURE_NOTE'
    };
    console.log(`Created final fallback assignment context: ${extractedTopic}`);
  }

  const start = Date.now();
  
  try {
    console.log('Starting unified dual LLM validation');
    console.log(`Content length: ${contentToValidate.length} characters`);
    console.log(`Assignment context: ${assignmentContext ? 'Present' : 'Not present'}`);
    
    // Use unified dual LLM validation system
    const dualResult = await runDualLLMValidation(contentToValidate, assignmentContext);
    const overallScore = Math.round((dualResult.finalScore.relevance + dualResult.finalScore.continuity + dualResult.finalScore.documentation) / 3);
    
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
      overall: overallScore,
      processingTime: dualResult.processingTime,
      confidence: 0.95,
      // Include preprocessing information
      preprocessing: {
        warnings,
        metadata,
        structureValidation
      },
      // Include detailed dual validation results for debugging
      dualValidationDetails: {
        round1: dualResult.round1Results,
        round2: dualResult.round2Results
      }
    });
  } catch (error) {
    console.error('Unified dual LLM validation failed:', error);
    
    // Log the error for monitoring
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'LLM_VALIDATION_ERROR',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          contentLength: content.length,
          contentType: assignmentContext?.contentType || 'unknown'
        }
      }
    });
    
    // Return error response
    res.status(500).json({ 
      error: 'Validation failed', 
      message: error instanceof Error ? error.message : 'Unknown validation error',
      contentLength: content.length,
      contentType: assignmentContext?.contentType || 'unknown'
    });
  }
});

// Re-validate existing content by ID - uses unified system
validateRouter.post('/:id', requireAuth, async (req, res) => {
  try {
    const contentId = req.params.id;
    const user = req.user!;
    
    if (!contentId) {
      return res.status(400).json({ error: 'Content ID is required' });
    }

    // Fetch the content with contentType included
    let content;
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      // Admins and Super Admins can re-validate content assigned to them for review or their own content
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
        select: {
          id: true,
          title: true,
          content: true,
          contentType: true,
          status: true,
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
        select: {
          id: true,
          title: true,
          content: true,
          contentType: true,
          status: true,
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
            topicsTaughtSoFar: assignmentData.topicsTaughtSoFar || [],
            contentType: content.contentType as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE' || 'LECTURE_NOTE'
          };
          console.log(`Found assignment context for content ${contentId}: ${assignmentData.topic}`);
        }
      } else {
        console.log(`No assignment context found for content ${contentId}, proceeding without context`);
      }
    } catch (error) {
      console.error('Error fetching assignment context:', error);
      // Continue without assignment context if there's an error
    }

    // Enhanced backward compatibility: Create fallback context for older content
    if (!assignmentContext && content.contentType) {
      // Extract topic from content title or content itself for older content
      const extractedTopic = extractTopicFromContent(content.title, content.content);
      assignmentContext = {
        topic: extractedTopic,
        topicsTaughtSoFar: ['General Knowledge'], // Default fallback
        contentType: content.contentType as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'
      };
      console.log(`Created fallback assignment context for older content ${contentId}: ${extractedTopic}`);
    }

    const start = Date.now();
    
    console.log(`Starting unified dual LLM validation for content ${contentId}`);
    console.log(`Content length: ${content.content.length} characters`);
    console.log(`Assignment context: ${assignmentContext ? 'Present' : 'Not present'}`);
    
    // Use unified dual LLM validation system
    const dualResult = await runDualLLMValidation(content.content, assignmentContext);
    const processingTime = Date.now() - start;

    // Store validation results in database
    const validationResults = [];
    try {
      // Store Round 2 results (final scores) from both models
      const round2Results = [];
      
      if (dualResult?.round2Results?.openai) {
        round2Results.push(dualResult.round2Results.openai);
      }
      if (dualResult?.round2Results?.gemini) {
        round2Results.push(dualResult.round2Results.gemini);
      }
      
      console.log(`Storing ${round2Results.length} validation results`);
      
      for (const result of round2Results) {
        if (result && result.scores) {
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
      }
    } catch (dbError) {
      console.error('Error storing validation results:', dbError);
      // Continue with response even if database storage fails
    }

    // Calculate overall score from final scores (maximum from Round 2)
    let overallScore = 0;
    if (dualResult?.finalScore) {
      overallScore = Math.round((dualResult.finalScore.relevance + dualResult.finalScore.continuity + dualResult.finalScore.documentation) / 3);
    } else {
      console.warn('Warning: dualResult.finalScore is missing, using fallback score calculation');
      // Fallback: calculate from stored validation results
      if (validationResults.length > 0) {
        const avgScore = validationResults.reduce((sum, result) => sum + result.overallScore, 0) / validationResults.length;
        overallScore = Math.round(avgScore);
      }
    }
    
    console.log(`Final overall score: ${overallScore}`);
    
    res.json({
      validationResults,
      overallScore,
      confidence: 95, // High confidence from dual validation
      processingTimeMs: processingTime,
      // Include detailed dual validation results for debugging
      dualValidationDetails: dualResult ? {
        round1: dualResult.round1Results,
        round2: dualResult.round2Results,
        finalScore: dualResult.finalScore,
        finalFeedback: dualResult.finalFeedback
      } : null
    });
  } catch (error) {
    console.error('Error re-validating content:', error);
    res.status(500).json({ error: 'Failed to re-validate content' });
  }
});

// Validate content specifically for an assignment - uses unified system
validateRouter.post('/assignment/:assignmentId', requireAuth, async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;
    const user = req.user!;
    
    if (!assignmentId) {
      return res.status(400).json({ error: 'Assignment ID is required' });
    }

    // Fetch assignment details
    const assignment = await prisma.contentAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if user has permission to validate this assignment
    if (user.role === 'CREATOR' && assignment.assignedToId !== user.id) {
      return res.status(403).json({ error: 'You can only validate your own assignments' });
    }

    const { content, contentType } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    const assignmentContext: AssignmentContext = {
      topic: assignment.topic,
      topicsTaughtSoFar: assignment.topicsTaughtSoFar,
      contentType: contentType || assignment.contentType as 'PRE_READ' | 'ASSIGNMENT' | 'LECTURE_NOTE'
    };

    const start = Date.now();
    
    // Use unified dual LLM validation system
    const dualResult = await runDualLLMValidation(content, assignmentContext);
    const processingTime = Date.now() - start;
    
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
      assignmentContext: {
        topic: assignmentContext.topic,
        topicsTaughtSoFar: assignmentContext.topicsTaughtSoFar,
        hasGuidelines: false,
        guidelines: null
      },
      // Include detailed dual validation results for debugging
      dualValidationDetails: {
        round1: dualResult.round1Results,
        round2: dualResult.round2Results
      }
    });
  } catch (error) {
    console.error('Error validating assignment content:', error);
    res.status(500).json({ error: 'Failed to validate assignment content' });
  }
});