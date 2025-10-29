import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
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
        courseAssigned: true
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
adminRouter.get('/admins', requireAuth, requireRole(['ADMIN']), async (_req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        name: true,
        email: true
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
    const adminId = req.user!.id;

    const creators = await prisma.user.findMany({
      where: {
        role: 'CREATOR',
        assignedAdminId: { has: adminId }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        contactNumber: true,
        courseAssigned: true,
        createdAt: true,
        lastLogin: true,
        isActive: true,
        assignedAdminId: true
      },
      orderBy: { name: 'asc' }
    });

    // Fetch all admin details for the creators
    const allAdminIds = Array.from(new Set(creators.flatMap(c => c.assignedAdminId || [])));
    const admins = await prisma.user.findMany({
      where: {
        id: { in: allAdminIds },
        role: 'ADMIN'
      },
      select: {
        id: true,
        name: true,
        email: true,
        contactNumber: true
      }
    });

    // Map admin details to creators (exclude current admin from the list)
    const creatorsWithAdmins = creators.map(creator => ({
      ...creator,
      assignedAdmins: (creator.assignedAdminId || [])
        .map(aId => admins.find(a => a.id === aId))
        .filter(admin => admin && admin.id !== adminId) // Exclude current admin
    }));

    res.json({ creators: creatorsWithAdmins });
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

    // Get current admin assignments
    const currentCreator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { assignedAdminId: true }
    });

    // Update the creator's assigned admins (add or remove from array)
    let newAdminIds = currentCreator?.assignedAdminId || [];
    if (adminId) {
      // Add admin if not already in the array
      if (!newAdminIds.includes(adminId)) {
        newAdminIds = [...newAdminIds, adminId];
      }
    } else {
      // Remove the requesting admin from the array
      newAdminIds = newAdminIds.filter(id => id !== req.user!.id);
    }

    const updatedCreator = await prisma.user.update({
      where: { id: creatorId },
      data: { assignedAdminId: newAdminIds },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedAdminId: true
      }
    });

    // Log the action (note: AuditLog schema has 'id' as required in this version)
    // Commenting out for now to avoid schema mismatch
    // await prisma.auditLog.create({
    //   data: {
    //     userId: req.user!.id,
    //     action: adminId ? 'CREATOR_ASSIGNED' : 'CREATOR_UNASSIGNED',
    //     metadata: {
    //       creatorId,
    //       adminId,
    //       creatorName: creator.name,
    //       creatorEmail: creator.email
    //     }
    //   }
    // });

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

    // Get all creators assigned to this admin
    const assignedCreators = await prisma.user.findMany({
      where: {
        role: 'CREATOR',
        assignedAdminId: { has: adminId }
      },
      select: { id: true }
    });

    const creatorIds = assignedCreators.map(c => c.id);

    const reviewQueue = await prisma.content.findMany({
      where: {
        status: 'REVIEW',
        authorId: { in: creatorIds }
      },
      include: {
        User_Content_authorIdToUser: {
          select: { id: true, name: true, email: true }
        },
        ValidationResult: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { submittedAt: 'asc' } // Oldest submissions first
    });

    // Map the response to use 'author' instead of 'User_Content_authorIdToUser'
    const formattedReviewQueue = reviewQueue.map(content => ({
      ...content,
      author: content.User_Content_authorIdToUser,
      validationResults: content.ValidationResult
    }));

    res.json({ reviewQueue: formattedReviewQueue });
  } catch (error) {
    console.error('Error fetching review queue:', error);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

// Get admin dashboard statistics
adminRouter.get('/stats', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const adminId = req.user!.id;

    // Get all creators assigned to this admin
    const creators = await prisma.user.findMany({
      where: {
        role: 'CREATOR',
        assignedAdminId: { has: adminId }
      },
      select: { id: true }
    });

    const creatorIds = creators.map(c => c.id);
    const assignedCreatorsCount = creators.length;

    // Get counts for content assignments and content status
    const [
      totalAssigned,
      totalPendingReview,
      totalApproved,
      totalRejected
    ] = await prisma.$transaction([
      // Total content assigned by this admin
      prisma.contentAssignment.count({
        where: {
          assignedById: adminId
        }
      }),

      // Total content in review status (from assigned creators)
      prisma.content.count({
        where: {
          status: 'REVIEW',
          authorId: { in: creatorIds }
        }
      }),

      // Total approved content (from assigned creators)
      prisma.content.count({
        where: {
          status: 'APPROVED',
          authorId: { in: creatorIds }
        }
      }),

      // Total rejected content (from assigned creators)
      prisma.content.count({
        where: {
          status: 'REJECTED',
          authorId: { in: creatorIds }
        }
      })
    ]);

    res.json({
      stats: {
        assignedCreators: assignedCreatorsCount,
        totalAssigned,
        totalPendingReview,
        totalApproved,
        totalRejected
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
        User: {
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
