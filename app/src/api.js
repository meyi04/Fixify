import { reactive } from 'vue';
import { toastController } from '@ionic/vue';

export const BASE = import.meta.env.VITE_API || 'http://localhost:4000';
// NOTE: for the native app store the token with @capacitor/preferences (secure storage) instead of localStorage.
export const session = reactive({ token: localStorage.getItem('fx_token'), user: JSON.parse(localStorage.getItem('fx_user') || 'null') });

export function setSession(token, user) {
  session.token = token; session.user = user;
  if (token) { localStorage.setItem('fx_token', token); localStorage.setItem('fx_user', JSON.stringify(user)); }
  else { localStorage.removeItem('fx_token'); localStorage.removeItem('fx_user'); }
}
export async function toast(message, color = 'primary') { (await toastController.create({ message, duration: 2500, color, position: 'top' })).present(); }

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (session.token) headers.Authorization = 'Bearer ' + session.token;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + '/api' + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && session.token) { setSession(null, null); location.href = '/login'; }
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
