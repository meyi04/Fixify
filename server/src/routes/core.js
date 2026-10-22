import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { all, one, run, setting } from '../db.js';
import { auth, role, validate, audit, notify } from '../mw.js';

const r = Router();
const now = () => Math.floor(Date.now() / 1000);
const MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };
const uploader = (dir, types) => multer({
  storage: multer.diskStorage({ destination: `uploads/${dir}`, filename: (q, f, cb) => cb(null, crypto.randomUUID() + MIME[f.mimetype]) }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (q, f, cb) => (types.includes(f.mimetype) ? cb(null, true) : cb(new Error('File type not allowed'))),
});
const IMG = ['image/jpeg', 'image/png', 'image/webp'];
const pub = uploader('public', IMG), priv = uploader('private', [...IMG, 'application/pdf']);
const isProvider = (u) => u.role === 'shop' || u.role === 'technician';
const activeSub = (uid) => one('SELECT s.*, p.commission_pct FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? AND s.status=\'active\' AND s.expires_at>? ORDER BY s.expires_at DESC', uid, now());
const approved = (uid) => !!one("SELECT 1 FROM documents WHERE user_id=? AND status='approved'", uid);
const ownerOf = (u) => (u.role === 'technician' && u.shop_id ? u.shop_id : u.id); // employees act for their shop

// ---------- uploads ----------
r.post('/uploads/photo', auth, pub.single('file'), (req, res) => res.json({ url: `/uploads/public/${req.file.filename}` }));

// ---------- profile ----------
const profileSchema = z.object({
  name: z.string().min(2).max(80).optional(), phone: z.string().max(20).optional(),
  business_name: z.string().max(100).optional(), bio: z.string().max(1000).optional(), address: z.string().max(200).optional(),
  city: z.string().max(80).optional(), lat: z.number().min(-90).max(90).nullable().optional(), lng: z.number().min(-180).max(180).nullable().optional(),
  specialties: z.string().max(300).optional(), supported_devices: z.string().max(300).optional(),
  service_radius_km: z.number().min(0).max(500).optional(), capacity: z.number().int().min(1).max(200).optional(),
  service_areas: z.string().max(300).optional(), warranty_terms: z.string().max(500).optional(),
  working_hours: z.record(z.array(z.string()).length(2)).optional(), // {mon:["09:00","18:00"]}
});
r.get('/profile', auth, (req, res) => {
  const p = one('SELECT * FROM profiles WHERE user_id=?', req.user.id) || {};
  res.json({ ...p, name: req.user.name, phone: req.user.phone, email: req.user.email, avatar: req.user.avatar, role: req.user.role,
    working_hours: JSON.parse(p.working_hours || '{}'), gallery: JSON.parse(p.gallery || '[]'), documents: all('SELECT id,type,status,note,created_at FROM documents WHERE user_id=?', req.user.id), approved: approved(req.user.id) });
});
r.put('/profile', auth, validate(profileSchema), (req, res) => {
  const { name, phone, working_hours, ...rest } = req.body;
  if (name || phone !== undefined) run('UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone) WHERE id=?', name ?? null, phone ?? null, req.user.id);
  const cols = Object.keys(rest);
  if (working_hours) { rest.working_hours = JSON.stringify(working_hours); cols.push('working_hours'); }
  if (cols.length) run(`UPDATE profiles SET ${cols.map((c) => c + '=?').join(',')} WHERE user_id=?`, ...cols.map((c) => rest[c]), req.user.id); // column names come from the zod whitelist
  audit(req, 'profile.update', `user:${req.user.id}`);
  res.json({ ok: true });
});
r.post('/profile/avatar', auth, pub.single('file'), (req, res) => {
  run('UPDATE users SET avatar=? WHERE id=?', `/uploads/public/${req.file.filename}`, req.user.id);
  res.json({ avatar: `/uploads/public/${req.file.filename}` });
});
r.post('/profile/gallery', auth, role('shop', 'technician'), pub.single('file'), (req, res) => {
  const p = one('SELECT gallery FROM profiles WHERE user_id=?', req.user.id);
  const g = JSON.parse(p.gallery || '[]'); if (g.length >= 12) return res.status(400).json({ error: 'Gallery is full (12 images)' });
  g.push(`/uploads/public/${req.file.filename}`);
  run('UPDATE profiles SET gallery=? WHERE user_id=?', JSON.stringify(g), req.user.id); res.json({ gallery: g });
});
r.delete('/profile/gallery', auth, role('shop', 'technician'), (req, res) => {
  const p = one('SELECT gallery FROM profiles WHERE user_id=?', req.user.id);
  run('UPDATE profiles SET gallery=? WHERE user_id=?', JSON.stringify(JSON.parse(p.gallery).filter((x) => x !== req.query.url)), req.user.id); res.json({ ok: true });
});

// ---------- documents (private) ----------
r.post('/documents', auth, role('shop', 'technician'), priv.single('file'), (req, res) => {
  const type = z.string().min(2).max(60).parse(req.body.type || 'permit');
  run('INSERT INTO documents(user_id,type,file) VALUES(?,?,?)', req.user.id, type, req.file.filename);
  notify(req.user.id, 'Document submitted', `${type} is waiting for administrator review.`);
  res.status(201).json({ ok: true });
});
r.get('/documents/:id/file', auth, (req, res) => {
  const d = one('SELECT * FROM documents WHERE id=?', req.params.id);
  if (!d || (d.user_id !== req.user.id && req.user.role !== 'admin')) return res.status(404).end();
  res.sendFile(path.resolve('uploads/private', path.basename(d.file)));
});
r.delete('/documents/:id', auth, role('shop', 'technician'), (req, res) => {
  const d = one("SELECT * FROM documents WHERE id=? AND user_id=? AND status!='approved'", req.params.id, req.user.id);
  if (d) { fs.rmSync(path.resolve('uploads/private', path.basename(d.file)), { force: true }); run('DELETE FROM documents WHERE id=?', d.id); }
  res.json({ ok: true });
});

// ---------- categories & browse ----------
r.get('/categories', (req, res) => res.json(all('SELECT * FROM categories WHERE active=1 ORDER BY kind,name')));
const km = (a, b, c, d) => { const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t; const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
r.get('/providers', auth, (req, res) => {
  const { q, type, device, repair, city, minPrice, maxPrice, minRating, date, lat, lng } = req.query;
  let rows = all(`SELECT u.id,u.role,u.name,u.avatar,p.business_name,p.city,p.address,p.lat,p.lng,p.specialties,p.supported_devices,p.service_radius_km,p.working_hours,p.capacity,
    (SELECT AVG(rating) FROM reviews WHERE provider_id=u.id) rating,(SELECT COUNT(*) FROM reviews WHERE provider_id=u.id) reviews,
    (SELECT MIN(price) FROM services WHERE provider_id=u.id AND active=1) min_price
    FROM users u JOIN profiles p ON p.user_id=u.id
    WHERE u.status='active' AND u.shop_id IS NULL AND u.role IN ('shop','technician')
    AND EXISTS(SELECT 1 FROM documents d WHERE d.user_id=u.id AND d.status='approved')`);
  const like = (s, t) => (s || '').toLowerCase().includes(String(t).toLowerCase());
  rows = rows.filter((x) => {
    if (type && x.role !== type) return false;
    if (city && !like(x.city, city)) return false;
    if (device && !like(x.supported_devices, device) && !all('SELECT 1 FROM services WHERE provider_id=? AND device LIKE ?', x.id, `%${device}%`).length) return false;
    if (repair && !like(x.specialties, repair) && !all('SELECT 1 FROM services WHERE provider_id=? AND (repair_type LIKE ? OR title LIKE ?)', x.id, `%${repair}%`, `%${repair}%`).length) return false;
    if (q && ![x.name, x.business_name, x.specialties, x.supported_devices].some((f) => like(f, q))) return false;
    if (minRating && (x.rating || 0) < +minRating) return false;
    if (minPrice && (x.min_price ?? Infinity) < +minPrice) return false;
    if (maxPrice && (x.min_price ?? Infinity) > +maxPrice) return false;
    if (date) { // availability: works that weekday and still under daily capacity
      const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(date + 'T12:00:00').getDay()];
      if (!JSON.parse(x.working_hours || '{}')[day]) return false;
      const s = Math.floor(new Date(date + 'T00:00:00').getTime() / 1000);
      if (one("SELECT COUNT(*) c FROM bookings WHERE provider_id=? AND scheduled_at BETWEEN ? AND ? AND status IN ('requested','accepted','in_progress')", x.id, s, s + 86399).c >= x.capacity) return false;
    }
    return true;
  }).map((x) => ({ ...x, working_hours: JSON.parse(x.working_hours || '{}'), rating: x.rating ? +x.rating.toFixed(1) : null, distance_km: lat && lng && x.lat != null ? +km(+lat, +lng, x.lat, x.lng).toFixed(1) : null }));
  rows.sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9) || (b.rating || 0) - (a.rating || 0));
  res.json(rows);
});
r.get('/providers/:id', auth, (req, res) => {
  const u = one("SELECT id,role,name,avatar FROM users WHERE id=? AND status='active' AND role IN ('shop','technician')", req.params.id);
  if (!u || !approved(u.id)) return res.status(404).json({ error: 'Provider not found' });
  const p = one('SELECT business_name,bio,address,city,lat,lng,specialties,supported_devices,service_radius_km,working_hours,capacity,service_areas,warranty_terms,gallery FROM profiles WHERE user_id=?', u.id);
  res.json({ ...u, ...p, working_hours: JSON.parse(p.working_hours || '{}'), gallery: JSON.parse(p.gallery || '[]'),
    services: all('SELECT * FROM services WHERE provider_id=? AND active=1', u.id),
    technicians: u.role === 'shop' ? all("SELECT u.id,u.name,u.avatar,p.specialties FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.shop_id=? AND u.status='active'", u.id) : [],
    reviews: all('SELECT r.rating,r.comment,r.created_at,c.name client FROM reviews r JOIN users c ON c.id=r.client_id WHERE r.provider_id=? ORDER BY r.id DESC LIMIT 30', u.id),
    verified: true });
});

