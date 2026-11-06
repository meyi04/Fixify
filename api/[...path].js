import { createApp } from '../server/src/app.js';
import { initializeDatabase } from '../server/src/db.js';

export const config = { maxDuration: 60 };

let app;
let initialization;

function initialize() {
  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID is required');
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is required');
  }
  if (!process.env.ADMIN_EMAIL) {
    throw new Error('ADMIN_EMAIL is required');
  }

  if (!initialization) {
    initialization = initializeDatabase({
      adminEmail: process.env.ADMIN_EMAIL,
      adminPassword: process.env.ADMIN_PASSWORD,
    }).catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}

export default async function handler(req, res) {
  try {
    await initialize();
    app ||= createApp(process.env.CORS_ORIGINS || '');
    if (req.url && !req.url.startsWith('/api/') && !req.url.startsWith('/uploads/')) {
      req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
    }
    app(req, res);
  } catch (error) {
    console.error('Fixify API initialization failed', error);
    if (!res.headersSent) res.status(503).json({ error: 'Service temporarily unavailable' });
  }
}
