import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { authRouter } from './routes/auth';
import { validateRouter } from './routes/validate';
import contentRouter from './routes/content';
import adminRouter from './routes/admin';
import { assignmentsRouter } from './routes/assignments';
import { superadminRouter } from './routes/superadmin';

const app = express();
const logger = pino({ transport: { target: 'pino-pretty' } });
app.use(pinoHttp({ logger }));
app.use(helmet());
// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://content-creators.masaischool.com', 
      'https://content-api.masaischool.com',
    ];
    
    // Allow all localhost and 127.0.0.1 origins for development
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    
    if (allowedOrigins.includes(origin) || isLocalhost) {
      console.log(`✅ CORS: Allowing origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS: Blocking origin: ${origin}`);
      callback(new Error(`Not allowed by CORS: ${origin}`), false);
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-HTTP-Method-Override'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/validate', validateRouter);
app.use('/api/content', contentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/superadmin', superadminRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, '0.0.0.0', () => {
  logger.info({ port }, 'Backend listening');
});
