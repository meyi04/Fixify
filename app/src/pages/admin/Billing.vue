<script setup>
import { ref, reactive } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../../views/Page.vue';
import { api, safe, toast, peso, day, statusColor } from '../../api';
const plans = ref([]), subs = ref([]), s = reactive({ platform_fee_pct: 0, default_commission_pct: 0, maintenance: false });
const n = reactive({ name: '', role: 'shop', price: 0, interval_days: 30, commission_pct: 10 });
async function load() { plans.value = await api('/admin/plans'); subs.value = await api('/admin/subscriptions'); const x = await api('/admin/settings'); Object.assign(s, { platform_fee_pct: +x.platform_fee_pct, default_commission_pct: +x.default_commission_pct, maintenance: x.maintenance === '1' }); }
onIonViewWillEnter(load);
const savePlan = (p) => safe(async () => { await api('/admin/plans/' + p.id, { method: 'PUT', body: { name: p.name, price: +p.price, interval_days: +p.interval_days, commission_pct: +p.commission_pct, active: !!p.active } }); toast('Plan saved'); });
const addPlan = () => safe(async () => { await api('/admin/plans', { method: 'POST', body: { ...n, price: +n.price, interval_days: +n.interval_days, commission_pct: +n.commission_pct } }); n.name = ''; load(); });
const saveSettings = () => safe(async () => { await api('/admin/settings', { method: 'PUT', body: { platform_fee_pct: +s.platform_fee_pct, default_commission_pct: +s.default_commission_pct, maintenance: s.maintenance } }); toast('Settings saved'); });
const subAct = (x, body) => safe(async () => { await api('/admin/subscriptions/' + x.id, { method: 'PATCH', body }); load(); });
</script>

<template>
  <Page title="Plans, commissions & fees">
    <div class="card"><strong>Platform settings</strong>
      <div class="row" style="margin-top:8px"><div class="field"><label>Platform fee charged to clients (%)</label><input type="number" min="0" max="50" step="any" v-model="s.platform_fee_pct" /></div><div class="field"><label>Default commission (%)</label><input type="number" min="0" max="100" step="any" v-model="s.default_commission_pct" /></div></div>
      <label class="row muted"><input type="checkbox" v-model="s.maintenance" /> Maintenance mode (blocks new bookings)</label><ion-button size="small" style="margin-top:8px" @click="saveSettings">Save settings</ion-button></div>
    <div class="card scroll-x" style="margin-top:14px"><strong>Subscription plans</strong>
      <table class="t"><tr><th>Name</th><th>For</th><th>Price</th><th>Days</th><th>Commission %</th><th>Active</th><th></th></tr>
        <tr v-for="p in plans" :key="p.id"><td><input v-model="p.name" /></td><td>{{ p.role }}</td><td><input type="number" v-model="p.price" style="width:90px" /></td><td><input type="number" v-model="p.interval_days" style="width:70px" /></td><td><input type="number" step="any" v-model="p.commission_pct" style="width:70px" /></td><td><input type="checkbox" :checked="!!p.active" @change="p.active = $event.target.checked ? 1 : 0" /></td><td><ion-button size="small" @click="savePlan(p)">Save</ion-button></td></tr></table>
      <form class="row" style="margin-top:12px" @submit.prevent="addPlan"><div class="field" style="margin:0"><input v-model="n.name" placeholder="New plan name" required /></div><select v-model="n.role"><option>shop</option><option>technician</option></select><input type="number" v-model="n.price" style="width:90px" /><input type="number" v-model="n.interval_days" style="width:70px" /><input type="number" step="any" v-model="n.commission_pct" style="width:70px" /><ion-button size="small" type="submit">Add plan</ion-button></form></div>
    <div class="card scroll-x" style="margin-top:14px"><strong>Subscriptions</strong><table class="t"><tr><th>Provider</th><th>Plan</th><th>Status</th><th>Expires</th><th></th></tr>
      <tr v-for="x in subs" :key="x.id"><td>{{ x.name }}<div class="muted">{{ x.email }}</div></td><td>{{ x.plan }}</td><td><span class="badge" :class="statusColor(x.status)">{{ x.status }}</span></td><td>{{ day(x.expires_at) }}</td><td><ion-button size="small" fill="outline" @click="subAct(x, { extendDays: 30 })">+30 days</ion-button><ion-button size="small" fill="clear" color="danger" v-if="x.status === 'active'" @click="subAct(x, { status: 'cancelled' })">Cancel</ion-button></td></tr></table></div>
  </Page>
</template>
