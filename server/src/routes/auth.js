import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { one, run } from '../db.js';
import { auth, sign, validate, audit, safeUser, notify } from '../mw.js';

const r = Router();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const password = z.string().min(10).max(72)
  .regex(/[a-z]/, 'needs a lowercase letter').regex(/[A-Z]/, 'needs an uppercase letter').regex(/\d/, 'needs a number');
const email = z.string().email().max(120).transform((s) => s.toLowerCase().trim());

function sendCode(u, purpose) {
  const code = String(crypto.randomInt(100000, 1000000));
  run('UPDATE users SET code_hash=?, code_expires=?, code_purpose=?, code_tries=0 WHERE id=?', sha(code), Date.now() + 15 * 60e3, purpose, u.id);
  // TODO production: send via email (SMTP/SendGrid) or SMS (Twilio/Semaphore). Never log codes in production.
  console.log(`[fixify] ${purpose} code for ${u.email}: ${code}`);
}
function checkCode(u, code, purpose) {
  if (!u || u.code_purpose !== purpose || !u.code_hash || Date.now() > u.code_expires || u.code_tries >= 5) return false;
  run('UPDATE users SET code_tries=code_tries+1 WHERE id=?', u.id);
  const a = Buffer.from(sha(String(code))), b = Buffer.from(u.code_hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

r.post('/register', validate(z.object({
  role: z.enum(['client', 'shop', 'technician']), name: z.string().min(2).max(80), email, password,
  phone: z.string().max(20).optional(), businessName: z.string().max(100).optional(), city: z.string().max(80).optional(),
})), (req, res) => {
  const b = req.body;
  if (b.role === 'shop' && !b.businessName) return res.status(400).json({ error: 'Business name is required' });
  const existing = one('SELECT * FROM users WHERE email=?', b.email);
  if (existing) { if (existing.status === 'unverified') sendCode(existing, 'verify'); }   // generic reply: no account enumeration
  else {
    const id = run('INSERT INTO users(role,email,phone,password_hash,name) VALUES(?,?,?,?,?)', b.role, b.email, b.phone ?? null, bcrypt.hashSync(b.password, 12), b.name).lastInsertRowid;
    run('INSERT INTO profiles(user_id,business_name,city) VALUES(?,?,?)', id, b.businessName ?? null, b.city ?? null);
    sendCode(one('SELECT * FROM users WHERE id=?', id), 'verify');
    audit({ user: { id }, ip: req.ip }, 'user.register', `user:${id}`, { role: b.role });
  }
  res.status(201).json({ message: 'If the details are valid, a 6-digit verification code was sent.' });
});

r.post('/verify', validate(z.object({ email, code: z.string().length(6) })), (req, res) => {
  const u = one('SELECT * FROM users WHERE email=?', req.body.email);
  if (!checkCode(u, req.body.code, 'verify')) return res.status(400).json({ error: 'Invalid or expired code' });
  run("UPDATE users SET status='active', code_hash=NULL WHERE id=? AND status='unverified'", u.id);
  if (u.role !== 'client') notify(u.id, 'Welcome to Fixify', 'Upload your permit or ID so an administrator can validate your account, then subscribe to start accepting bookings.');
  res.json({ message: 'Verified. You can now sign in.' });
});

r.post('/resend', validate(z.object({ email })), (req, res) => {
  const u = one("SELECT * FROM users WHERE email=? AND status='unverified'", req.body.email);
  if (u) sendCode(u, 'verify');
  res.json({ message: 'If the account needs verification, a new code was sent.' });
});

r.post('/login', validate(z.object({ email, password: z.string().max(72) })), (req, res) => {
  const u = one('SELECT * FROM users WHERE email=?', req.body.email);
  const bad = () => res.status(401).json({ error: 'Incorrect email or password' });
  if (!u) { bcrypt.compareSync(req.body.password, '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5Y3s4yS3m0Z5r0s3m0Z5r0s3m0Z5r0u'); return bad(); }
  if (u.locked_until > Date.now()) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  if (!bcrypt.compareSync(req.body.password, u.password_hash)) {
    const n = u.failed_attempts + 1;
    if (n >= 5) { run('UPDATE users SET failed_attempts=0, locked_until=? WHERE id=?', Date.now() + 15 * 60e3, u.id); audit({ user: { id: u.id }, ip: req.ip }, 'security.lockout', `user:${u.id}`); }
    else run('UPDATE users SET failed_attempts=? WHERE id=?', n, u.id);
    return bad();
  }
  if (u.status === 'unverified') return res.status(403).json({ error: 'Verify your email first', needsVerify: true });
  if (u.status !== 'active') return res.status(403).json({ error: 'This account is ' + u.status });
  run('UPDATE users SET failed_attempts=0 WHERE id=?', u.id);
  audit({ user: u, ip: req.ip }, 'auth.login', `user:${u.id}`);
  res.json({ token: sign(u), user: safeUser(u) });
});

r.post('/forgot', validate(z.object({ email })), (req, res) => {
  const u = one("SELECT * FROM users WHERE email=? AND status='active'", req.body.email);
  if (u) sendCode(u, 'reset');
  res.json({ message: 'If the account exists, a reset code was sent.' });
});
r.post('/reset', validate(z.object({ email, code: z.string().length(6), password })), (req, res) => {
  const u = one('SELECT * FROM users WHERE email=?', req.body.email);
  if (!checkCode(u, req.body.code, 'reset')) return res.status(400).json({ error: 'Invalid or expired code' });
  run('UPDATE users SET password_hash=?, code_hash=NULL, token_version=token_version+1 WHERE id=?', bcrypt.hashSync(req.body.password, 12), u.id);
  audit({ user: u, ip: req.ip }, 'auth.password_reset', `user:${u.id}`);
  res.json({ message: 'Password updated. Sign in with the new password.' });
});

r.get('/me', auth, (req, res) => res.json(safeUser(req.user)));
r.post('/password', auth, validate(z.object({ current: z.string(), password })), (req, res) => {
  if (!bcrypt.compareSync(req.body.current, req.user.password_hash)) return res.status(400).json({ error: 'Current password is wrong' });
  run('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', bcrypt.hashSync(req.body.password, 12), req.user.id);
  audit(req, 'auth.password_change', `user:${req.user.id}`);
  res.json({ message: 'Password changed. Please sign in again.' });
});
r.post('/logout-all', auth, (req, res) => { run('UPDATE users SET token_version=token_version+1 WHERE id=?', req.user.id); res.json({ ok: true }); });

export default r;
