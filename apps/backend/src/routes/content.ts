import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { sendContentSubmissionEmail } from '../services/email.js';
export const contentRouter = Router();

// Validation schemas
const createContentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
  contentType: z.enum(['PRE_READ', 'ASSIGNMENT', 'LECTURE_NOTE']).default('LECTURE_NOTE'),
  difficulty: z.string().optional(), // For ASSIGNMENT type
});

const updateContentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  contentType: z.enum(['PRE_READ', 'ASSIGNMENT', 'LECTURE_NOTE']).optional(),
  difficulty: z.string().optional(), // For ASSIGNMENT type
});

// Helper functions
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

function countWords(content: string): number {
  return content.split(/\s+/).filter(word => word.length > 0).length;
}

// Get all content for the current user
contentRouter.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    
    let contents;
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      // Admins and Super Admins can see content assigned to them for review
      contents = await prisma.content.findMany({
        where: {
          authorId: user.id
        },
        include: {
          User_Content_authorIdToUser: {
            select: { id: true, name: true, email: true }
          },
          User_Content_reviewerIdToUser: {
            select: { id: true, name: true, email: true }
          },
          ValidationResult: {
            orderBy: { createdAt: 'desc' },
            take: 1 // Get the most recent validation result
          }
        },
        orderBy: { updatedAt: 'desc' }
      });
    } else {
      // Creators can only see their own content
      contents = await prisma.content.findMany({
        where: { authorId: user.id },
        include: {
          User_Content_authorIdToUser: {
            select: { id: true, name: true, email: true }
          },
          User_Content_reviewerIdToUser: {
            select: { id: true, name: true, email: true }
          },
          ContentAssignment: {
            include: {
              User_ContentAssignment_assignedByIdToUser: {
                select: { id: true, name: true, email: true, contactNumber: true }
              }
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });
    }

    res.json({ contents });
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Get guidelines for creators (public endpoint for authenticated users)
contentRouter.get('/guidelines', requireAuth, async (req, res) => {
  try {
    const guidelines = await (prisma as any).guidelinesTemplate.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        contentType: true,
        guidelines: true,
        version: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ guidelines });
  } catch (error) {
    console.error('Error fetching guidelines:', error);
    res.status(500).json({ error: 'Failed to fetch guidelines' });
  }
});

// Get individual content by ID
contentRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const contentId = req.params.id;
    
    if (!contentId) {
      return res.status(400).json({ error: 'Content ID is required' });
    }

    let content;
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      // Admins and Super Admins can see content assigned to them for review or their own content
      content = await prisma.content.findFirst({
        where: {
          id: contentId,
          authorId: user.id
        },
        include: {
          User_Content_authorIdToUser: {
            select: { id: true, name: true, email: true }
          },
          User_Content_reviewerIdToUser: {
            select: { id: true, name: true, email: true }
          },
          ValidationResult: {
            orderBy: { createdAt: 'desc' },
            take: 1 // Get only the most recent validation result
          }
        }
      });
    } else {
      // Creators can only see their own content
      content = await prisma.content.findFirst({
        where: {
          id: contentId,
          authorId: user.id
        },
        include: {
          User_Content_authorIdToUser: {
            select: { id: true, name: true, email: true }
          },
          User_Content_reviewerIdToUser: {
            select: { id: true, name: true, email: true }
          },
          ValidationResult: {
            orderBy: { createdAt: 'desc' },
            take: 1 // Get only the most recent validation result
          }
        }
      });
    }

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json({ content });
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Create new content
contentRouter.post('/', requireAuth, requireRole(['CREATOR', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const parsed = createContentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    const { title, content, tags, category, contentType, difficulty } = parsed.data;
    const user = req.user!;

    const wordCount = countWords(content);
    const readingTime = calculateReadingTime(content);

    // Wrap content creation and audit logging in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const newContent = await tx.content.create({
        data: {
          title,
          content,
          tags,
          category: category || null,
          contentType: contentType as any,
          difficulty: difficulty || null,
          wordCount,
          readingTime,
          authorId: user.id,
          updatedAt: new Date(),
        } as any,
        include: {
          User_Content_authorIdToUser: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CONTENT_CREATED',
          metadata: { contentId: newContent.id, title }
        }
      });

      return newContent;
    });

    res.status(201).json({ content: result });
  } catch (error) {
    console.error('Error creating content:', error);
    
    // Handle specific database errors
    if ((error as any)?.code === 'P2002') {
      return res.status(409).json({ error: 'Content with this title already exists' });
    }
    if ((error as any)?.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid reference to related resource' });
    }
    
    res.status(500).json({ error: 'Failed to create content' });
  }
});