// ---------- service catalog ----------
const svc = z.object({ title: z.string().min(2).max(100), device: z.string().max(60).optional(), repair_type: z.string().max(60).optional(), price: z.number().min(0).max(1e6), duration_min: z.number().int().min(5).max(10080).optional(), active: z.boolean().optional() });
r.get('/services', auth, role('shop', 'technician'), (req, res) => res.json(all('SELECT * FROM services WHERE provider_id=?', ownerOf(req.user))));
r.post('/services', auth, role('shop', 'technician'), validate(svc), (req, res) => {
  if (req.user.shop_id) return res.status(403).json({ error: 'Only the shop owner manages the catalog' });
  const b = req.body; run('INSERT INTO services(provider_id,title,device,repair_type,price,duration_min) VALUES(?,?,?,?,?,?)', req.user.id, b.title, b.device ?? null, b.repair_type ?? null, b.price, b.duration_min ?? 60); res.status(201).json({ ok: true });
});
r.put('/services/:id', auth, role('shop', 'technician'), validate(svc.partial()), (req, res) => {
  const b = req.body; run('UPDATE services SET title=COALESCE(?,title),device=COALESCE(?,device),repair_type=COALESCE(?,repair_type),price=COALESCE(?,price),duration_min=COALESCE(?,duration_min),active=COALESCE(?,active) WHERE id=? AND provider_id=?',
    b.title ?? null, b.device ?? null, b.repair_type ?? null, b.price ?? null, b.duration_min ?? null, b.active == null ? null : +b.active, req.params.id, req.user.id); res.json({ ok: true });
});
r.delete('/services/:id', auth, role('shop', 'technician'), (req, res) => { run('DELETE FROM services WHERE id=? AND provider_id=?', req.params.id, req.user.id); res.json({ ok: true }); });

