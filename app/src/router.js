import { createRouter, createWebHistory } from '@ionic/vue-router';
import { session } from './api';

const pages = import.meta.glob('./pages/**/*.vue');
const lazy = (name) => {
  const loadPage = pages[`./pages/${name}.vue`];
  if (!loadPage) throw new Error(`Unknown page route: ${name}`);
  return loadPage;
};
const A = ['admin'], P = ['shop', 'technician'];
const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: () => import('./views/Auth.vue'), meta: { public: true } },
  { path: '/dashboard', component: lazy('Dashboard') },
  { path: '/profile', component: lazy('Profile') },
  { path: '/messages', component: lazy('Messages') },
  { path: '/notifications', component: lazy('Notifications') },
  { path: '/bookings', component: lazy('Bookings') },
  { path: '/money', component: lazy('Money'), meta: { roles: ['client', 'shop', 'technician'] } },
  { path: '/reports', component: lazy('ShopReports'), meta: { roles: ['shop'] } },
  { path: '/browse', component: lazy('Browse'), meta: { roles: ['client'] } },
  { path: '/provider/:id', component: lazy('Provider'), meta: { roles: ['client'] } },
  { path: '/services', component: lazy('Services'), meta: { roles: P } },
  { path: '/staff', component: lazy('Staff'), meta: { roles: ['shop'] } },
  { path: '/admin/users', component: lazy('admin/Users'), meta: { roles: A, permission: 'users' } },
  { path: '/admin/documents', component: lazy('admin/Documents'), meta: { roles: A, permission: 'documents' } },
  { path: '/admin/billing', component: lazy('admin/Billing'), meta: { roles: A, permission: 'billing' } },
  { path: '/admin/finance', component: lazy('admin/Finance'), meta: { roles: A, permission: 'finance' } },
  { path: '/admin/reports', component: lazy('admin/Reports'), meta: { roles: A, permission: 'reports' } },
  { path: '/admin/content', component: lazy('admin/Content'), meta: { roles: A, permission: 'content' } },
];
const router = createRouter({ history: createWebHistory(), routes });
router.beforeEach((to) => {
  if (!to.meta.public && !session.token) return '/login';
  if (to.meta.public && session.token) return '/dashboard';
  if (to.meta.roles && !to.meta.roles.includes(session.user?.role)) return '/dashboard';
  if (to.meta.permission && session.user?.role === 'admin') {
    let permissions = [];
    try { permissions = JSON.parse(session.user.permissions || '[]'); } catch {}
    if (!permissions.includes('*') && !permissions.includes(to.meta.permission)) return '/dashboard';
  }
});
export default router;