// Submit content for review
contentRouter.post('/submit', requireAuth, requireRole(['CREATOR', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { contentId, validationData } = req.body;
    
    if (!contentId || typeof contentId !== 'string') {
      return res.status(400).json({ error: 'Valid contentId is required' });
    }

    const user = req.user!;

    // Check if content exists and user owns it
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        User_Content_authorIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            assignedAdminId: true
          }
        },
        ContentAssignment: {
          select: {
            assignedById: true,
            User_ContentAssignment_assignedByIdToUser: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (content.authorId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (content.status !== 'DRAFT' && content.status !== 'REJECTED') {
      return res.status(400).json({ error: 'Content must be in draft or rejected status to submit' });
    }

    // Get the admin who assigned this task from ContentAssignment
    if (!content.ContentAssignment || !content.ContentAssignment.assignedById) {
      return res.status(400).json({ error: 'No assignment found for this content' });
    }

    const assignedByAdminId = content.ContentAssignment.assignedById;

    // Update content status and assign reviewer (use admin who created the assignment)
    const updateData: any = {
      status: 'REVIEW',
      submittedAt: new Date(),
      reviewerId: assignedByAdminId,
      reviewedAt: null, // Reset review timestamp
      reviewFeedback: null, // Clear previous feedback
      approvedAt: null,
      rejectedAt: null,
      updatedAt: new Date(),
    };

    // If resubmitting after rejection, increment version
    if (content.status === 'REJECTED') {
      updateData.version = content.version + 1;
    }

    // Wrap content update, validation storage, and audit logging in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedContent = await tx.content.update({
        where: { id: contentId },
        data: updateData,
        include: {
          User_Content_authorIdToUser: {
            select: { id: true, name: true, email: true }
          },
          User_Content_reviewerIdToUser: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Store validation results if provided
      if (validationData) {
        await tx.validationResult.create({
          data: {
            contentId: contentId,
            llmProvider: 'OPENAI', // Use valid enum value (represents dual validation)
            modelVersion: 'gpt-4-gemini-2.5-flash-lite',
            criteria: validationData.criteria,
            overallScore: validationData.overallScore || validationData.overall, // Handle both field names
            processingTimeMs: validationData.processingTime || 0
          }
        });
      }

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CONTENT_SUBMITTED',
          metadata: {
            contentId,
            reviewerId: assignedByAdminId,
            title: content.title,
            version: updateData.version || content.version,
            hasValidationData: !!validationData
          }
        }
      });

      return updatedContent;
    });

    // Send email notification to the admin who assigned this task
    try {
      const assignedByAdmin = content.ContentAssignment.User_ContentAssignment_assignedByIdToUser;

      if (assignedByAdmin && assignedByAdmin.email) {
        await sendContentSubmissionEmail(
          assignedByAdmin.email,
          assignedByAdmin.name,
          {
            creatorName: user.name || user.email,
            contentTitle: content.title,
            contentType: content.contentType,
            category: content.category || undefined,
            wordCount: content.wordCount,
            submittedAt: new Date().toISOString()
          }
        );
      }
    } catch (emailError) {
      // Log email error but don't fail the submission
      console.error('Failed to send submission email to admin:', emailError);
    }

    res.json({
      content: result,
      message: 'Content submitted for review successfully'
    });
  } catch (error) {
    console.error('Error submitting content:', error);
    
    // Handle specific database errors
    if ((error as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'Content not found' });
    }
    if ((error as any)?.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid reference to reviewer' });
    }
    
    res.status(500).json({ error: 'Failed to submit content' });
  }
});