// ---------- staff (shop employees) ----------
import bcrypt from 'bcryptjs';
r.get('/staff', auth, role('shop'), (req, res) => res.json(all("SELECT u.id,u.name,u.email,u.status,u.avatar,p.specialties FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.shop_id=?", req.user.id)));
r.post('/staff', auth, role('shop'), validate(z.object({ name: z.string().min(2).max(80), email: z.string().email().transform((s) => s.toLowerCase()), password: z.string().min(10).max(72).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/), specialties: z.string().max(300).optional() })), (req, res) => {
  const b = req.body; if (one('SELECT 1 FROM users WHERE email=?', b.email)) return res.status(409).json({ error: 'Email already in use' });
  const id = run("INSERT INTO users(role,email,password_hash,name,status,shop_id) VALUES('technician',?,?,?,'active',?)", b.email, bcrypt.hashSync(b.password, 12), b.name, req.user.id).lastInsertRowid;
  run('INSERT INTO profiles(user_id,specialties) VALUES(?,?)', id, b.specialties ?? ''); audit(req, 'staff.create', `user:${id}`); res.status(201).json({ ok: true });
});
r.patch('/staff/:id', auth, role('shop'), validate(z.object({ status: z.enum(['active', 'suspended']) })), (req, res) => { run('UPDATE users SET status=?, token_version=token_version+1 WHERE id=? AND shop_id=?', req.body.status, req.params.id, req.user.id); res.json({ ok: true }); });

