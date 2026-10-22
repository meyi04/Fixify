import jwt from 'jsonwebtoken';
import { one, run } from './db.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET missing or shorter than 32 chars. See .env.example'); process.exit(1);
}
const SECRET = process.env.JWT_SECRET;
export const sign = (u) => jwt.sign({ id: u.id, v: u.token_version }, SECRET, { expiresIn: '2h', algorithm: 'HS256' });

export function auth(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Not signed in' });
  try {
    const p = jwt.verify(h.slice(7), SECRET, { algorithms: ['HS256'] });
    const u = one('SELECT * FROM users WHERE id=?', p.id);
    if (!u || u.token_version !== p.v) return res.status(401).json({ error: 'Session expired' });
    if (u.status !== 'active') return res.status(403).json({ error: 'Account is ' + u.status });
    req.user = u; next();
  } catch { res.status(401).json({ error: 'Session expired' }); }
}
export const role = (...r) => (req, res, next) => (r.includes(req.user.role) ? next() : res.status(403).json({ error: 'Not allowed' }));
export const perm = (p) => (req, res, next) => {
  const list = JSON.parse(req.user.permissions || '[]');
  return list.includes('*') || list.includes(p) ? next() : res.status(403).json({ error: 'Missing admin permission: ' + p });
};
export const audit = (req, action, target, meta) =>
  run('INSERT INTO audit_logs(actor_id,action,target,meta,ip) VALUES(?,?,?,?,?)', req?.user?.id ?? null, action, target ?? null, meta ? JSON.stringify(meta) : null, req?.ip ?? null);
export const notify = (userId, title, body) => run('INSERT INTO notifications(user_id,title,body) VALUES(?,?,?)', userId, title, body ?? '');
export const validate = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  req.body = r.data; next();
};
export const safeUser = (u) => { if (!u) return u; const { password_hash, code_hash, code_expires, code_purpose, code_tries, failed_attempts, locked_until, token_version, ...rest } = u; return rest; };
