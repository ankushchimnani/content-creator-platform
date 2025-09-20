import express from 'express';

const app = express();

app.get('/health', (req, res) => {
  console.log('Health endpoint hit at', new Date().toISOString());
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const port = 4003;
app.listen(port, '127.0.0.1', () => {
  console.log(`Minimal server listening on 127.0.0.1:${port}`);
});
