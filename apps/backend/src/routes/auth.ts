import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireActiveUser } from '../middleware/auth.js';
export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

authRouter.post('/login', async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid credentials' });
  const { email, password } = parse.data;
  const user = await prisma.user.findUnique({
    where: { email }
  });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // Check if user is active
  if (!user.isActive) {
    return res.status(403).json({ error: 'Account is inactive. Please contact an administrator.' });
  }

  const secret = process.env.JWT_SECRET || 'devsecret';
  const tokenPayload = {
    sub: user.id,
    id: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  };
  const token = jwt.sign(tokenPayload, secret, { expiresIn: '24h' });

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      assignedAdminId: user.assignedAdminId
    }
  });
});

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.nativeEnum(Role).optional(),
});

authRouter.post('/register', async (req, res) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' });
  const { email, name, password, role } = parse.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already in use' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, name, passwordHash, role: role ?? 'CREATOR' } });
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

// Change Password endpoint
const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

authRouter.post('/change-password', requireAuth, requireActiveUser, async (req, res) => {
  try {
    const parse = changePasswordSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid payload. Both current and new password required (min 6 characters).' });
    }

    const { currentPassword, newPassword } = parse.data;
    const userId = req.user!.id;

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    // Hash new password and update
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Forgot Password endpoint - generates a new temporary password and sends it via email
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

authRouter.post('/forgot-password', async (req, res) => {
  try {
    const parse = forgotPasswordSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const { email } = parse.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // For security, always return success even if user doesn't exist
    // This prevents email enumeration attacks
    if (!user) {
      return res.json({ message: 'If the email exists, a password reset link has been sent' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.json({ message: 'If the email exists, a password reset link has been sent' });
    }

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10);

    // Update user with temporary password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: tempPasswordHash }
    });

    // Send email with temporary password
    const { sendEmail } = await import('../services/email.js');
    await sendEmail({
      to: user.email,
      subject: 'Password Reset - GUARD RAIL',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .password-box { background: white; border: 2px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
            .password { font-size: 24px; font-weight: bold; color: #2563eb; letter-spacing: 2px; font-family: monospace; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset</h1>
            </div>
            <div class="content">
              <p>Hello ${user.name},</p>
              <p>We received a request to reset your password for your GUARD RAIL account.</p>
              <p>Your temporary password is:</p>
              <div class="password-box">
                <div class="password">${tempPassword}</div>
              </div>
              <p><strong>Important:</strong></p>
              <ul>
                <li>Use this temporary password to log in</li>
                <li>After logging in, go to Settings to change your password</li>
                <li>This temporary password will work until you change it</li>
              </ul>
              <p>If you didn't request this password reset, please contact your system administrator immediately.</p>
            </div>
            <div class="footer">
              <p>This is an automated email from GUARD RAIL Content Validation Platform</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    res.json({ message: 'If the email exists, a password reset link has been sent' });
  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Get assigned admins for creator
authRouter.get('/users/assigned-admins', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Only creators can access this endpoint
    if (userRole !== 'CREATOR') {
      return res.status(403).json({ error: 'Access denied. Only creators can view assigned admins.' });
    }

    // Fetch user to get assignedAdminId array
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { assignedAdminId: true }
    });

    if (!user || !user.assignedAdminId || user.assignedAdminId.length === 0) {
      return res.json({ admins: [] });
    }

    // Fetch all admins based on the assignedAdminId array
    const admins = await prisma.user.findMany({
      where: {
        id: { in: user.assignedAdminId as string[] }
      },
      select: {
        id: true,
        name: true,
        email: true,
        contactNumber: true
      }
    });

    res.json({ admins });
  } catch (error) {
    console.error('Error fetching assigned admins:', error);
    res.status(500).json({ error: 'Failed to fetch assigned admins' });
  }
});


 
