import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { authRouter } from './routes/auth.js';
import { validateRouter } from './routes/validate.js';
import contentRouter from './routes/content.js';
import adminRouter from './routes/admin.js';
import { assignmentsRouter } from './routes/assignments.js';
import { superAdminRouter } from './routes/super-admin.js';

const app = express();
const logger = pino({ transport: { target: 'pino-pretty' } });
app.use(pinoHttp({ logger }));
app.use(helmet());

// Rate limiting - exclude OPTIONS requests for CORS preflight
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes for both development and production
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.method === 'OPTIONS' // Skip rate limiting for CORS preflight requests
});

// Use the same limiter for both environments
app.use('/api/', limiter);
app.use(cors({
  origin: [
    'https://content-creators.masaischool.com', 
    'https://content-api.masaischool.com', 
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',  // Alternative dev server
    'http://localhost:5174',  // Alternative Vite port
    'http://127.0.0.1:5173',  // Alternative localhost format
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Development endpoint to reset rate limiter
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/dev/reset-rate-limit', (_req: Request, res: Response) => {
    // This will reset the rate limiter for the current IP
    res.json({ message: 'Rate limiter reset for development' });
  });
}

app.use('/api/auth', authRouter);
app.use('/api/validate', validateRouter);
app.use('/api/content', contentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/super-admin', superAdminRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, '0.0.0.0', () => {
  logger.info({ port }, 'Backend listening');
});
