import { createRouter, createWebHistory } from '@ionic/vue-router';
import { session } from './api';

const lazy = (n) => () => import(`./pages/${n}.vue`);
const A = ['admin'], P = ['shop', 'technician'];
const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: () => import('./views/Auth.vue'), meta: { public: true } },
  { path: '/dashboard', component: lazy('Dashboard') },
  { path: '/profile', component: lazy('Profile') },
  { path: '/messages', component: lazy('Messages') },
  { path: '/notifications', component: lazy('Notifications') },
  { path: '/bookings', component: lazy('Bookings') },
  { path: '/money', component: lazy('Money') },
  { path: '/browse', component: lazy('Browse'), meta: { roles: ['client'] } },
  { path: '/provider/:id', component: lazy('Provider'), meta: { roles: ['client'] } },
  { path: '/services', component: lazy('Services'), meta: { roles: P } },
  { path: '/staff', component: lazy('Staff'), meta: { roles: ['shop'] } },
  { path: '/admin/users', component: lazy('admin/Users'), meta: { roles: A } },
  { path: '/admin/documents', component: lazy('admin/Documents'), meta: { roles: A } },
  { path: '/admin/billing', component: lazy('admin/Billing'), meta: { roles: A } },
  { path: '/admin/finance', component: lazy('admin/Finance'), meta: { roles: A } },
  { path: '/admin/reports', component: lazy('admin/Reports'), meta: { roles: A } },
  { path: '/admin/content', component: lazy('admin/Content'), meta: { roles: A } },
];
const router = createRouter({ history: createWebHistory(), routes });
router.beforeEach((to) => {
  if (!to.meta.public && !session.token) return '/login';
  if (to.meta.public && session.token) return '/dashboard';
  if (to.meta.roles && !to.meta.roles.includes(session.user?.role)) return '/dashboard';
});
export default router;
