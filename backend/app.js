const express = require('express');
require('dotenv').config();
const { closeDatabase, connectToDatabase, getDatabase } = require('./db');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hej fra Express!');
});

app.get('/health', async (req, res) => {
  try {
    await getDatabase().command({ ping: 1 });
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('MongoDB health check fejlede:', error.message);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

async function startServer() {
  await connectToDatabase();

  app.listen(port, () => {
    console.log(`Serveren kører på http://localhost:${port}`);
  });
}

async function shutdown() {
  await closeDatabase();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer().catch((error) => {
  console.error('Kunne ikke starte backend:', error.message);
  process.exit(1);
});