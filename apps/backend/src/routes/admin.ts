import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { prisma } from '../lib/prisma';
export const adminRouter = Router();

// Get all users for admin management
adminRouter.get('/users', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        lastLogin: true,
        assignedAdminId: true,
        assignedAdmin: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: {
            contents: true,
            assignedCreators: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all admins (for assignment dropdowns)
adminRouter.get('/admins', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: { assignedCreators: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ admins });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// Get assigned creators for the current admin
adminRouter.get('/assigned-creators', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    console.log('Request user:', req.user);
    console.log('Request headers:', req.headers);
    
    const adminId = req.user!.id;
    console.log('Fetching assigned creators for admin:', adminId);
    
    // First, let's test a simple query without _count
    const simpleCreators = await prisma.user.findMany({
      where: { 
        role: 'CREATOR',
        assignedAdminId: adminId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });
    
    console.log('Simple query result:', simpleCreators);
    
    // Now try the full query
    const creators = await prisma.user.findMany({
      where: { 
        role: 'CREATOR',
        assignedAdminId: adminId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            contents: true,
            assignedTasks: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log('Found creators:', creators.length);
    res.json({ creators });
  } catch (error) {
    console.error('Error fetching assigned creators:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      adminId: req.user?.id
    });
    res.status(500).json({ error: 'Failed to fetch assigned creators' });
  }
});

// Assign creator to admin
const assignCreatorSchema = z.object({
  creatorId: z.string(),
  adminId: z.string().optional(), // null to unassign
});

adminRouter.post('/assign-creator', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const parsed = assignCreatorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    const { creatorId, adminId } = parsed.data;

    // Verify creator exists and is actually a creator
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, role: true, name: true, email: true }
    });

    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    if (creator.role !== 'CREATOR') {
      return res.status(400).json({ error: 'User is not a creator' });
    }

    // Verify admin exists if adminId is provided
    if (adminId) {
      const admin = await prisma.user.findUnique({
        where: { id: adminId },
        select: { id: true, role: true }
      });

      if (!admin) {
        return res.status(404).json({ error: 'Admin not found' });
      }

      if (admin.role !== 'ADMIN') {
        return res.status(400).json({ error: 'User is not an admin' });
      }
    }

    // Update the creator's assigned admin
    const updatedCreator = await prisma.user.update({
      where: { id: creatorId },
      data: { assignedAdminId: adminId || null },
      include: {
        assignedAdmin: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: adminId ? 'CREATOR_ASSIGNED' : 'CREATOR_UNASSIGNED',
        metadata: { 
          creatorId, 
          adminId,
          creatorName: creator.name,
          creatorEmail: creator.email
        }
      }
    });

    res.json({ 
      creator: updatedCreator,
      message: adminId 
        ? `Creator assigned to admin successfully` 
        : `Creator unassigned successfully`
    });
  } catch (error) {
    console.error('Error assigning creator:', error);
    res.status(500).json({ error: 'Failed to assign creator' });
  }
});

// Get content review queue for admin
adminRouter.get('/review-queue', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const adminId = req.user!.id;

    const reviewQueue = await prisma.content.findMany({
      where: {
        status: 'REVIEW',
        author: { assignedAdminId: adminId }
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
      orderBy: { submittedAt: 'asc' } // Oldest submissions first
    });

    res.json({ reviewQueue });
  } catch (error) {
    console.error('Error fetching review queue:', error);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

// Get admin dashboard statistics
adminRouter.get('/stats', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const adminId = req.user!.id;

    // Get counts for assigned creators' content
    const stats = await prisma.$transaction([
      // Total assigned creators
      prisma.user.count({
        where: { assignedAdminId: adminId, role: 'CREATOR' }
      }),
      
      // Content in review queue
      prisma.content.count({
        where: {
          status: 'REVIEW',
          author: { assignedAdminId: adminId }
        }
      }),
      
      // Approved content this month
      prisma.content.count({
        where: {
          status: 'APPROVED',
          reviewerId: adminId,
          approvedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      
      // Rejected content this month
      prisma.content.count({
        where: {
          status: 'REJECTED',
          reviewerId: adminId,
          rejectedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      
      // Total content reviewed by this admin
      prisma.content.count({
        where: {
          reviewerId: adminId,
          status: { in: ['APPROVED', 'REJECTED'] }
        }
      })
    ]);

    const [
      assignedCreators,
      pendingReviews,
      approvedThisMonth,
      rejectedThisMonth,
      totalReviewed
    ] = stats;

    res.json({
      stats: {
        assignedCreators,
        pendingReviews,
        approvedThisMonth,
        rejectedThisMonth,
        totalReviewed,
        reviewRate: totalReviewed > 0 ? ((approvedThisMonth / (approvedThisMonth + rejectedThisMonth)) * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// Get audit logs (admin activity)
adminRouter.get('/audit-logs', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const logs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    const totalLogs = await prisma.auditLog.count();

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total: totalLogs,
        pages: Math.ceil(totalLogs / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default adminRouter;
