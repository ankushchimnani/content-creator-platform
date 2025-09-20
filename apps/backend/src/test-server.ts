import express from 'express';

const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = 4001;
app.listen(port, () => {
  console.log(`Test server listening on port ${port}`);
});
