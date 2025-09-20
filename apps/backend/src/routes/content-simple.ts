import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';

const prisma = new PrismaClient();
export const contentRouter = Router();

// Validation schemas
const createContentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  brief: z.string().optional(),
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
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
    if (user.role === 'ADMIN') {
      // Admins can see content assigned to them for review
      contents = await prisma.content.findMany({
        where: {
          OR: [
            { authorId: user.id },
            { 
              status: 'REVIEW',
              author: { assignedAdminId: user.id }
            }
          ]
        },
        include: {
          author: {
            select: { id: true, name: true, email: true }
          },
          reviewer: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });
    } else {
      // Creators can only see their own content
      contents = await prisma.content.findMany({
        where: { authorId: user.id },
        include: {
          author: {
            select: { id: true, name: true, email: true }
          },
          reviewer: {
            select: { id: true, name: true, email: true }
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

// Create new content
contentRouter.post('/', requireAuth, requireRole(['CREATOR']), async (req, res) => {
  try {
    const parsed = createContentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    const { title, content, brief, tags, category } = parsed.data;
    const user = req.user!;

    const wordCount = countWords(content);
    const readingTime = calculateReadingTime(content);

    const newContent = await prisma.content.create({
      data: {
        title,
        content,
        brief: brief || null,
        tags,
        category: category || null,
        wordCount,
        readingTime,
        authorId: user.id,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CONTENT_CREATED',
        metadata: { contentId: newContent.id, title }
      }
    });

    res.status(201).json({ content: newContent });
  } catch (error) {
    console.error('Error creating content:', error);
    res.status(500).json({ error: 'Failed to create content' });
  }
});

// Submit content for review
contentRouter.post('/submit', requireAuth, requireRole(['CREATOR']), async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId || typeof contentId !== 'string') {
      return res.status(400).json({ error: 'Valid contentId is required' });
    }

    const user = req.user!;

    // Check if content exists and user owns it
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { 
        author: { 
          include: { assignedAdmin: true } 
        } 
      }
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (content.authorId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (content.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Content must be in draft status to submit' });
    }

    if (!content.author.assignedAdmin) {
      return res.status(400).json({ error: 'No admin assigned to review your content' });
    }

    // Update content status and assign reviewer
    const updatedContent = await prisma.content.update({
      where: { id: contentId },
      data: {
        status: 'REVIEW',
        submittedAt: new Date(),
        reviewerId: content.author.assignedAdminId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        reviewer: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CONTENT_SUBMITTED',
        metadata: { 
          contentId, 
          reviewerId: content.author.assignedAdminId,
          title: content.title 
        }
      }
    });

    res.json({ 
      content: updatedContent, 
      message: 'Content submitted for review successfully' 
    });
  } catch (error) {
    console.error('Error submitting content:', error);
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
        author: {
          select: { id: true, name: true, email: true, assignedAdminId: true }
        }
      }
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (content.author.assignedAdminId !== user.id) {
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
    }

    const updatedContent = await prisma.content.update({
      where: { id: contentId },
      data: updateData,
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        reviewer: {
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

export default contentRouter;
