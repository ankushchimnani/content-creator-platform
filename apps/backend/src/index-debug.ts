import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';

const app = express();

// Test with minimal middleware first
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  console.log('Health endpoint hit');
  res.json({ status: 'ok' });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4002;
app.listen(port, () => {
  console.log(`Debug server listening on port ${port}`);
});
