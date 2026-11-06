import { reactive } from 'vue';
import { toastController } from '@ionic/vue';
import { signOut } from 'firebase/auth';
import { firebaseAuth, firebaseAuthReady } from './firebase';

export const BASE = import.meta.env.VITE_API ?? (import.meta.env.DEV ? 'http://localhost:4000' : '');
export const session = reactive({ token: null, user: null });

export async function loadSession() {
  await firebaseAuthReady;
  await firebaseAuth.authStateReady();
  const user = firebaseAuth.currentUser;
  if (!user) return;
  await user.reload();
  if (!user.emailVerified) return;
  try {
    session.token = await user.getIdToken(true);
    session.user = await api('/auth/me');
  } catch (error) {
    clearSessionCache();
    throw error;
  }
}

export async function setSession(token, user) {
  session.token = token; session.user = user;
  if (!token && firebaseAuth.currentUser) {
    await signOut(firebaseAuth);
  }
}

export function clearSessionCache() {
  session.token = null;
  session.user = null;
}
export async function toast(message, color = 'primary') { (await toastController.create({ message, duration: 2500, color, position: 'top' })).present(); }

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  await firebaseAuthReady;
  const token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : session.token;
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + '/api' + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { await setSession(null, null); location.href = '/login'; }
  if (!res.ok) { const e = new Error(data.error || 'Request failed'); e.data = data; throw e; }
  return data;
}
export const safe = async (fn) => { try { return await fn(); } catch (e) { toast(e.message, 'danger'); } };
export const upload = (path, file, extra = {}) => { const f = new FormData(); Object.entries(extra).forEach(([k, v]) => f.append(k, v)); f.append('file', file); return api(path, { method: 'POST', form: f }); };
export const img = (u) => (u ? (u.startsWith('/') ? BASE + u : u) : '');
export const fmt = (t) => (t ? new Date(t * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const day = (t) => (t ? new Date(t * 1000).toLocaleDateString([], { dateStyle: 'medium' }) : '—');
export const peso = (n) => '₱' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
export const toEpoch = (local) => Math.floor(new Date(local).getTime() / 1000);
export async function openPrivate(path) { // fetch with auth header, then open the blob
  const res = await fetch(BASE + '/api' + path, { headers: { Authorization: 'Bearer ' + session.token } });
  if (!res.ok) return toast('Cannot open file', 'danger');
  window.open(URL.createObjectURL(await res.blob()), '_blank');
}
export const statusColor = (s) => ({ completed: 'green', accepted: 'green', approved: 'green', active: 'green', paid: 'green', rejected: 'red', cancelled: 'red', suspended: 'red', refunded: 'red', requested: 'amber', pending: 'amber', in_progress: '' }[s] ?? '');
