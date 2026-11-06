<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { session, setSession, img } from './api';
import { menus } from './nav';
import { logOutOutline, personOutline } from 'ionicons/icons';
const router = useRouter(), route = useRoute();
const items = computed(() => {
  const entries = (menus[session.user?.role] || []).filter((item) => item.to !== '/profile');
  if (session.user?.role !== 'admin') return entries;
  let permissions = [];
  try { permissions = JSON.parse(session.user.permissions || '[]'); } catch {}
  return entries.filter((item) => !item.permission || permissions.includes('*') || permissions.includes(item.permission));
});
async function logout() { await setSession(null, null); router.replace('/login'); }
</script>

<template>
  <ion-app>
    <ion-split-pane content-id="main" when="lg" class="fx-split-pane">
      <ion-menu v-if="session.token" content-id="main" menu-id="side" class="app-menu">
        <ion-content class="menu-content">
          <div class="brand-row">
            <span class="brand-mark"><ion-icon :icon="menus[session.user?.role]?.[0]?.i" /></span>
            <div><div class="brand-name">Fixify</div><div class="brand-caption">Gadget care, made easy</div></div>
          </div>
          <div class="menu-label">Workspace</div>
          <ion-list lines="none" class="menu-list">
            <ion-menu-toggle :auto-hide="false" v-for="m in items" :key="m.to">
              <ion-item button :router-link="m.to" detail="false" :class="['menu-item', { selected: route.path === m.to || (m.to !== '/dashboard' && route.path.startsWith(m.to + '/')) }]">
                <ion-icon :icon="m.i" slot="start" /><ion-label>{{ m.t }}</ion-label>
              </ion-item>
            </ion-menu-toggle>
          </ion-list>
          <div class="menu-label">Account</div>
          <ion-list lines="none" class="menu-list">
            <ion-menu-toggle :auto-hide="false">
              <ion-item button router-link="/profile" detail="false" :class="['menu-item', { selected: route.path === '/profile' }]">
                <ion-icon :icon="personOutline" slot="start" /><ion-label>My profile</ion-label>
              </ion-item>
            </ion-menu-toggle>
            <ion-item button detail="false" class="menu-item menu-signout" @click="logout"><ion-icon :icon="logOutOutline" slot="start" /><ion-label>Sign out</ion-label></ion-item>
          </ion-list>
          <div class="menu-profile">
            <img v-if="session.user?.avatar" class="avatar" :src="img(session.user.avatar)" alt="" />
            <span v-else class="brand-mark"><ion-icon :icon="personOutline" /></span>
            <div style="min-width:0"><div class="user-name">{{ session.user?.name }}</div><div class="user-role">{{ session.user?.role }} account</div></div>
          </div>
        </ion-content>
      </ion-menu>
      <ion-router-outlet id="main" />
    </ion-split-pane>
  </ion-app>
</template>
