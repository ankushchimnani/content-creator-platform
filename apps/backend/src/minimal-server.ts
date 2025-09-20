import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/test', (req, res) => {
  res.json({ message: 'Test endpoint working', body: req.body });
});

const port = 4002;
app.listen(port, () => {
  console.log(`🚀 Minimal server listening on http://127.0.0.1:${port}`);
});
