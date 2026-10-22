<script setup>
import { ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../views/Page.vue';
import { api, safe, session, toast, peso, fmt, day, statusColor } from '../api';
const role = session.user.role, isProv = role !== 'client' && role !== 'admin';
const plans = ref([]), sub = ref(null), e = ref(null), pays = ref([]), warranties = ref([]);
async function load() {
  if (role === 'client') { pays.value = await api('/payments'); warranties.value = (await api('/bookings')).filter((b) => b.warranty_until); return; }
  e.value = await api('/earnings'); sub.value = await api('/subscription');
  if (!session.user.shop_id) plans.value = await api('/plans');
}
onIonViewWillEnter(load);
const buy = (p) => confirm(`Subscribe to ${p.name} for ${peso(p.price)}?`) && safe(async () => { await api('/subscribe', { method: 'POST', body: { planId: p.id } }); toast('Subscription active'); load(); });
const months = () => Object.entries(e.value?.byMonth || {}).sort();
const max = () => Math.max(1, ...months().map(([, v]) => v));
</script>

<template>
  <Page :title="role === 'client' ? 'Payments & warranties' : 'Earnings & subscription'">
    <template v-if="role === 'client'">
      <div class="card"><strong>Payment history</strong><p v-if="!pays.length" class="muted">No payments yet.</p>
        <div class="row sb" v-for="p in pays" :key="p.id" style="margin-top:8px"><span>#{{ p.booking_id }} {{ p.device }} <span class="muted">{{ fmt(p.created_at) }}</span></span><span><span class="badge" :class="statusColor(p.status)">{{ p.status }}</span> <strong>{{ peso(p.amount) }}</strong></span></div></div>
      <div class="card" style="margin-top:14px"><strong>Warranties</strong><p v-if="!warranties.length" class="muted">No warranties yet.</p>
        <div class="row sb" v-for="w in warranties" :key="w.id" style="margin-top:8px"><span>{{ w.device }} · {{ w.provider_label }}</span><span class="badge" :class="w.warranty_until * 1000 > Date.now() ? 'green' : 'red'">{{ w.warranty_until * 1000 > Date.now() ? 'Valid until ' : 'Expired ' }}{{ day(w.warranty_until) }}</span></div></div>
    </template>
    <template v-else-if="e">
      <div class="grid"><div class="card"><div class="muted">Net earnings</div><div class="stat">{{ peso(e.net) }}</div></div><div class="card"><div class="muted">Gross</div><div class="stat">{{ peso(e.gross) }}</div></div><div class="card"><div class="muted">Commission paid</div><div class="stat">{{ peso(e.commission) }}</div></div>
        <div class="card" v-if="!session.user.shop_id"><div class="muted">Subscription</div><div class="stat">{{ sub ? 'Active' : 'Inactive' }}</div><div class="muted" v-if="sub">Renews {{ day(sub.expires_at) }} · {{ sub.commission_pct }}% commission</div></div></div>
      <div class="card" style="margin-top:14px" v-if="months().length"><strong>Net by month</strong><div class="bars" style="margin-top:12px"><div v-for="[k, v] in months()" :key="k" :style="{ height: (v / max()) * 100 + '%' }" :title="peso(v)"><span>{{ k.slice(5) }}</span></div></div></div>
      <div class="card" style="margin-top:14px" v-if="plans.length"><strong>Plans</strong><p class="muted">An active plan is required to accept bookings.</p>
        <div class="grid"><div class="card" v-for="p in plans" :key="p.id"><strong>{{ p.name }}</strong><div class="stat">{{ peso(p.price) }}</div><div class="muted">{{ p.interval_days }} days · {{ p.commission_pct }}% commission per job</div><ion-button size="small" style="margin-top:8px" @click="buy(p)">{{ sub ? 'Renew / switch' : 'Subscribe' }}</ion-button></div></div></div>
      <div class="card scroll-x" style="margin-top:14px"><strong>Paid jobs</strong><table class="t"><tr><th>Booking</th><th>Date</th><th>Amount</th><th>Commission</th><th>Payout</th></tr><tr v-for="p in e.payments" :key="p.id"><td>#{{ p.booking_id }} {{ p.device }}</td><td>{{ fmt(p.created_at) }}</td><td>{{ peso(p.amount - p.platform_fee) }}</td><td>{{ peso(p.commission) }}</td><td>{{ p.status === 'refunded' ? 'refunded' : p.payout_status }}</td></tr></table></div>
    </template>
  </Page>
</template>
