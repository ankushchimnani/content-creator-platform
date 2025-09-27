import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';

export const assignmentsRouter = Router();

// Validation schemas
const createAssignmentSchema = z.object({
  topic: z.string().min(1).max(200),
  prerequisiteTopics: z.array(z.string()).default([]),
  guidelines: z.string().optional(),
  contentType: z.enum(['PRE_READ', 'ASSIGNMENT', 'LECTURE_NOTE']).default('LECTURE_NOTE'),
  difficulty: z.string().optional(), // For ASSIGNMENT type
  dueDate: z.string().datetime().optional(),
  assignedToId: z.string(),
});

const updateAssignmentSchema = z.object({
  topic: z.string().min(1).max(200).optional(),
  prerequisiteTopics: z.array(z.string()).optional(),
  guidelines: z.string().optional(),
  contentType: z.enum(['PRE_READ', 'ASSIGNMENT', 'LECTURE_NOTE']).optional(),
  difficulty: z.string().optional(), // For ASSIGNMENT type
  dueDate: z.string().datetime().optional(),
  status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE']).optional(),
});

// Get all assignments for admin (created by them)
assignmentsRouter.get('/', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const adminId = req.user!.id;
    
    // Get assignments created by this admin
    const assignments = await (prisma as any).contentAssignment.findMany({
      where: { assignedById: adminId },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        content: {
          include: { 
            validationResults: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get all content created by creators assigned to this admin (including unlinked content)
    const assignedCreators = await prisma.user.findMany({
      where: { 
        role: 'CREATOR',
        assignedAdminId: adminId
      },
      select: { id: true }
    });

    const creatorIds = assignedCreators.map(c => c.id);
    
    const allContent = await prisma.content.findMany({
      where: {
        authorId: { in: creatorIds }
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        validationResults: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Create virtual assignments for unlinked content
    const unlinkedContent = allContent.filter(content => 
      !assignments.some((assignment: any) => assignment.contentId === content.id)
    );

    const virtualAssignments = unlinkedContent.map((content: any) => ({
      id: `virtual-${content.id}`,
      topic: content.title,
      prerequisiteTopics: [],
      guidelines: null,
      contentType: 'LECTURE_NOTE' as const,
      difficulty: null,
      dueDate: null,
      status: 'COMPLETED' as const,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      assignedTo: content.author,
      content: {
        id: content.id,
        title: content.title,
        status: content.status,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
        submittedAt: content.submittedAt,
        reviewedAt: content.reviewedAt,
        approvedAt: content.approvedAt,
        rejectedAt: content.rejectedAt,
        reviewFeedback: content.reviewFeedback,
        validationResults: content.validationResults
      }
    }));

    // Combine real assignments with virtual assignments
    const allAssignments = [...assignments, ...virtualAssignments];

    res.json({ assignments: allAssignments });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Get assignments for a creator (assigned to them)
assignmentsRouter.get('/my-tasks', requireAuth, requireRole(['CREATOR']), async (req: Request, res: Response) => {
  try {
    const creatorId = req.user!.id;
    
    const assignments = await (prisma as any).contentAssignment.findMany({
      where: { assignedToId: creatorId },
      include: {
        assignedBy: {
          select: { id: true, name: true, email: true }
        },
        content: {
          include: {
            validationResults: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ assignments });
  } catch (error) {
    console.error('Error fetching creator assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Create new assignment (Admin only)
assignmentsRouter.post('/', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const parsed = createAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    const { topic, prerequisiteTopics, guidelines, contentType, difficulty, dueDate, assignedToId } = parsed.data;
    const adminId = req.user!.id;

    // Verify the assigned user exists and is a creator assigned to this admin
    const assignedCreator = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, name: true, email: true, role: true, assignedAdminId: true }
    });

    if (!assignedCreator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    if (assignedCreator.role !== 'CREATOR') {
      return res.status(400).json({ error: 'User is not a creator' });
    }

    if (assignedCreator.assignedAdminId !== adminId) {
      return res.status(403).json({ error: 'Creator is not assigned to you' });
    }

    // Wrap assignment creation and audit logging in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create assignment
      const assignment = await (tx as any).contentAssignment.create({
        data: {
          topic,
          prerequisiteTopics,
          guidelines: guidelines || null,
          contentType,
          difficulty: difficulty || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          assignedById: adminId,
          assignedToId,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true }
          },
          assignedBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'ASSIGNMENT_CREATED',
          metadata: { 
            assignmentId: assignment.id, 
            topic: assignment.topic,
            assignedToId,
            assignedToName: assignedCreator.name
          }
        }
      });

      return assignment;
    });

    res.status(201).json({ assignment: result });
  } catch (error) {
    console.error('Error creating assignment:', error);
    
    // Handle specific database errors
    if ((error as any)?.code === 'P2002') {
      return res.status(409).json({ error: 'Assignment already exists' });
    }
    if ((error as any)?.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid reference to related resource' });
    }
    
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// Update assignment (Admin only)
assignmentsRouter.put('/:id', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const assignmentId = req.params.id;
    const adminId = req.user!.id;
    
    const parsed = updateAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    // Check if assignment exists and belongs to this admin
    const existingAssignment = await (prisma as any).contentAssignment.findUnique({
      where: { id: assignmentId as string },
      select: { id: true, assignedById: true, status: true }
    });

    if (!existingAssignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (existingAssignment.assignedById !== adminId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { topic, prerequisiteTopics, guidelines, contentType, difficulty, dueDate, status } = parsed.data;
    
    // Wrap assignment update and audit logging in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedAssignment = await (tx as any).contentAssignment.update({
        where: { id: assignmentId as string },
        data: {
          ...(topic && { topic }),
          ...(prerequisiteTopics && { prerequisiteTopics }),
          ...(guidelines !== undefined && { guidelines: guidelines || null }),
          ...(contentType && { contentType }),
          ...(difficulty !== undefined && { difficulty: difficulty || null }),
          ...(dueDate && { dueDate: new Date(dueDate) }),
          ...(status && { status }),
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true }
          },
          assignedBy: {
            select: { id: true, name: true, email: true }
          },
          content: {
            select: { 
              id: true, 
              title: true, 
              status: true, 
              createdAt: true,
              updatedAt: true 
            }
          }
        }
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'ASSIGNMENT_UPDATED',
          metadata: { 
            assignmentId: assignmentId, 
            topic: updatedAssignment.topic,
            changes: parsed.data
          }
        }
      });

      return updatedAssignment;
    });

    res.json({ assignment: result });
  } catch (error) {
    console.error('Error updating assignment:', error);
    
    // Handle specific database errors
    if ((error as any)?.code === 'P2002') {
      return res.status(409).json({ error: 'Assignment update conflicts with existing data' });
    }
    if ((error as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// Mark assignment as in progress (Creator only)
assignmentsRouter.post('/:id/start', requireAuth, requireRole(['CREATOR']), async (req: Request, res: Response) => {
  try {
    const assignmentId = req.params.id;
    const creatorId = req.user!.id;

    // Check if assignment exists and is assigned to this creator
    const assignment = await (prisma as any).contentAssignment.findUnique({
      where: { id: assignmentId as string },
      select: { id: true, assignedToId: true, status: true, topic: true }
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (assignment.assignedToId !== creatorId) {
      return res.status(403).json({ error: 'Assignment not assigned to you' });
    }

    if (assignment.status !== 'ASSIGNED') {
      return res.status(400).json({ error: 'Assignment is not in assigned status' });
    }

    // Wrap assignment update and audit logging in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedAssignment = await (tx as any).contentAssignment.update({
        where: { id: assignmentId as string },
        data: { status: 'IN_PROGRESS' },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true }
          },
          assignedBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: creatorId,
          action: 'ASSIGNMENT_STARTED',
          metadata: { 
            assignmentId: assignmentId, 
            topic: assignment.topic
          }
        }
      });

      return updatedAssignment;
    });

    res.json({ assignment: result });
  } catch (error) {
    console.error('Error starting assignment:', error);
    
    // Handle specific database errors
    if ((error as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    res.status(500).json({ error: 'Failed to start assignment' });
  }
});

// Link content to assignment when creator creates content for it
assignmentsRouter.post('/:id/link-content', requireAuth, requireRole(['CREATOR']), async (req: Request, res: Response) => {
  try {
    const assignmentId = req.params.id;
    const { contentId, validationData } = req.body; // Added validationData
    const creatorId = req.user!.id;

    if (!contentId) {
      return res.status(400).json({ error: 'Content ID is required' });
    }

    // Verify assignment belongs to creator
    const assignment = await (prisma as any).contentAssignment.findUnique({
      where: { id: assignmentId as string },
      select: { id: true, assignedToId: true, contentId: true, topic: true }
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (assignment.assignedToId !== creatorId) {
      return res.status(403).json({ error: 'Assignment not assigned to you' });
    }

    if (assignment.contentId) {
      return res.status(400).json({ error: 'Assignment already has linked content' });
    }

    // Verify content exists and belongs to creator
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { id: true, authorId: true, title: true }
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (content.authorId !== creatorId) {
      return res.status(403).json({ error: 'Content does not belong to you' });
    }

    // Wrap all operations in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Link content to assignment and mark as completed
      const updatedAssignment = await (tx as any).contentAssignment.update({
        where: { id: assignmentId as string },
        data: { 
          contentId: contentId,
          status: 'COMPLETED'
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true }
          },
          assignedBy: {
            select: { id: true, name: true, email: true }
          },
          content: {
            select: { 
              id: true, 
              title: true, 
              status: true, 
              createdAt: true,
              updatedAt: true 
            }
          }
        }
      });

      // Store validation results if provided
      if (validationData) {
        await tx.validationResult.create({
          data: {
            contentId: contentId,
            llmProvider: 'OPENAI', // Default provider
            modelVersion: 'gpt-4',
            criteria: validationData.criteria,
            overallScore: validationData.overallScore,
            processingTimeMs: validationData.processingTime || 0
          }
        });
      }

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: creatorId,
          action: 'ASSIGNMENT_COMPLETED',
          metadata: { 
            assignmentId: assignmentId, 
            contentId: contentId,
            contentTitle: content.title,
            topic: assignment.topic,
            hasValidationData: !!validationData
          }
        }
      });

      return updatedAssignment;
    });

    res.json({ assignment: result });
  } catch (error) {
    console.error('Error linking content to assignment:', error);
    
    // Handle specific database errors
    if ((error as any)?.code === 'P2002') {
      return res.status(409).json({ error: 'Content already linked to another assignment' });
    }
    if ((error as any)?.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid reference to related resource' });
    }
    
    res.status(500).json({ error: 'Failed to link content to assignment' });
  }
});

// Delete assignment (Admin only)
assignmentsRouter.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const assignmentId = req.params.id;
    const adminId = req.user!.id;

    // Check if assignment exists and belongs to this admin
    const assignment = await (prisma as any).contentAssignment.findUnique({
      where: { id: assignmentId as string },
      select: { id: true, assignedById: true, topic: true, contentId: true }
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (assignment.assignedById !== adminId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (assignment.contentId) {
      return res.status(400).json({ error: 'Cannot delete assignment with linked content' });
    }

    // Wrap assignment deletion and audit logging in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete the assignment
      await (tx as any).contentAssignment.delete({
        where: { id: assignmentId as string }
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'ASSIGNMENT_DELETED',
          metadata: { 
            assignmentId: assignmentId, 
            topic: assignment.topic
          }
        }
      });
    });

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    
    // Handle specific database errors
    if ((error as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    if ((error as any)?.code === 'P2003') {
      return res.status(400).json({ error: 'Cannot delete assignment with linked content' });
    }
    
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});
