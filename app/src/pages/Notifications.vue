<script setup>
import { ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../views/Page.vue';
import { api, fmt, safe, unreadNotifications } from '../api';
const items = ref([]);
const load = async () => {
  items.value = await api('/notifications');
  unreadNotifications.value = items.value.filter((notification) => !notification.read).length;
};
onIonViewWillEnter(load);
const setRead = (notification, read) => safe(async () => {
  await api(`/notifications/${notification.id}`, { method: 'PATCH', body: { read } });
  notification.read = read;
  unreadNotifications.value = items.value.filter((item) => !item.read).length;
});
const readAll = () => safe(async () => {
  await api('/notifications/read', { method: 'POST' });
  items.value.forEach((notification) => { notification.read = true; });
  unreadNotifications.value = 0;
});
</script>

<template>
  <Page title="Notifications">
    <template #actions><ion-button @click="readAll">Mark all read</ion-button></template>
    <p v-if="!items.length" class="muted">You are all caught up.</p>
    <div class="card" v-for="n in items" :key="n.id" style="margin-bottom:10px" :style="{ borderColor: n.read ? '' : 'var(--fx-blue)' }">
      <div class="row sb"><strong>{{ n.title }}</strong><span class="muted">{{ fmt(n.created_at) }}</span></div><div class="muted">{{ n.body }}</div>
      <ion-button size="small" fill="clear" @click="setRead(n, !n.read)">{{ n.read ? 'Mark as unread' : 'Mark as read' }}</ion-button>
    </div>
  </Page>
</template>