// ---------- bookings ----------
const parse = (b) => ({ ...b, photos: JSON.parse(b.photos || '[]'), parts: JSON.parse(b.parts || '[]'), progress: JSON.parse(b.progress || '[]') });
const BASE = `SELECT b.*, c.name client_name, c.phone client_phone, pr.name provider_name, COALESCE(pp.business_name, pr.name) provider_label, t.name technician_name,
  (SELECT 1 FROM reviews WHERE booking_id=b.id) reviewed FROM bookings b JOIN users c ON c.id=b.client_id JOIN users pr ON pr.id=b.provider_id
  LEFT JOIN profiles pp ON pp.user_id=pr.id LEFT JOIN users t ON t.id=b.technician_id`;
const canSee = (u, b) => u.role === 'admin' || b.client_id === u.id || b.provider_id === u.id || b.technician_id === u.id || (u.role === 'technician' && u.shop_id === b.provider_id && b.technician_id === u.id);
r.get('/bookings', auth, (req, res) => {
  const u = req.user; let where = '1=0', args = [];
  if (u.role === 'client') [where, args] = ['b.client_id=?', [u.id]];
  else if (u.role === 'shop' || (u.role === 'technician' && !u.shop_id)) [where, args] = ['b.provider_id=?', [u.id]];
  else if (u.role === 'technician') [where, args] = ['b.technician_id=?', [u.id]];
  else if (u.role === 'admin') where = '1=1';
  const { status } = req.query; if (status) { where += ' AND b.status=?'; args.push(status); }
  res.json(all(`${BASE} WHERE ${where} ORDER BY b.scheduled_at DESC LIMIT 300`, ...args).map(parse));
});
r.get('/bookings/:id', auth, (req, res) => { const b = one(`${BASE} WHERE b.id=?`, req.params.id); if (!b || !canSee(req.user, b)) return res.status(404).json({ error: 'Not found' }); res.json(parse(b)); });
r.post('/bookings', auth, role('client'), validate(z.object({
  providerId: z.number().int(), technicianId: z.number().int().optional(), serviceId: z.number().int().optional(),
  device: z.string().min(2).max(80), issue: z.string().min(5).max(1000), scheduledAt: z.number().int(), photos: z.array(z.string().regex(/^\/uploads\/public\/[\w-]+\.(jpg|png|webp)$/)).max(6).optional(),
})), (req, res) => {
  const b = req.body;
  if (setting('maintenance') === '1') return res.status(503).json({ error: 'Platform is under maintenance' });
  const prov = one("SELECT * FROM users WHERE id=? AND status='active' AND role IN ('shop','technician') AND shop_id IS NULL", b.providerId);
  if (!prov || !approved(prov.id)) return res.status(400).json({ error: 'Provider is not available' });
  if (!activeSub(prov.id)) return res.status(400).json({ error: 'This provider is not accepting bookings right now' });
  if (b.scheduledAt < now()) return res.status(400).json({ error: 'Pick a future time' });
  if (b.technicianId && !one("SELECT 1 FROM users WHERE id=? AND shop_id=? AND status='active'", b.technicianId, prov.id)) return res.status(400).json({ error: 'Technician does not work at this shop' });
  const day = Math.floor(b.scheduledAt / 86400) * 86400;
  const cap = one('SELECT capacity FROM profiles WHERE user_id=?', prov.id).capacity;
  if (one("SELECT COUNT(*) c FROM bookings WHERE provider_id=? AND scheduled_at BETWEEN ? AND ? AND status IN ('requested','accepted','in_progress')", prov.id, day, day + 86399).c >= cap) return res.status(400).json({ error: 'Fully booked that day' });
  let est = null; if (b.serviceId) est = one('SELECT price FROM services WHERE id=? AND provider_id=?', b.serviceId, prov.id)?.price ?? null;
  const id = run('INSERT INTO bookings(client_id,provider_id,technician_id,service_id,device,issue,photos,scheduled_at,estimate) VALUES(?,?,?,?,?,?,?,?,?)',
    req.user.id, prov.id, b.technicianId ?? null, b.serviceId ?? null, b.device, b.issue, JSON.stringify(b.photos ?? []), b.scheduledAt, est).lastInsertRowid;
  notify(prov.id, 'New booking request', `${req.user.name}: ${b.device}`); if (b.technicianId) notify(b.technicianId, 'New job requested for you', b.device);
  res.status(201).json({ id });
});

