<script setup>
import { ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../../views/Page.vue';
import { api, safe, toast, peso, fmt, statusColor } from '../../api';
const pays = ref([]), payouts = ref([]), rep = ref({});
async function load() { pays.value = await api('/admin/payments'); payouts.value = await api('/admin/payouts'); rep.value = await api('/admin/reports/financial'); }
onIonViewWillEnter(load);
const refund = (p) => confirm(`Refund ${peso(p.amount)} to the payer?`) && safe(async () => { await api(`/admin/payments/${p.id}/refund`, { method: 'POST' }); toast('Refunded'); load(); });
const payout = (x) => confirm(`Mark ${peso(x.owed)} as paid out to ${x.name}?`) && safe(async () => { await api('/admin/payouts/' + x.id, { method: 'POST' }); toast('Payout recorded'); load(); });
</script>

<template>
  <Page title="Finance">
    <div class="grid"><div class="card"><div class="muted">Booking volume</div><div class="stat">{{ peso(rep.booking_volume) }}</div></div><div class="card"><div class="muted">Commissions</div><div class="stat">{{ peso(rep.commissions) }}</div></div><div class="card"><div class="muted">Platform fees</div><div class="stat">{{ peso(rep.platform_fees) }}</div></div><div class="card"><div class="muted">Subscriptions</div><div class="stat">{{ peso(rep.subscriptions) }}</div></div><div class="card"><div class="muted">Refunds</div><div class="stat">{{ peso(rep.refunds) }}</div></div></div>
    <div class="card scroll-x" style="margin-top:14px"><strong>Pending payouts</strong><p v-if="!payouts.length" class="muted">Nothing owed.</p>
      <table class="t" v-if="payouts.length"><tr><th>Provider</th><th>Jobs</th><th>Owed</th><th></th></tr><tr v-for="x in payouts" :key="x.id"><td>{{ x.name }}</td><td>{{ x.jobs }}</td><td>{{ peso(x.owed) }}</td><td><ion-button size="small" @click="payout(x)">Mark paid</ion-button></td></tr></table></div>
    <div class="card scroll-x" style="margin-top:14px"><strong>Payments</strong><table class="t"><tr><th>#</th><th>Type</th><th>Payer</th><th>Amount</th><th>Commission</th><th>Status</th><th>Date</th><th></th></tr>
      <tr v-for="p in pays" :key="p.id"><td>{{ p.id }}</td><td>{{ p.kind }}</td><td>{{ p.payer }}</td><td>{{ peso(p.amount) }}</td><td>{{ peso(p.commission) }}</td><td><span class="badge" :class="statusColor(p.status)">{{ p.status }}</span></td><td>{{ fmt(p.created_at) }}</td><td><ion-button size="small" fill="clear" color="danger" v-if="p.status === 'paid'" @click="refund(p)">Refund</ion-button></td></tr></table></div>
  </Page>
</template>
