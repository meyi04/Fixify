<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { session, setSession, img, api } from './api';
import { menus } from './nav';
const router = useRouter(), route = useRoute();
const items = computed(() => menus[session.user?.role] || []);
async function logout() { try { await api('/auth/logout-all', { method: 'POST' }); } catch {} setSession(null, null); router.replace('/login'); }
</script>

<template>
  <ion-app>
    <ion-split-pane content-id="main" when="lg">
      <ion-menu v-if="session.token" content-id="main" menu-id="side">
        <ion-header><ion-toolbar><ion-title>Fixify</ion-title></ion-toolbar></ion-header>
        <ion-content style="--background:#fff">
          <div class="row" style="padding:16px">
            <img v-if="session.user?.avatar" class="avatar" :src="img(session.user.avatar)" alt="" />
            <div><strong>{{ session.user?.name }}</strong><div class="muted">{{ session.user?.role }}</div></div>
          </div>
          <ion-list lines="none">
            <ion-menu-toggle :auto-hide="false" v-for="m in items" :key="m.to">
              <ion-item button :router-link="m.to" detail="false" :color="route.path === m.to ? 'light' : undefined">
                <ion-icon :icon="m.i" slot="start" :color="route.path === m.to ? 'primary' : undefined" /><ion-label>{{ m.t }}</ion-label>
              </ion-item>
            </ion-menu-toggle>
            <ion-item button detail="false" @click="logout"><ion-label color="danger">Sign out</ion-label></ion-item>
          </ion-list>
        </ion-content>
      </ion-menu>
      <ion-router-outlet id="main" />
    </ion-split-pane>
  </ion-app>
</template>