const actionSchema = z.object({ action: z.enum(['accept', 'reject', 'reschedule', 'assign', 'start', 'update', 'complete', 'cancel', 'pay']), scheduledAt: z.number().int().optional(), technicianId: z.number().int().nullable().optional(),
  estimate: z.number().min(0).optional(), parts: z.array(z.object({ name: z.string().max(80), cost: z.number().min(0) })).max(30).optional(), note: z.string().max(500).optional(), result: z.string().max(1000).optional(), warrantyDays: z.number().int().min(0).max(1095).optional(), total: z.number().min(0).max(1e6).optional() });
r.post('/bookings/:id/action', auth, validate(actionSchema), (req, res) => {
  const u = req.user, b = one('SELECT * FROM bookings WHERE id=?', req.params.id), a = req.body;
  if (!b || !canSee(u, b)) return res.status(404).json({ error: 'Not found' });
  const isOwner = b.provider_id === u.id, isAssigned = b.technician_id === u.id, isClient = b.client_id === u.id;
  const fail = (m, c = 400) => res.status(c).json({ error: m });
  const upd = (sql, ...args) => run(`UPDATE bookings SET ${sql}, updated_at=? WHERE id=?`, ...args, now(), b.id);
  const log = (t) => { const p = JSON.parse(b.progress || '[]'); p.push({ t: now(), text: t }); return JSON.stringify(p); };
  switch (a.action) {
    case 'accept': case 'reject': case 'reschedule': case 'assign':
      if (!isOwner) return fail('Only the provider can do that', 403);
      if (a.action === 'accept') { if (b.status !== 'requested') return fail('Already handled'); if (!activeSub(u.id)) return fail('Subscribe to accept bookings'); upd('status=?, progress=?', 'accepted', log('Booking accepted')); notify(b.client_id, 'Booking accepted', 'Your repair request was accepted.'); }
      if (a.action === 'reject') { if (!['requested', 'accepted'].includes(b.status)) return fail('Cannot reject now'); upd('status=?, progress=?', 'rejected', log('Rejected' + (a.note ? ': ' + a.note : ''))); notify(b.client_id, 'Booking declined', a.note || 'The provider cannot take this job.'); }
      if (a.action === 'reschedule') { if (!a.scheduledAt || a.scheduledAt < now()) return fail('Pick a future time'); upd('scheduled_at=?, progress=?', a.scheduledAt, log('Rescheduled')); notify(b.client_id, 'Booking rescheduled', 'The provider proposed a new time. Open your booking.'); }
      if (a.action === 'assign') { if (u.role !== 'shop') return fail('Only shops assign staff'); if (a.technicianId && !one("SELECT 1 FROM users WHERE id=? AND shop_id=? AND status='active'", a.technicianId, u.id)) return fail('Not your staff'); upd('technician_id=?, progress=?', a.technicianId ?? null, log('Technician assigned')); if (a.technicianId) notify(a.technicianId, 'Job assigned to you', `Booking #${b.id}`); }
      break;
    case 'start':
      if (!(isOwner || isAssigned)) return fail('Not allowed', 403); if (b.status !== 'accepted') return fail('Booking must be accepted first');
      upd('status=?, progress=?', 'in_progress', log('Repair started')); notify(b.client_id, 'Repair started', `Booking #${b.id} is in progress.`); break;
    case 'update':
      if (!(isOwner || isAssigned)) return fail('Not allowed', 403); if (!['accepted', 'in_progress'].includes(b.status)) return fail('Booking is closed');
      upd('estimate=COALESCE(?,estimate), parts=COALESCE(?,parts), progress=?', a.estimate ?? null, a.parts ? JSON.stringify(a.parts) : null, log(a.note || 'Estimate updated')); notify(b.client_id, 'Repair update', a.note || 'The estimate or parts were updated.'); break;
    case 'complete': {
      if (!(isOwner || isAssigned)) return fail('Not allowed', 403); if (b.status !== 'in_progress') return fail('Start the repair first');
      const total = a.total ?? b.estimate; if (total == null) return fail('Enter the final total');
      const wd = a.warrantyDays ?? 0;
      upd('status=?, total=?, result=?, warranty_days=?, warranty_until=?, progress=?', 'completed', total, a.result ?? null, wd, wd ? now() + wd * 86400 : null, log('Repair completed'));
      notify(b.client_id, 'Repair completed', `Total ₱${total}. Please pay and rate the service.`); break; }
    case 'cancel':
      if (!isClient) return fail('Only the client can cancel', 403); if (!['requested', 'accepted'].includes(b.status)) return fail('Too late to cancel');
      upd('status=?, progress=?', 'cancelled', log('Cancelled by client')); notify(b.provider_id, 'Booking cancelled', `Booking #${b.id}`); break;
    case 'pay': { // payment gateway hook: replace the simulated charge with PayMongo/Stripe/GCash and confirm via webhook
      if (!isClient) return fail('Only the client can pay', 403); if (b.status !== 'completed' || b.payment_status === 'paid') return fail('Nothing to pay');
      const sub = activeSub(b.provider_id), pct = sub?.commission_pct ?? +setting('default_commission_pct', 10), fee = +(b.total * +setting('platform_fee_pct', 2) / 100).toFixed(2);
      run("INSERT INTO payments(kind,booking_id,payer_id,provider_id,amount,platform_fee,commission) VALUES('booking',?,?,?,?,?,?)", b.id, u.id, b.provider_id, b.total + fee, fee, +(b.total * pct / 100).toFixed(2));
      upd("payment_status='paid'"); notify(b.provider_id, 'Payment received', `Booking #${b.id}: ₱${b.total}`); break; }
  }
  audit(req, 'booking.' + a.action, `booking:${b.id}`); res.json(parse(one(`${BASE} WHERE b.id=?`, b.id)));
});

