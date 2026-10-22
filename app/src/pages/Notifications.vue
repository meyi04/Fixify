<script setup>
import { ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../views/Page.vue';
import { api, fmt } from '../api';
const items = ref([]);
const load = async () => (items.value = await api('/notifications'));
onIonViewWillEnter(load);
const readAll = async () => { await api('/notifications/read', { method: 'POST' }); load(); };
</script>

<template>
  <Page title="Notifications">
    <template #actions><ion-button @click="readAll">Mark all read</ion-button></template>
    <p v-if="!items.length" class="muted">You are all caught up.</p>
    <div class="card" v-for="n in items" :key="n.id" style="margin-bottom:10px" :style="{ borderColor: n.read ? '' : 'var(--fx-blue)' }">
      <div class="row sb"><strong>{{ n.title }}</strong><span class="muted">{{ fmt(n.created_at) }}</span></div><div class="muted">{{ n.body }}</div>
    </div>
  </Page>
</template>
