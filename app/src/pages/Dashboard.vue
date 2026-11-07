<script setup>
import { ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../views/Page.vue';
import { api, peso, session } from '../api';
const d = ref({ cards: [] }), ann = ref([]);
const max = () => Math.max(1, ...(d.value.chart || []).map((x) => x.value));
onIonViewWillEnter(async () => { d.value = await api('/dashboard'); ann.value = await api('/announcements'); });
</script>

<template>
  <Page title="Dashboard">
    <section class="dashboard-intro">
      <div class="eyebrow">Your Fixify workspace</div>
      <h2>Good to see you, {{ session.user?.name?.split(' ')[0] }}.</h2>
      <p>Keep your repairs moving. Your bookings, updates and everything you need are right here.</p>
    </section>
    <div class="row sb" style="margin:0 2px 12px"><strong style="color:var(--fx-navy);font-size:15px">Your overview</strong><span class="muted">A snapshot of your activity</span></div>
    <div class="grid">
      <div class="card" v-for="c in d.cards" :key="c.label"><div class="muted">{{ c.label }}</div><div class="stat">{{ c.label === 'Net earnings' ? peso(c.value) : c.value }}</div></div>
    </div>
    <div class="card" v-if="d.chart?.length" style="margin-top:16px">
      <strong>{{ d.chartTitle }}</strong>
      <div class="bars" style="margin-top:12px"><div v-for="b in d.chart" :key="b.label" :style="{ height: (b.value / max()) * 100 + '%' }" :title="b.value"><span>{{ b.label.slice(5) }}</span></div></div>
    </div>
    <div class="card" v-if="ann.length" style="margin-top:18px"><strong>Announcements</strong>
      <div v-for="a in ann" :key="a.id" style="margin-top:8px"><div style="font-weight:600">{{ a.title }}</div><div class="muted">{{ a.body }}</div></div>
    </div>
  </Page>
</template>
