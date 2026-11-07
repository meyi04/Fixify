<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { session, img, setSession, confirmLogout, unreadNotifications } from '../api';
import { menus } from '../nav';
import { calendarClearOutline, constructOutline, logOutOutline, personOutline } from 'ionicons/icons';
defineProps({ title: String });
const route = useRoute(), router = useRouter();
const tabs = computed(() => (menus[session.user?.role] || []).slice(0, 5));
const roleLabel = computed(() => ({
  client: 'Customer',
  shop: 'Repair shop',
  technician: 'Technician',
  admin: 'Administration',
}[session.user?.role] || 'Workspace'));
const navItems = computed(() => {
  const items = menus[session.user?.role] || [];
  if (session.user?.role !== 'admin') return items;
  let permissions = [];
  try { permissions = JSON.parse(session.user.permissions || '[]'); } catch {}
  return items.filter((item) => !item.permission || permissions.includes('*') || permissions.includes(item.permission));
});
const currentItem = computed(() => navItems.value.find((item) => route.path === item.to
  || (item.to !== '/dashboard' && route.path.startsWith(item.to + '/'))
  || (item.to === '/browse' && route.path.startsWith('/provider/'))));
const today = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
const isActive = (path) => route.path === path
  || (path !== '/dashboard' && route.path.startsWith(path + '/'))
  || (path === '/browse' && route.path.startsWith('/provider/'));
async function logout() {
  if (!await confirmLogout()) return;
  await setSession(null, null);
  router.replace('/login');
}
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar class="page-toolbar">
        <ion-buttons slot="start"><ion-menu-button class="ion-hide-lg-up" /></ion-buttons>
        <ion-title>
          <span class="page-heading">
            <span class="page-glyph"><ion-icon :icon="currentItem?.i || constructOutline" /></span>
            <span class="page-heading-copy">
              <span class="page-context"><span class="context-brand">FIXIFY</span><span class="context-dot">/</span>{{ roleLabel }} workspace</span>
              <span class="page-title">{{ title }}</span>
            </span>
          </span>
        </ion-title>
        <ion-buttons slot="end" class="page-header-actions">
          <slot name="actions" />
          <span class="header-date ion-hide-sm-down"><ion-icon :icon="calendarClearOutline" /><span>{{ today }}</span></span>
          <ion-button class="header-profile-mobile ion-hide-md-up" fill="clear" router-link="/profile" aria-label="Open your profile">
            <img v-if="session.user?.avatar" class="header-avatar" :src="img(session.user.avatar)" alt="" />
            <span v-else class="header-avatar header-avatar-fallback"><ion-icon :icon="personOutline" /></span>
          </ion-button>
          <ion-button class="header-account ion-hide-md-down" fill="clear" router-link="/profile" aria-label="Open your profile">
            <img v-if="session.user?.avatar" class="header-avatar" :src="img(session.user.avatar)" alt="" />
            <span v-else class="header-avatar header-avatar-fallback"><ion-icon :icon="personOutline" /></span>
            <span class="header-user"><strong>{{ session.user?.name }}</strong></span>
          </ion-button>
          <ion-button class="header-signout" fill="clear" @click="logout" aria-label="Sign out">
            <ion-icon :icon="logOutOutline" />
            <span class="signout-label ion-hide-md-down">Sign out</span>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content><main class="wrap"><slot /></main></ion-content>
    <ion-footer class="ion-hide-lg-up">
      <ion-toolbar class="tab-toolbar">
        <nav class="tabs" aria-label="Main navigation">
          <ion-button v-for="m in tabs" :key="m.to" fill="clear" :router-link="m.to" :class="{ on: isActive(m.to) }" :aria-current="isActive(m.to) ? 'page' : undefined" :aria-label="m.to === '/notifications' && unreadNotifications ? `${m.t}, ${unreadNotifications} unread` : m.t" size="small">
            <span class="tab-content">
              <span class="tab-icon"><ion-icon :icon="m.i" /><span v-if="m.to === '/notifications' && unreadNotifications" class="notification-dot">{{ unreadNotifications > 9 ? '9+' : unreadNotifications }}</span></span>
              <span class="tab-label">{{ m.t.split(' ')[0] }}</span>
              <span class="tab-indicator" aria-hidden="true"></span>
            </span>
          </ion-button>
        </nav>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>
