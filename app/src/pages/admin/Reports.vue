<script setup>
import { ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../../views/Page.vue';
import { api, safe, toast, fmt, statusColor } from '../../api';
const tab = ref('disputes'), disputes = ref([]), alerts = ref([]), logs = ref([]);
async function load() { disputes.value = await api('/admin/disputes'); alerts.value = await api('/admin/security-alerts'); logs.value = await api('/admin/audit'); }
onIonViewWillEnter(load);
const decide = (d, status) => { const resolution = prompt('Resolution note (sent to the people involved)'); if (!resolution) return; const suspendTarget = status === 'resolved' && confirm('Also suspend the reported account?'); safe(async () => { await api('/admin/disputes/' + d.id, { method: 'PATCH', body: { status, resolution, suspendTarget } }); toast('Updated'); load(); }); };
</script>

<template>
  <Page title="Reports, security & audit">
    <ion-segment v-model="tab" style="margin-bottom:12px"><ion-segment-button value="disputes"><ion-label>Disputes & appeals</ion-label></ion-segment-button><ion-segment-button value="alerts"><ion-label>Security alerts</ion-label></ion-segment-button><ion-segment-button value="audit"><ion-label>Audit log</ion-label></ion-segment-button></ion-segment>
    <div v-if="tab === 'disputes'" class="grid"><div class="card" v-for="d in disputes" :key="d.id">
      <div class="row sb"><strong>#{{ d.id }} {{ d.reporter }} → {{ d.target }}</strong><span class="badge" :class="statusColor(d.status === 'resolved' ? 'completed' : d.status === 'open' || d.status === 'appeal' ? 'pending' : '')">{{ d.status }}</span></div>
      <div class="muted">{{ fmt(d.created_at) }}<span v-if="d.booking_id"> · booking #{{ d.booking_id }}</span></div><p>{{ d.reason }}</p><p v-if="d.appeal_text"><strong>Appeal:</strong> {{ d.appeal_text }}</p><p class="muted" v-if="d.resolution">Resolution: {{ d.resolution }}</p>
      <div class="row" v-if="['open', 'appeal'].includes(d.status)"><ion-button size="small" @click="decide(d, 'resolved')">Resolve</ion-button><ion-button size="small" fill="outline" @click="decide(d, 'dismissed')">Dismiss</ion-button></div></div></div>
    <div v-if="tab === 'alerts'" class="card scroll-x"><p v-if="!alerts.length" class="muted">No security alerts.</p><table class="t"><tr v-for="a in alerts" :key="a.id"><td>{{ fmt(a.created_at) }}</td><td><span class="badge red">{{ a.action }}</span></td><td>{{ a.email }}</td><td class="muted">{{ a.ip }}</td></tr></table></div>
    <div v-if="tab === 'audit'" class="card scroll-x"><table class="t"><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr><tr v-for="a in logs" :key="a.id"><td>{{ fmt(a.created_at) }}</td><td>{{ a.actor || '—' }}</td><td>{{ a.action }}</td><td class="muted">{{ a.target }}</td></tr></table></div>
  </Page>
</template>
