import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pino from 'pino';
import { fetchAttendanceFromWebsite } from './scraper.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 4000);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/attendance', async (req, res) => {
  try {
    const baseUrl = process.env.SOURCE_BASE_URL;
    if (!baseUrl) {
      return res.status(500).json({ error: 'SOURCE_BASE_URL is not configured' });
    }
    const username = req.query.username as string | undefined;
    const password = req.query.password as string | undefined;
    const records = await fetchAttendanceFromWebsite({ baseUrl, username, password });
    res.json({ records });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch attendance');
    res.status(500).json({ error: 'Failed to fetch attendance', details: err?.message });
  }
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server listening');
});