// ---------- messages ----------
r.get('/messages/threads', auth, (req, res) => {
  const id = req.user.id;
  res.json(all(`SELECT u.id,u.name,u.avatar,u.role,m.body last,m.created_at at,(SELECT COUNT(*) FROM messages WHERE sender_id=u.id AND receiver_id=? AND read=0) unread
    FROM users u JOIN messages m ON m.id=(SELECT MAX(id) FROM messages WHERE (sender_id=? AND receiver_id=u.id) OR (sender_id=u.id AND receiver_id=?))
    WHERE u.id!=? ORDER BY m.id DESC`, id, id, id, id));
});
r.get('/messages/:uid', auth, (req, res) => {
  const me = req.user.id, o = +req.params.uid;
  run('UPDATE messages SET read=1 WHERE sender_id=? AND receiver_id=?', o, me);
  res.json({ with: one('SELECT id,name,avatar,role FROM users WHERE id=?', o), messages: all('SELECT * FROM messages WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?) ORDER BY id LIMIT 500', me, o, o, me) });
});
r.post('/messages', auth, validate(z.object({ to: z.number().int(), body: z.string().min(1).max(2000), bookingId: z.number().int().optional() })), (req, res) => {
  const to = one("SELECT id,role,status FROM users WHERE id=? AND status='active'", req.body.to), me = req.user;
  if (!to || to.id === me.id) return res.status(400).json({ error: 'Recipient not available' });
  const pair = [me.role, to.role]; const ok = pair.includes('admin') || (pair.includes('client') && (pair.includes('shop') || pair.includes('technician')));
  if (!ok) return res.status(403).json({ error: 'You can only chat between clients and providers' });
  run('INSERT INTO messages(sender_id,receiver_id,booking_id,body) VALUES(?,?,?,?)', me.id, to.id, req.body.bookingId ?? null, req.body.body);
  notify(to.id, 'New message', `${me.name}: ${req.body.body.slice(0, 80)}`); res.status(201).json({ ok: true });
});

