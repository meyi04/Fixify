import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';

fs.mkdirSync('uploads/public', { recursive: true });
fs.mkdirSync('uploads/private', { recursive: true });

export const db = new Database(process.env.DB_FILE || 'fixify.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('client','shop','technician','admin')),
  email TEXT UNIQUE NOT NULL, phone TEXT, password_hash TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT,
  status TEXT NOT NULL DEFAULT 'unverified', -- unverified | active | suspended | deleted
  shop_id INTEGER REFERENCES users(id),      -- set when a technician is an employee of a shop
  permissions TEXT DEFAULT '[]',             -- admin permissions, '*' = super admin
  code_hash TEXT, code_expires INTEGER, code_purpose TEXT, code_tries INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0, locked_until INTEGER DEFAULT 0, token_version INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now')));
CREATE TABLE IF NOT EXISTS profiles(
  user_id INTEGER PRIMARY KEY REFERENCES users(id), business_name TEXT, bio TEXT, address TEXT, city TEXT,
  lat REAL, lng REAL, specialties TEXT DEFAULT '', supported_devices TEXT DEFAULT '', service_radius_km REAL DEFAULT 10,
  working_hours TEXT DEFAULT '{}', capacity INTEGER DEFAULT 5, service_areas TEXT DEFAULT '', warranty_terms TEXT DEFAULT '',
  gallery TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS documents(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), type TEXT NOT NULL, file TEXT NOT NULL,
  status TEXT DEFAULT 'pending', note TEXT, created_at INTEGER DEFAULT (strftime('%s','now')));
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS services(
  id INTEGER PRIMARY KEY, provider_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, device TEXT,
  repair_type TEXT, price REAL NOT NULL, duration_min INTEGER DEFAULT 60, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS plans(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, price REAL NOT NULL, interval_days INTEGER DEFAULT 30,
  commission_pct REAL DEFAULT 10, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS subscriptions(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), plan_id INTEGER NOT NULL REFERENCES plans(id),
  status TEXT DEFAULT 'active', started_at INTEGER, expires_at INTEGER);
CREATE TABLE IF NOT EXISTS bookings(
  id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES users(id), provider_id INTEGER NOT NULL REFERENCES users(id),
  technician_id INTEGER REFERENCES users(id), service_id INTEGER, device TEXT NOT NULL, issue TEXT NOT NULL,
  photos TEXT DEFAULT '[]', scheduled_at INTEGER NOT NULL,
  status TEXT DEFAULT 'requested', -- requested accepted rejected in_progress completed cancelled
  estimate REAL, parts TEXT DEFAULT '[]', result TEXT, warranty_days INTEGER DEFAULT 0, warranty_until INTEGER,
  total REAL, payment_status TEXT DEFAULT 'unpaid', progress TEXT DEFAULT '[]',
  created_at INTEGER DEFAULT (strftime('%s','now')), updated_at INTEGER DEFAULT (strftime('%s','now')));
CREATE TABLE IF NOT EXISTS payments(
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL, booking_id INTEGER, payer_id INTEGER NOT NULL, provider_id INTEGER,
  amount REAL NOT NULL, platform_fee REAL DEFAULT 0, commission REAL DEFAULT 0, status TEXT DEFAULT 'paid',
  payout_status TEXT DEFAULT 'pending', created_at INTEGER DEFAULT (strftime('%s','now')));
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY, sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL, booking_id INTEGER, body TEXT NOT NULL,
  read INTEGER DEFAULT 0, created_at INTEGER DEFAULT (strftime('%s','now')));
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT, read INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now')));
CREATE TABLE IF NOT EXISTS reviews(
  id INTEGER PRIMARY KEY, booking_id INTEGER UNIQUE NOT NULL, client_id INTEGER NOT NULL, provider_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT, created_at INTEGER DEFAULT (strftime('%s','now')));
CREATE TABLE IF NOT EXISTS reports(
  id INTEGER PRIMARY KEY, reporter_id INTEGER NOT NULL, target_id INTEGER NOT NULL, booking_id INTEGER, reason TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- open resolved dismissed appeal
  resolution TEXT, appeal_text TEXT, created_at INTEGER DEFAULT (strftime('%s','now')));
CREATE TABLE IF NOT EXISTS audit_logs(
  id INTEGER PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL, target TEXT, meta TEXT, ip TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')));
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS announcements(id INTEGER PRIMARY KEY, title TEXT, body TEXT, audience TEXT, created_at INTEGER DEFAULT (strftime('%s','now')));
CREATE INDEX IF NOT EXISTS ix_book_client ON bookings(client_id); CREATE INDEX IF NOT EXISTS ix_book_provider ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS ix_msg ON messages(sender_id, receiver_id);
`);

const q = (sql, ...a) => db.prepare(sql).all(...a);
export const all = q;
export const one = (sql, ...a) => db.prepare(sql).get(...a);
export const run = (sql, ...a) => db.prepare(sql).run(...a);
export const setting = (k, d) => one('SELECT value FROM settings WHERE key=?', k)?.value ?? d;

// ---- seed ----
if (!one('SELECT 1 FROM settings LIMIT 1')) {
  for (const [k, v] of Object.entries({ platform_fee_pct: '2', default_commission_pct: '10', maintenance: '0', terms: 'Fixify terms of service.' }))
    run('INSERT INTO settings VALUES(?,?)', k, v);
  for (const n of ['Smartphone', 'Tablet', 'Laptop', 'Smartwatch', 'Game console']) run("INSERT INTO categories(name,kind) VALUES(?, 'device')", n);
  for (const n of ['Screen replacement', 'Battery replacement', 'Water damage', 'Charging port', 'Software / unlocking', 'Camera repair']) run("INSERT INTO categories(name,kind) VALUES(?, 'repair')", n);
  run("INSERT INTO plans(name,role,price,interval_days,commission_pct) VALUES('Shop Basic','shop',499,30,12),('Shop Pro','shop',999,30,8),('Technician Basic','technician',199,30,12),('Technician Pro','technician',399,30,8)");
}
if (!one("SELECT 1 FROM users WHERE role='admin'")) {
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const email = (process.env.ADMIN_EMAIL || 'admin@fixify.local').toLowerCase();
  run("INSERT INTO users(role,email,password_hash,name,status,permissions) VALUES('admin',?,?, 'Super Admin','active','[\"*\"]')", email, bcrypt.hashSync(pw, 12));
  console.log(`\n[fixify] Admin created: ${email}${process.env.ADMIN_PASSWORD ? '' : ' / password: ' + pw + '  (shown once, change it)'}\n`);
}
