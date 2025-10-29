import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthPayload {
  sub: string;
  id: string;
  role: string;
  email: string;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = header.substring(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret') as AuthPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Middleware to check if user account is active
export async function requireActiveUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch user from database to check isActive status
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isActive: true }
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!dbUser.isActive) {
      return res.status(403).json({ error: 'Account is inactive. Please contact your administrator.' });
    }

    next();
  } catch (error) {
    console.error('Error checking user active status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


