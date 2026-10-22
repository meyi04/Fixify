<script setup>
import { ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../../views/Page.vue';
import { api, safe, toast, fmt, openPrivate, statusColor } from '../../api';
const list = ref([]), status = ref('pending');
const load = async () => (list.value = await api('/admin/documents?status=' + status.value));
onIonViewWillEnter(load);
const decide = (d, s) => { const note = s === 'rejected' ? prompt('Reason for rejection (shown to the provider)') : ''; if (note === null) return; safe(async () => { await api('/admin/documents/' + d.id, { method: 'PATCH', body: { status: s, note: note || undefined } }); toast('Document ' + s); load(); }); };
</script>

<template>
  <Page title="Permit & certificate review">
    <div class="field" style="max-width:220px"><select v-model="status" @change="load"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="">All</option></select></div>
    <p v-if="!list.length" class="muted">Nothing to review.</p>
    <div class="grid"><div class="card" v-for="d in list" :key="d.id">
      <div class="row sb"><strong>{{ d.label }}</strong><span class="badge" :class="statusColor(d.status)">{{ d.status }}</span></div>
      <div class="muted">{{ d.role }} · {{ d.email }}</div><div>{{ d.type }} <span class="muted">· {{ fmt(d.created_at) }}</span></div><div class="muted" v-if="d.note">{{ d.note }}</div>
      <div class="row" style="margin-top:8px"><ion-button size="small" fill="outline" @click="openPrivate(`/documents/${d.id}/file`)">View file</ion-button><ion-button size="small" v-if="d.status !== 'approved'" @click="decide(d, 'approved')">Approve</ion-button><ion-button size="small" color="danger" fill="outline" v-if="d.status !== 'rejected'" @click="decide(d, 'rejected')">Reject</ion-button></div>
    </div></div>
  </Page>
</template>
