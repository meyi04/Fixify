import { readFileSync } from 'node:fs';

let fileValue = '';
try {
  fileValue = readFileSync(new URL('../.env.android', import.meta.url), 'utf8')
    .match(/^VITE_API\s*=\s*(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '') || '';
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const api = process.env.VITE_API ?? fileValue;
if (!api) throw new Error('Set VITE_API to the deployed HTTPS API URL in app/.env.android before building Android.');
const url = new URL(api);
if (url.protocol !== 'https:' || /REPLACE|YOUR|localhost/i.test(url.hostname)) {
  throw new Error('Android builds require a deployed HTTPS API URL in VITE_API.');
}
