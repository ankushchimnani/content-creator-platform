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

const app = express();
const logger = pino({ transport: { target: 'pino-pretty' } });
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/validate', validateRouter);
app.use('/api/content', contentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/assignments', assignmentsRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, '127.0.0.1', () => {
  logger.info({ port }, 'Backend listening');
});
