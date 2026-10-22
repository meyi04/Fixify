<script setup>
import { ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../views/Page.vue';
import { api, session } from '../api';
const d = ref({ cards: [] }), ann = ref([]);
const max = () => Math.max(1, ...(d.value.chart || []).map((x) => x.value));
onIonViewWillEnter(async () => { d.value = await api('/dashboard'); ann.value = await api('/announcements'); });
</script>

<template>
  <Page title="Dashboard">
    <h2 style="color:var(--fx-navy);margin-top:0">Hello, {{ session.user?.name }}</h2>
    <div class="grid">
      <div class="card" v-for="c in d.cards" :key="c.label"><div class="muted">{{ c.label }}</div><div class="stat">{{ c.value }}</div></div>
    </div>
    <div class="card" v-if="d.chart?.length" style="margin-top:16px">
      <strong>{{ d.chartTitle }}</strong>
      <div class="bars" style="margin-top:12px"><div v-for="b in d.chart" :key="b.label" :style="{ height: (b.value / max()) * 100 + '%' }" :title="b.value"><span>{{ b.label.slice(5) }}</span></div></div>
    </div>
    <div class="card" v-if="ann.length" style="margin-top:16px"><strong>Announcements</strong>
      <div v-for="a in ann" :key="a.id" style="margin-top:8px"><div style="font-weight:600">{{ a.title }}</div><div class="muted">{{ a.body }}</div></div>
    </div>
  </Page>
</template>
