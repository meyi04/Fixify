import { home, search, calendar, chatbubbles, person, wallet, construct, people, documentText, pricetag, cash, flag, apps, notifications, storefront } from 'ionicons/icons';
const common = [{ t: 'Messages', to: '/messages', i: chatbubbles }, { t: 'Notifications', to: '/notifications', i: notifications }, { t: 'Profile', to: '/profile', i: person }];
export const menus = {
  client: [{ t: 'Home', to: '/dashboard', i: home }, { t: 'Find a fixer', to: '/browse', i: search }, { t: 'My repairs', to: '/bookings', i: calendar }, { t: 'Payments', to: '/money', i: wallet }, ...common],
  shop: [{ t: 'Dashboard', to: '/dashboard', i: home }, { t: 'Bookings', to: '/bookings', i: calendar }, { t: 'Services', to: '/services', i: construct }, { t: 'Staff', to: '/staff', i: people }, { t: 'Earnings', to: '/money', i: wallet }, { t: 'Reports', to: '/reports', i: flag }, ...common],
  technician: [{ t: 'Dashboard', to: '/dashboard', i: home }, { t: 'Bookings', to: '/bookings', i: calendar }, { t: 'Services', to: '/services', i: construct }, { t: 'Earnings', to: '/money', i: wallet }, ...common],
  admin: [
    { t: 'Overview', to: '/dashboard', i: home },
    { t: 'Users', to: '/admin/users', i: people, permission: 'users' },
    { t: 'Documents', to: '/admin/documents', i: documentText, permission: 'documents' },
    { t: 'Plans & fees', to: '/admin/billing', i: pricetag, permission: 'billing' },
    { t: 'Finance', to: '/admin/finance', i: cash, permission: 'finance' },
    { t: 'Bookings', to: '/bookings', i: calendar },
    { t: 'Reports & logs', to: '/admin/reports', i: flag, permission: 'reports' },
    { t: 'Content', to: '/admin/content', i: apps, permission: 'content' },
    ...common,
  ],
};
export { storefront };
