# Fixify – gadget repair marketplace (Ionic Vue + Node API)

Roles: **client**, **shop** (with employee technicians), **independent technician**, **admin**.

## Run it
```bash
# 1. API
cd server && cp .env.example .env      # set JWT_SECRET (>=32 chars) and ADMIN_PASSWORD
npm install && npm start               # http://localhost:4000, creates fixify.db + first admin

# 2. App
cd ../app && cp .env.example .env
npm install && npm run dev             # http://localhost:5173  (responsive: phone + desktop)
```
Verification / reset codes are printed in the API console in development. Wire `sendCode()` in `server/src/routes/auth.js` to an email or SMS provider for production.

## Typical flow
1. Shop/technician registers, verifies email, uploads permit/ID in **Profile**.
2. Admin signs in → **Documents** → approves. The provider now appears in Browse.
3. Provider buys a plan in **Earnings** (required to accept bookings), adds **Services**, hours and photos.
4. Client searches, books with photos, chats, tracks status, pays, rates.
5. Admin manages users, plans, commissions, refunds, payouts, disputes, audit logs.

## Security built in
bcrypt (cost 12) hashed passwords · password policy · email verification before login · 5-try lockout (15 min) · 6-digit codes hashed, expiring, 5 attempts · short-lived JWT with server-side revocation (`token_version`; password change, suspension and "sign out everywhere" invalidate sessions) · role + per-admin permission checks on every route · ownership checks on bookings/messages/documents · zod validation on all inputs · parameterised SQL only · helmet headers, CORS allowlist, rate limits · uploads: type allowlist, 5 MB cap, random names, **permits stored privately** and served only to the owner/admins · audit log and security alerts · no user-enumeration on register/forgot.

## Before going live
- Serve over HTTPS, set `CORS_ORIGINS` to your real domains, keep `.env` out of git.
- Replace the simulated payment in `bookings/:id/action → pay` and `/subscribe` with a real gateway (PayMongo, Stripe, GCash) confirmed by webhook.
- On the native app store the token with `@capacitor/preferences`; consider httpOnly cookies for the web build.
- Move uploads to object storage (S3) with malware scanning; add backups for the database.
- Add MFA for admins (TOTP) and a real email/SMS sender.
- Run `npx cap add android ios` for the mobile build (`capacitor.config.json` included).
