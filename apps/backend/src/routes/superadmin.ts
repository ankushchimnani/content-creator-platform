import { Router } from 'express';
import { PrismaClient, Role, ContentType, ContentStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { z } from 'zod';

const prisma = new PrismaClient();
export const superadminRouter = Router();

// Get all users with their assignments and statistics
superadminRouter.get('/users', requireAuth, requireRole(['SUPERADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        assignedAdmin: {
          select: { id: true, name: true, email: true }
        },
        assignedCreators: {
          select: { id: true, name: true, email: true }
        },
        contents: {
          where: { status: 'APPROVED' },
          select: { 
            id: true, 
            contentType: true, 
            approvedAt: true,
            title: true
          }
        },
        assignedTasks: {
          where: { status: 'COMPLETED' },
          include: {
            content: {
              select: { 
                id: true, 
                contentType: true, 
                status: true,
                approvedAt: true,
                title: true
              }
            }
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

// Get payment configuration
superadminRouter.get('/payment-config', requireAuth, requireRole(['SUPERADMIN']), async (req, res) => {
  try {
    const configs = await prisma.paymentConfiguration.findMany({
      orderBy: { contentType: 'asc' }
    });
    res.json({ configs });
  } catch (error) {
    console.error('Error fetching payment config:', error);
    res.status(500).json({ error: 'Failed to fetch payment configuration' });
  }
});

// Update payment configuration
const updatePaymentConfigSchema = z.object({
  contentType: z.enum(['PRE_READ', 'ASSIGNMENT', 'LECTURE_NOTE']),
  amountPerUnit: z.number().positive()
});

superadminRouter.put('/payment-config', requireAuth, requireRole(['SUPERADMIN']), async (req, res) => {
  try {
    const parse = updatePaymentConfigSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: 'Invalid payload' });
    
    const { contentType, amountPerUnit } = parse.data;
    
    const config = await prisma.paymentConfiguration.upsert({
      where: { contentType },
      update: { amountPerUnit },
      create: { contentType, amountPerUnit }
    });

    res.json({ config });
  } catch (error) {
    console.error('Error updating payment config:', error);
    res.status(500).json({ error: 'Failed to update payment configuration' });
  }
});

// Get creator invoice data
superadminRouter.get('/invoice/:creatorId', requireAuth, requireRole(['SUPERADMIN']), async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { startDate, endDate } = req.query;

    if (!creatorId) {
      return res.status(400).json({ error: 'Creator ID is required' });
    }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) dateFilter.lte = new Date(endDate as string);

    const creator = await prisma.user.findFirst({
      where: { 
        id: creatorId,
        role: 'CREATOR'
      },
      include: {
        assignedAdmin: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Get approved content
    const approvedContent = await prisma.content.findMany({
      where: {
        authorId: creatorId,
        status: 'APPROVED',
        ...(Object.keys(dateFilter).length > 0 && { approvedAt: dateFilter })
      },
      select: {
        id: true,
        title: true,
        contentType: true,
        approvedAt: true,
        wordCount: true
      }
    });

    // Get completed assignments with approved content
    const completedAssignments = await prisma.contentAssignment.findMany({
      where: {
        assignedToId: creatorId,
        status: 'COMPLETED',
        content: {
          status: 'APPROVED',
          ...(Object.keys(dateFilter).length > 0 && { approvedAt: dateFilter })
        }
      },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            contentType: true,
            approvedAt: true,
            wordCount: true
          }
        }
      }
    });

    // Get payment configuration
    const paymentConfigs = await prisma.paymentConfiguration.findMany();

    // Calculate payments
    const contentByType = {
      PRE_READ: approvedContent.filter(c => c.contentType === 'PRE_READ'),
      ASSIGNMENT: completedAssignments
        .filter(a => a.content && a.content.contentType === 'ASSIGNMENT')
        .map(a => a.content!)
        .filter(Boolean),
      LECTURE_NOTE: approvedContent.filter(c => c.contentType === 'LECTURE_NOTE')
    };

    const payments = paymentConfigs.map(config => {
      const content = contentByType[config.contentType];
      const count = content.length;
      const totalAmount = count * config.amountPerUnit;
      
      return {
        contentType: config.contentType,
        count,
        amountPerUnit: config.amountPerUnit,
        totalAmount,
        content: content.map(c => ({
          id: c.id,
          title: c.title,
          approvedAt: c.approvedAt,
          wordCount: c.wordCount
        }))
      };
    });

    const totalAmount = payments.reduce((sum, p) => sum + p.totalAmount, 0);

    res.json({
      creator,
      payments,
      totalAmount,
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// Get all invoices for CSV export
superadminRouter.get('/invoices/export', requireAuth, requireRole(['SUPERADMIN']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) dateFilter.lte = new Date(endDate as string);

    const creators = await prisma.user.findMany({
      where: { role: 'CREATOR' },
      include: {
        assignedAdmin: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const paymentConfigs = await prisma.paymentConfiguration.findMany();
    const invoices = [];

    for (const creator of creators) {
      // Get approved content
      const approvedContent = await prisma.content.findMany({
        where: {
          authorId: creator.id,
          status: 'APPROVED',
          approvedAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
        },
        select: {
          id: true,
          title: true,
          contentType: true,
          approvedAt: true,
          wordCount: true
        }
      });

      // Get completed assignments with approved content
      const completedAssignments = await prisma.contentAssignment.findMany({
        where: {
          assignedToId: creator.id,
          status: 'COMPLETED',
          content: {
            status: 'APPROVED',
            approvedAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
          }
        },
        include: {
          content: {
            select: {
              id: true,
              title: true,
              contentType: true,
              approvedAt: true,
              wordCount: true
            }
          }
        }
      });

      const contentByType = {
        PRE_READ: approvedContent.filter(c => c.contentType === 'PRE_READ'),
        ASSIGNMENT: completedAssignments.filter(a => a.content?.contentType === 'ASSIGNMENT'),
        LECTURE_NOTE: approvedContent.filter(c => c.contentType === 'LECTURE_NOTE')
      };

      const payments = paymentConfigs.map(config => {
        const content = contentByType[config.contentType];
        const count = content.length;
        const totalAmount = count * config.amountPerUnit;
        
        return {
          contentType: config.contentType,
          count,
          amountPerUnit: config.amountPerUnit,
          totalAmount
        };
      });

      const totalAmount = payments.reduce((sum, p) => sum + p.totalAmount, 0);

      invoices.push({
        creatorId: creator.id,
        creatorName: creator.name,
        creatorEmail: creator.email,
        assignedAdminName: creator.assignedAdmin?.name,
        assignedAdminEmail: creator.assignedAdmin?.email,
        payments,
        totalAmount
      });
    }

    res.json({ invoices, period: { startDate, endDate } });
  } catch (error) {
    console.error('Error exporting invoices:', error);
    res.status(500).json({ error: 'Failed to export invoices' });
  }
});

// Update admin assignment for creator
const updateAdminAssignmentSchema = z.object({
  creatorId: z.string(),
  adminId: z.string().nullable()
});

superadminRouter.put('/assign-admin', requireAuth, requireRole(['SUPERADMIN']), async (req, res) => {
  try {
    const parse = updateAdminAssignmentSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: 'Invalid payload' });
    
    const { creatorId, adminId } = parse.data;

    // Verify creator exists
    const creator = await prisma.user.findFirst({
      where: { id: creatorId, role: 'CREATOR' }
    });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    // Verify admin exists if provided
    if (adminId) {
      const admin = await prisma.user.findFirst({
        where: { id: adminId, role: 'ADMIN' }
      });
      if (!admin) return res.status(404).json({ error: 'Admin not found' });
    }

    const updatedCreator = await prisma.user.update({
      where: { id: creatorId },
      data: { assignedAdminId: adminId },
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
        action: 'ADMIN_ASSIGNMENT_UPDATED',
        metadata: { 
          creatorId, 
          adminId,
          creatorName: creator.name,
          adminName: adminId ? (await prisma.user.findUnique({ where: { id: adminId } }))?.name : null
        }
      }
    });

    res.json({ creator: updatedCreator });
  } catch (error) {
    console.error('Error updating admin assignment:', error);
    res.status(500).json({ error: 'Failed to update admin assignment' });
  }
});

// Get dashboard statistics
superadminRouter.get('/dashboard-stats', requireAuth, requireRole(['SUPERADMIN']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) dateFilter.lte = new Date(endDate as string);

    // Get content statistics
    const contentStats = await prisma.content.groupBy({
      by: ['status'],
      where: {
        createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
      },
      _count: { id: true }
    });

    // Get assignment statistics
    const assignmentStats = await prisma.contentAssignment.groupBy({
      by: ['status'],
      where: {
        createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
      },
      _count: { id: true }
    });

    // Get user counts
    const userStats = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true }
    });

    // Get admin-creator assignments
    const adminStats = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      include: {
        assignedCreators: {
          select: { id: true }
        }
      }
    });

    const stats = {
      content: contentStats.reduce((acc, stat) => {
        acc[stat.status.toLowerCase()] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      assignments: assignmentStats.reduce((acc, stat) => {
        acc[stat.status.toLowerCase()] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      users: userStats.reduce((acc, stat) => {
        acc[stat.role.toLowerCase()] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      adminAssignments: adminStats.map(admin => ({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        assignedCreatorsCount: admin.assignedCreators.length
      })),
      period: { startDate, endDate }
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get all admins for dropdown
superadminRouter.get('/admins', requireAuth, requireRole(['SUPERADMIN']), async (req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        name: true,
        email: true,
        assignedCreators: {
          select: { id: true, name: true, email: true }
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

// Get all creators for dropdown
superadminRouter.get('/creators', requireAuth, requireRole(['SUPERADMIN']), async (req, res) => {
  try {
    const creators = await prisma.user.findMany({
      where: { role: 'CREATOR' },
      include: {
        assignedAdmin: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ creators });
  } catch (error) {
    console.error('Error fetching creators:', error);
    res.status(500).json({ error: 'Failed to fetch creators' });
  }
});
