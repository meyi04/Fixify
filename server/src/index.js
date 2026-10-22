import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import core from './routes/core.js';
import admin from './routes/admin.js';
import './db.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const origins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({ origin: origins, credentials: false }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 60e3, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60e3, limit: 40, standardHeaders: true, legacyHeaders: false })); // brute-force / code-guessing guard
app.use('/uploads/public', express.static('uploads/public', { setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', admin);
app.use('/api', core);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { // never leak stack traces
  if (err.name === 'ZodError') return res.status(400).json({ error: err.issues.map((i) => i.message).join('; ') });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 5 MB)' });
  if (/File type/.test(err.message)) return res.status(400).json({ error: err.message });
  console.error(err); res.status(500).json({ error: 'Something went wrong' });
});
app.listen(process.env.PORT || 4000, () => console.log('Fixify API on :' + (process.env.PORT || 4000)));