// ---------- notifications, reviews, reports ----------
r.get('/notifications', auth, (req, res) => res.json(all('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100', req.user.id)));
r.post('/notifications/read', auth, (req, res) => { run('UPDATE notifications SET read=1 WHERE user_id=?', req.user.id); res.json({ ok: true }); });
r.post('/reviews', auth, role('client'), validate(z.object({ bookingId: z.number().int(), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() })), (req, res) => {
  const b = one("SELECT * FROM bookings WHERE id=? AND client_id=? AND status='completed'", req.body.bookingId, req.user.id);
  if (!b) return res.status(400).json({ error: 'Only completed bookings can be rated' });
  if (one('SELECT 1 FROM reviews WHERE booking_id=?', b.id)) return res.status(409).json({ error: 'Already rated' });
  run('INSERT INTO reviews(booking_id,client_id,provider_id,rating,comment) VALUES(?,?,?,?,?)', b.id, req.user.id, b.provider_id, req.body.rating, req.body.comment ?? null);
  notify(b.provider_id, 'New review', `${req.body.rating}★ from ${req.user.name}`); res.status(201).json({ ok: true });
});
r.post('/reports', auth, validate(z.object({ targetId: z.number().int(), bookingId: z.number().int().optional(), reason: z.string().min(5).max(1000) })), (req, res) => {
  run('INSERT INTO reports(reporter_id,target_id,booking_id,reason) VALUES(?,?,?,?)', req.user.id, req.body.targetId, req.body.bookingId ?? null, req.body.reason); res.status(201).json({ ok: true });
});
r.get('/reports/mine', auth, (req, res) => res.json(all('SELECT * FROM reports WHERE reporter_id=? OR target_id=? ORDER BY id DESC', req.user.id, req.user.id)));
r.post('/reports/:id/appeal', auth, validate(z.object({ text: z.string().min(5).max(1000) })), (req, res) => {
  run("UPDATE reports SET status='appeal', appeal_text=? WHERE id=? AND target_id=? AND status='resolved'", req.body.text, req.params.id, req.user.id); res.json({ ok: true });
});

// ---------- plans, subscription, earnings, payments ----------
r.get('/plans', auth, role('shop', 'technician'), (req, res) => res.json(all('SELECT * FROM plans WHERE role=? AND active=1', req.user.role)));
r.get('/subscription', auth, role('shop', 'technician'), (req, res) => res.json(activeSub(ownerOf(req.user)) || null));
r.post('/subscribe', auth, role('shop', 'technician'), validate(z.object({ planId: z.number().int() })), (req, res) => { // replace the simulated charge with a real gateway + webhook
  if (req.user.shop_id) return res.status(403).json({ error: 'Owner only' });
  const p = one('SELECT * FROM plans WHERE id=? AND role=? AND active=1', req.body.planId, req.user.role); if (!p) return res.status(400).json({ error: 'Plan not available' });
  const cur = activeSub(req.user.id), start = cur ? cur.expires_at : now();
  run("UPDATE subscriptions SET status='replaced' WHERE user_id=? AND status='active'", req.user.id);
  run("INSERT INTO subscriptions(user_id,plan_id,started_at,expires_at) VALUES(?,?,?,?)", req.user.id, p.id, now(), start + p.interval_days * 86400);
  run("INSERT INTO payments(kind,payer_id,amount) VALUES('subscription',?,?)", req.user.id, p.price); notify(req.user.id, 'Subscription active', p.name); audit(req, 'subscription.buy', `plan:${p.id}`); res.json({ ok: true });
});
r.get('/earnings', auth, role('shop', 'technician'), (req, res) => {
  const id = ownerOf(req.user), rows = all("SELECT p.*, b.device FROM payments p JOIN bookings b ON b.id=p.booking_id WHERE p.provider_id=? AND p.kind='booking' ORDER BY p.id DESC", id);
  const paid = rows.filter((x) => x.status === 'paid'), gross = paid.reduce((s, x) => s + x.amount - x.platform_fee, 0), com = paid.reduce((s, x) => s + x.commission, 0);
  const byMonth = {}; paid.forEach((x) => { const k = new Date(x.created_at * 1000).toISOString().slice(0, 7); byMonth[k] = (byMonth[k] || 0) + x.amount - x.platform_fee - x.commission; });
  res.json({ gross, commission: com, net: gross - com, byMonth, payments: rows });
});
r.get('/payments', auth, role('client'), (req, res) => res.json(all("SELECT p.*, b.device FROM payments p JOIN bookings b ON b.id=p.booking_id WHERE p.payer_id=? ORDER BY p.id DESC", req.user.id)));
r.get('/announcements', auth, (req, res) => res.json(all("SELECT * FROM announcements WHERE audience IN ('all',?) ORDER BY id DESC LIMIT 20", req.user.role)));

