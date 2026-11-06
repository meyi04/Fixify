import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { createApp } from './src/app.js';
import { initializeDatabase } from './src/db.js';

const adminEmail = defineString('ADMIN_EMAIL');
const adminPassword = defineSecret('ADMIN_PASSWORD');
const corsOrigins = defineString('CORS_ORIGINS', {
  default: 'https://localhost,http://localhost,capacitor://localhost',
});
let initialization;
let app;

function initialize() {
  if (!initialization) {
    initialization = initializeDatabase({
      adminEmail: adminEmail.value(),
      adminPassword: adminPassword.value(),
    }).catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}

export const api = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 120,
  secrets: [adminPassword],
}, async (req, res) => {
  try {
    await initialize();
    app ||= createApp(corsOrigins.value());
    app(req, res);
  } catch (error) {
    console.error('Fixify API initialization failed', error);
    if (!res.headersSent) res.status(503).json({ error: 'Service temporarily unavailable' });
  }
});
