import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
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
    where: { email },
    include: { assignedAdmin: { select: { id: true, name: true, email: true } } }
  });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  
  const secret = process.env.JWT_SECRET || 'devsecret';
  const tokenPayload = { 
    sub: user.id, 
    id: user.id,
    role: user.role, 
    email: user.email,
    name: user.name,
    assignedAdminId: user.assignedAdminId
  };
  const token = jwt.sign(tokenPayload, secret, { expiresIn: '8h' });
  
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  
  res.json({ 
    token, 
    user: { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      role: user.role,
      assignedAdmin: user.assignedAdmin
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


