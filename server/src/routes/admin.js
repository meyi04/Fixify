import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { all, one, run, setting } from '../db.js';
import { auth, role, perm, validate, audit, notify, safeUser } from '../mw.js';

const r = Router();
r.use(auth, role('admin'));
const now = () => Math.floor(Date.now() / 1000);
const PERMS = ['users', 'documents', 'billing', 'finance', 'reports', 'content', 'admins', 'settings'];
const isSuper = (u) => JSON.parse(u.permissions || '[]').includes('*');

// users
r.get('/users', perm('users'), (req, res) => {
  const { role: rl, status, q } = req.query;
  res.json(all(`SELECT id,role,email,phone,name,avatar,status,shop_id,permissions,created_at FROM users WHERE (?1 IS NULL OR role=?1) AND (?2 IS NULL OR status=?2) AND (?3 IS NULL OR name LIKE ?3 OR email LIKE ?3) ORDER BY id DESC LIMIT 300`,
    rl ?? null, status ?? null, q ? `%${q}%` : null));
});
r.post('/users', perm('admins'), validate(z.object({ name: z.string().min(2), email: z.string().email().transform((s) => s.toLowerCase()), password: z.string().min(12).max(72).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/), role: z.enum(['client', 'shop', 'technician', 'admin']), permissions: z.array(z.enum(PERMS)).optional() })), (req, res) => {
  const b = req.body; if (one('SELECT 1 FROM users WHERE email=?', b.email)) return res.status(409).json({ error: 'Email already in use' });
  const id = run("INSERT INTO users(role,email,password_hash,name,status,permissions) VALUES(?,?,?,?, 'active',?)", b.role, b.email, bcrypt.hashSync(b.password, 12), b.name, JSON.stringify(b.role === 'admin' ? b.permissions ?? [] : [])).lastInsertRowid;
  run('INSERT INTO profiles(user_id) VALUES(?)', id); audit(req, 'admin.user_create', `user:${id}`, { role: b.role }); res.status(201).json({ id });
});
r.patch('/users/:id', perm('users'), validate(z.object({ status: z.enum(['active', 'suspended', 'deleted']).optional(), name: z.string().min(2).optional(), reason: z.string().max(300).optional() })), (req, res) => {
  const t = one('SELECT * FROM users WHERE id=?', req.params.id); if (!t) return res.status(404).json({ error: 'Not found' });
  if (t.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own status' });
  if (t.role === 'admin' && !isSuper(req.user)) return res.status(403).json({ error: 'Only a super admin can change admins' });
  run('UPDATE users SET status=COALESCE(?,status), name=COALESCE(?,name), token_version=token_version+1 WHERE id=?', req.body.status ?? null, req.body.name ?? null, t.id); // bumping token_version signs the user out everywhere
  if (req.body.status) notify(t.id, 'Account ' + req.body.status, req.body.reason ?? '');
  audit(req, 'admin.user_' + (req.body.status ?? 'edit'), `user:${t.id}`, { reason: req.body.reason }); res.json({ ok: true });
});
r.put('/users/:id/permissions', perm('admins'), validate(z.object({ permissions: z.array(z.enum(PERMS)) })), (req, res) => {
  if (!isSuper(req.user)) return res.status(403).json({ error: 'Super admin only' });
  run("UPDATE users SET permissions=? WHERE id=? AND role='admin' AND permissions NOT LIKE '%*%'", JSON.stringify(req.body.permissions), req.params.id); audit(req, 'admin.permissions', `user:${req.params.id}`, req.body); res.json({ ok: true });
});

// documents / provider applications
r.get('/documents', perm('documents'), (req, res) => res.json(all(`SELECT d.id,d.type,d.status,d.note,d.created_at,u.id user_id,u.name,u.email,u.role,COALESCE(p.business_name,u.name) label FROM documents d JOIN users u ON u.id=d.user_id LEFT JOIN profiles p ON p.user_id=u.id WHERE (?1 IS NULL OR d.status=?1) ORDER BY d.id DESC LIMIT 300`, req.query.status ?? null)));
r.patch('/documents/:id', perm('documents'), validate(z.object({ status: z.enum(['approved', 'rejected']), note: z.string().max(300).optional() })), (req, res) => {
  const d = one('SELECT * FROM documents WHERE id=?', req.params.id); if (!d) return res.status(404).json({ error: 'Not found' });
  run('UPDATE documents SET status=?, note=? WHERE id=?', req.body.status, req.body.note ?? null, d.id);
  notify(d.user_id, `Document ${req.body.status}`, req.body.note || `${d.type} was ${req.body.status}.`); audit(req, 'admin.document_' + req.body.status, `document:${d.id}`); res.json({ ok: true });
});

// plans, commissions, subscriptions
const plan = z.object({ name: z.string().min(2), role: z.enum(['shop', 'technician']), price: z.number().min(0), interval_days: z.number().int().min(1), commission_pct: z.number().min(0).max(100), active: z.boolean().optional() });
r.get('/plans', perm('billing'), (req, res) => res.json(all('SELECT * FROM plans ORDER BY role,price')));
r.post('/plans', perm('billing'), validate(plan), (req, res) => { const b = req.body; run('INSERT INTO plans(name,role,price,interval_days,commission_pct) VALUES(?,?,?,?,?)', b.name, b.role, b.price, b.interval_days, b.commission_pct); audit(req, 'admin.plan_create', b.name); res.status(201).json({ ok: true }); });
r.put('/plans/:id', perm('billing'), validate(plan.partial()), (req, res) => { const b = req.body; run('UPDATE plans SET name=COALESCE(?,name),price=COALESCE(?,price),interval_days=COALESCE(?,interval_days),commission_pct=COALESCE(?,commission_pct),active=COALESCE(?,active) WHERE id=?', b.name ?? null, b.price ?? null, b.interval_days ?? null, b.commission_pct ?? null, b.active == null ? null : +b.active, req.params.id); audit(req, 'admin.plan_update', `plan:${req.params.id}`, b); res.json({ ok: true }); });
r.get('/subscriptions', perm('billing'), (req, res) => res.json(all('SELECT s.*,u.name,u.email,p.name plan FROM subscriptions s JOIN users u ON u.id=s.user_id JOIN plans p ON p.id=s.plan_id ORDER BY s.id DESC LIMIT 300')));
r.patch('/subscriptions/:id', perm('billing'), validate(z.object({ status: z.enum(['active', 'cancelled']).optional(), extendDays: z.number().int().min(1).max(365).optional() })), (req, res) => {
  const b = req.body; run('UPDATE subscriptions SET status=COALESCE(?,status), expires_at=expires_at+? WHERE id=?', b.status ?? null, (b.extendDays ?? 0) * 86400, req.params.id); audit(req, 'admin.subscription_edit', `subscription:${req.params.id}`, b); res.json({ ok: true });
});

// settings & platform fees
r.get('/settings', perm('settings'), (req, res) => res.json(Object.fromEntries(all('SELECT * FROM settings').map((x) => [x.key, x.value]))));
r.put('/settings', perm('settings'), validate(z.object({ platform_fee_pct: z.number().min(0).max(50).optional(), default_commission_pct: z.number().min(0).max(100).optional(), maintenance: z.boolean().optional(), terms: z.string().max(20000).optional() })), (req, res) => {
  for (const [k, v] of Object.entries(req.body)) run('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, String(typeof v === 'boolean' ? +v : v));
  audit(req, 'admin.settings', null, req.body); res.json({ ok: true });
});

// categories
r.get('/categories', perm('content'), (req, res) => res.json(all('SELECT * FROM categories ORDER BY kind,name')));
r.post('/categories', perm('content'), validate(z.object({ name: z.string().min(2).max(60), kind: z.enum(['device', 'repair']) })), (req, res) => { run('INSERT INTO categories(name,kind) VALUES(?,?)', req.body.name, req.body.kind); res.status(201).json({ ok: true }); });
r.patch('/categories/:id', perm('content'), validate(z.object({ active: z.boolean() })), (req, res) => { run('UPDATE categories SET active=? WHERE id=?', +req.body.active, req.params.id); res.json({ ok: true }); });
r.delete('/categories/:id', perm('content'), (req, res) => { run('DELETE FROM categories WHERE id=?', req.params.id); res.json({ ok: true }); });

// announcements
r.post('/announcements', perm('content'), validate(z.object({ title: z.string().min(2).max(100), body: z.string().min(2).max(1000), audience: z.enum(['all', 'client', 'shop', 'technician']) })), (req, res) => {
  const b = req.body; run('INSERT INTO announcements(title,body,audience) VALUES(?,?,?)', b.title, b.body, b.audience);
  for (const u of all("SELECT id FROM users WHERE status='active' AND (?='all' OR role=?)", b.audience, b.audience)) notify(u.id, b.title, b.body);
  audit(req, 'admin.announcement', b.title); res.status(201).json({ ok: true });
});

// bookings, payments, refunds, payouts, disputes
r.get('/payments', perm('finance'), (req, res) => res.json(all('SELECT p.*,u.name payer FROM payments p JOIN users u ON u.id=p.payer_id ORDER BY p.id DESC LIMIT 300')));
r.post('/payments/:id/refund', perm('finance'), (req, res) => {
  const p = one("SELECT * FROM payments WHERE id=? AND status='paid'", req.params.id); if (!p) return res.status(400).json({ error: 'Not refundable' });
  run("UPDATE payments SET status='refunded' WHERE id=?", p.id); if (p.booking_id) run("UPDATE bookings SET payment_status='refunded' WHERE id=?", p.booking_id);
  notify(p.payer_id, 'Refund processed', `₱${p.amount}`); audit(req, 'admin.refund', `payment:${p.id}`, { amount: p.amount }); res.json({ ok: true });
});
r.get('/payouts', perm('finance'), (req, res) => res.json(all("SELECT p.provider_id id,u.name,COUNT(*) jobs,SUM(p.amount-p.platform_fee-p.commission) owed FROM payments p JOIN users u ON u.id=p.provider_id WHERE p.kind='booking' AND p.status='paid' AND p.payout_status='pending' GROUP BY p.provider_id")));
r.post('/payouts/:providerId', perm('finance'), (req, res) => { const n = run("UPDATE payments SET payout_status='paid' WHERE provider_id=? AND kind='booking' AND status='paid' AND payout_status='pending'", req.params.providerId).changes; audit(req, 'admin.payout', `user:${req.params.providerId}`, { payments: n }); res.json({ paidOut: n }); });
r.get('/reports/financial', perm('finance'), (req, res) => {
  const from = +req.query.from || 0, to = +req.query.to || now();
  res.json(one(`SELECT COALESCE(SUM(CASE WHEN kind='booking' AND status='paid' THEN amount END),0) booking_volume, COALESCE(SUM(CASE WHEN kind='booking' AND status='paid' THEN commission END),0) commissions,
    COALESCE(SUM(CASE WHEN kind='booking' AND status='paid' THEN platform_fee END),0) platform_fees, COALESCE(SUM(CASE WHEN kind='subscription' THEN amount END),0) subscriptions,
    COALESCE(SUM(CASE WHEN status='refunded' THEN amount END),0) refunds FROM payments WHERE created_at BETWEEN ? AND ?`, from, to));
});
r.get('/disputes', perm('reports'), (req, res) => res.json(all('SELECT r.*,a.name reporter,b.name target FROM reports r JOIN users a ON a.id=r.reporter_id JOIN users b ON b.id=r.target_id ORDER BY (r.status IN (\'open\',\'appeal\')) DESC, r.id DESC LIMIT 300')));
r.patch('/disputes/:id', perm('reports'), validate(z.object({ status: z.enum(['resolved', 'dismissed']), resolution: z.string().max(500), suspendTarget: z.boolean().optional() })), (req, res) => {
  const d = one('SELECT * FROM reports WHERE id=?', req.params.id); if (!d) return res.status(404).json({ error: 'Not found' });
  run('UPDATE reports SET status=?, resolution=? WHERE id=?', req.body.status, req.body.resolution, d.id);
  if (req.body.suspendTarget) { run("UPDATE users SET status='suspended', token_version=token_version+1 WHERE id=? AND role!='admin'", d.target_id); notify(d.target_id, 'Account suspended', req.body.resolution + ' You can appeal from the Reports page.'); }
  notify(d.reporter_id, 'Report ' + req.body.status, req.body.resolution); audit(req, 'admin.dispute_' + req.body.status, `report:${d.id}`); res.json({ ok: true });
});

// audit & security
r.get('/audit', perm('reports'), (req, res) => res.json(all('SELECT a.*,u.name actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 300')));
r.get('/security-alerts', perm('reports'), (req, res) => res.json(all("SELECT a.*,u.email FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id WHERE a.action LIKE 'security.%' ORDER BY a.id DESC LIMIT 100")));

export default r;