// ---------- dashboards (one endpoint, shape depends on role) ----------
r.get('/dashboard', auth, (req, res) => {
  const u = req.user, c = (sql, ...a) => one(sql, ...a).n, id = ownerOf(u);
  if (u.role === 'client') return res.json({ cards: [
    { label: 'Active repairs', value: c("SELECT COUNT(*) n FROM bookings WHERE client_id=? AND status IN ('requested','accepted','in_progress')", u.id) },
    { label: 'Completed', value: c("SELECT COUNT(*) n FROM bookings WHERE client_id=? AND status='completed'", u.id) },
    { label: 'Active warranties', value: c('SELECT COUNT(*) n FROM bookings WHERE client_id=? AND warranty_until>?', u.id, now()) },
    { label: 'Unread messages', value: c('SELECT COUNT(*) n FROM messages WHERE receiver_id=? AND read=0', u.id) }] });
  if (u.role === 'admin') {
    const rev = all("SELECT strftime('%Y-%m',created_at,'unixepoch') k, SUM(CASE WHEN kind='subscription' THEN amount ELSE commission+platform_fee END) v FROM payments WHERE status='paid' GROUP BY k ORDER BY k DESC LIMIT 12").reverse();
    return res.json({ cards: [
      { label: 'Clients', value: c("SELECT COUNT(*) n FROM users WHERE role='client' AND status!='deleted'") }, { label: 'Shops', value: c("SELECT COUNT(*) n FROM users WHERE role='shop'") },
      { label: 'Technicians', value: c("SELECT COUNT(*) n FROM users WHERE role='technician'") }, { label: 'Bookings', value: c('SELECT COUNT(*) n FROM bookings') },
      { label: 'Pending documents', value: c("SELECT COUNT(*) n FROM documents WHERE status='pending'") }, { label: 'Open reports', value: c("SELECT COUNT(*) n FROM reports WHERE status IN ('open','appeal')") },
      { label: 'Platform revenue (₱)', value: Math.round(rev.reduce((s, x) => s + x.v, 0)) }, { label: 'Security alerts (7d)', value: c("SELECT COUNT(*) n FROM audit_logs WHERE action LIKE 'security.%' AND created_at>?", now() - 7 * 86400) }],
      chart: rev.map((x) => ({ label: x.k, value: Math.round(x.v) })), chartTitle: 'Platform revenue by month' });
  }
  const w = u.shop_id ? 'technician_id=?' : 'provider_id=?', wid = u.shop_id ? u.id : id;
  const e = u.shop_id ? { net: 0 } : null, sub = u.shop_id ? null : activeSub(id);
  res.json({ cards: [
    { label: 'New requests', value: c(`SELECT COUNT(*) n FROM bookings WHERE ${w} AND status='requested'`, wid) },
    { label: 'In progress', value: c(`SELECT COUNT(*) n FROM bookings WHERE ${w} AND status IN ('accepted','in_progress')`, wid) },
    { label: 'Completed', value: c(`SELECT COUNT(*) n FROM bookings WHERE ${w} AND status='completed'`, wid) },
    { label: 'Rating', value: one('SELECT ROUND(AVG(rating),1) a FROM reviews WHERE provider_id=?', id).a ?? '—' },
    ...(u.shop_id ? [] : [{ label: 'Subscription', value: sub ? 'Active' : 'Inactive' }, { label: 'Verification', value: approved(u.id) ? 'Approved' : 'Pending' }]) ] });
});

export default r;