// Review content (approve/reject) - Admin only
contentRouter.post('/:id/review', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const contentId = req.params.id;
    const user = req.user!;
    
    if (!contentId) {
      return res.status(400).json({ error: 'Content ID is required' });
    }

    const { action, feedback } = req.body;
    
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Valid action (approve/reject) is required' });
    }

    // Check if content exists and is assigned to this admin
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        User_Content_authorIdToUser: {
          select: { id: true, name: true, email: true, assignedAdminId: true }
        }
      }
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const authorAdminIds = content.User_Content_authorIdToUser.assignedAdminId;
    if (!authorAdminIds || !authorAdminIds.includes(user.id)) {
      return res.status(403).json({ error: 'You are not assigned to review this content' });
    }

    if (content.status !== 'REVIEW') {
      return res.status(400).json({ error: 'Content is not in review status' });
    }

    // Update content based on action
    const updateData: any = {
      reviewedAt: new Date(),
      reviewFeedback: feedback || null,
    };

    if (action === 'approve') {
      updateData.status = 'APPROVED';
      updateData.approvedAt = new Date();
    } else {
      updateData.status = 'REJECTED';
      updateData.rejectedAt = new Date();
      updateData.rejectionCount = (content.rejectionCount || 0) + 1;
    }

    const updatedContent = await prisma.content.update({
      where: { id: contentId },
      data: updateData,
      include: {
        User_Content_authorIdToUser: {
          select: { id: true, name: true, email: true }
        },
        User_Content_reviewerIdToUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: action === 'approve' ? 'CONTENT_APPROVED' : 'CONTENT_REJECTED',
        metadata: { 
          contentId: contentId, 
          authorId: content.authorId,
          title: content.title,
          feedback 
        }
      }
    });

    res.json({ 
      content: updatedContent, 
      message: `Content ${action}d successfully` 
    });
  } catch (error) {
    console.error('Error reviewing content:', error);
    res.status(500).json({ error: 'Failed to review content' });
  }
});

// Update content (only for DRAFT and REJECTED status)
contentRouter.put('/:id', requireAuth, requireRole(['CREATOR']), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const contentId = req.params.id as string;
    
    const parsed = updateContentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    const { title, content, contentType, difficulty } = parsed.data;

    // Check if content exists and belongs to user
    const existingContent = await prisma.content.findUnique({
      where: { id: contentId }
    });

    if (!existingContent) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (existingContent.authorId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (existingContent.status !== 'DRAFT' && existingContent.status !== 'REJECTED') {
      return res.status(400).json({ error: 'Can only edit content in draft or rejected status' });
    }

    // Calculate metadata
    const wordCount = content ? countWords(content) : existingContent.wordCount;
    const readingTime = content ? calculateReadingTime(content) : existingContent.readingTime;

    const updatedContent = await prisma.content.update({
      where: { id: contentId },
      data: {
        ...(title && { title }),
        ...(content && { content, wordCount, readingTime }),
        ...(contentType && { contentType }),
        ...(difficulty !== undefined && { difficulty: difficulty || null }),
        status: 'DRAFT', // Reset to draft when editing
        version: existingContent.status === 'REJECTED' ? (existingContent.version || 1) + 1 : existingContent.version,
        updatedAt: new Date(),
      },
      include: {
        User_Content_authorIdToUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({ content: updatedContent });
  } catch (error) {
    console.error('Error updating content:', error);
    res.status(500).json({ error: 'Failed to update content' });
  }
});

export default contentRouter;
