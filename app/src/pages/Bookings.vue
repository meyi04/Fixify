<script setup>
import { ref, reactive, computed } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../views/Page.vue';
import { api, safe, session, toast, img, fmt, day, peso, statusColor, toEpoch } from '../api';
const role = session.user.role;
const list = ref([]), staff = ref([]), sel = ref(null), filter = ref(''), act = ref('');
const f = reactive({ when: '', technicianId: '', estimate: '', partsText: '', note: '', total: '', result: '', warrantyDays: 0, rating: 5, comment: '' });
const isProv = role === 'shop' || role === 'technician';
const shown = computed(() => list.value.filter((b) => !filter.value || b.status === filter.value));
async function load() { list.value = await api('/bookings'); if (role === 'shop') staff.value = await api('/staff'); if (sel.value) sel.value = list.value.find((b) => b.id === sel.value.id) || null; }
onIonViewWillEnter(load);
const open = (b) => { sel.value = b; act.value = ''; f.estimate = b.estimate ?? ''; f.total = b.total ?? b.estimate ?? ''; f.partsText = (b.parts || []).map((p) => `${p.name}:${p.cost}`).join('\n'); f.technicianId = b.technician_id || ''; };
const parseParts = () => f.partsText.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [n, c] = l.split(':'); return { name: n.trim(), cost: +c || 0 }; });
function send(action, extra = {}) {
  return safe(async () => { await api(`/bookings/${sel.value.id}/action`, { method: 'POST', body: { action, ...extra } }); act.value = ''; await load(); toast('Done'); });
}
const reschedule = () => send('reschedule', { scheduledAt: toEpoch(f.when) });
const assign = () => send('assign', { technicianId: f.technicianId ? +f.technicianId : null });
const update = () => send('update', { estimate: f.estimate === '' ? undefined : +f.estimate, parts: parseParts(), note: f.note || undefined });
const complete = () => send('complete', { total: +f.total, result: f.result || undefined, warrantyDays: +f.warrantyDays || 0 });
const rate = () => safe(async () => { await api('/reviews', { method: 'POST', body: { bookingId: sel.value.id, rating: +f.rating, comment: f.comment || undefined } }); toast('Thanks for rating'); load(); });
const report = () => { const reason = prompt('What went wrong?'); if (reason) safe(async () => { await api('/reports', { method: 'POST', body: { targetId: sel.value.provider_id, bookingId: sel.value.id, reason } }); toast('Report sent'); }); };
const withWho = (b) => (role === 'client' ? b.provider_label : b.client_name);
</script>

<template>
  <Page :title="role === 'client' ? 'My repairs' : 'Bookings'">
    <div class="row" style="margin-bottom:12px">
      <select v-model="filter" class="field" style="padding:8px;border-radius:10px;border:1px solid var(--fx-line)"><option value="">All statuses</option><option v-for="s in ['requested', 'accepted', 'in_progress', 'completed', 'rejected', 'cancelled']" :key="s" :value="s">{{ s.replace('_', ' ') }}</option></select>
    </div>
    <p v-if="!shown.length" class="muted">No bookings yet.</p>
    <div class="grid">
      <div class="card click" v-for="b in shown" :key="b.id" @click="open(b)">
        <div class="row sb"><strong>#{{ b.id }} · {{ b.device }}</strong><span class="badge" :class="statusColor(b.status)">{{ b.status.replace('_', ' ') }}</span></div>
        <div class="muted">{{ withWho(b) }}<span v-if="b.technician_name"> · {{ b.technician_name }}</span></div>
        <div class="muted">{{ fmt(b.scheduled_at) }}</div>
        <div class="row sb" style="margin-top:8px"><span class="muted">{{ b.issue.slice(0, 50) }}</span><strong>{{ peso(b.total ?? b.estimate) }}</strong></div>
      </div>
    </div>

    <ion-modal :is-open="!!sel" @didDismiss="sel = null">
      <ion-header><ion-toolbar><ion-title>Booking #{{ sel?.id }}</ion-title><ion-buttons slot="end"><ion-button @click="sel = null">Close</ion-button></ion-buttons></ion-toolbar></ion-header>
      <ion-content class="ion-padding" v-if="sel">
        <div class="row sb"><h3 style="margin:0">{{ sel.device }}</h3><span class="badge" :class="statusColor(sel.status)">{{ sel.status.replace('_', ' ') }}</span></div>
        <p>{{ sel.issue }}</p>
        <div class="row"><img class="thumb" v-for="u in sel.photos" :key="u" :src="img(u)" alt="" /></div>
        <table class="t"><tr><td>Client</td><td>{{ sel.client_name }} <span class="muted" v-if="isProv">{{ sel.client_phone }}</span></td></tr><tr><td>Provider</td><td>{{ sel.provider_label }}</td></tr><tr v-if="sel.technician_name"><td>Technician</td><td>{{ sel.technician_name }}</td></tr>
          <tr><td>Schedule</td><td>{{ fmt(sel.scheduled_at) }}</td></tr><tr><td>Estimate</td><td>{{ peso(sel.estimate) }}</td></tr><tr v-if="sel.total != null"><td>Final total</td><td>{{ peso(sel.total) }} · {{ sel.payment_status }}</td></tr>
          <tr v-if="sel.warranty_until"><td>Warranty until</td><td>{{ day(sel.warranty_until) }}</td></tr><tr v-if="sel.result"><td>Result</td><td>{{ sel.result }}</td></tr></table>
        <div v-if="sel.parts.length" style="margin-top:10px"><strong>Parts used</strong><div class="row sb" v-for="p in sel.parts" :key="p.name"><span>{{ p.name }}</span><span>{{ peso(p.cost) }}</span></div></div>
        <div style="margin-top:12px"><strong>Progress</strong><div class="muted" v-for="(s, i) in sel.progress" :key="i">{{ fmt(s.t) }} – {{ s.text }}</div></div>

        <div class="row" style="margin-top:16px">
          <template v-if="role === 'client'">
            <ion-button size="small" fill="outline" :router-link="'/messages?to=' + sel.provider_id" @click="sel = null">Message</ion-button>
            <ion-button size="small" color="danger" fill="outline" v-if="['requested', 'accepted'].includes(sel.status)" @click="send('cancel')">Cancel</ion-button>
            <ion-button size="small" v-if="sel.status === 'completed' && sel.payment_status === 'unpaid'" @click="send('pay')">Pay {{ peso(sel.total) }}</ion-button>
            <ion-button size="small" fill="outline" v-if="sel.status === 'completed' && !sel.reviewed" @click="act = 'rate'">Rate</ion-button>
            <ion-button size="small" fill="clear" color="danger" @click="report">Report problem</ion-button>
          </template>
          <template v-if="isProv">
            <ion-button size="small" v-if="sel.status === 'requested' && sel.provider_id === session.user.id" @click="send('accept')">Accept</ion-button>
            <ion-button size="small" color="danger" fill="outline" v-if="['requested', 'accepted'].includes(sel.status) && sel.provider_id === session.user.id" @click="send('reject')">Reject</ion-button>
            <ion-button size="small" fill="outline" v-if="['requested', 'accepted'].includes(sel.status) && sel.provider_id === session.user.id" @click="act = 'resched'">Reschedule</ion-button>
            <ion-button size="small" fill="outline" v-if="role === 'shop' && ['requested', 'accepted'].includes(sel.status)" @click="act = 'assign'">Assign technician</ion-button>
            <ion-button size="small" v-if="sel.status === 'accepted'" @click="send('start')">Start repair</ion-button>
            <ion-button size="small" fill="outline" v-if="['accepted', 'in_progress'].includes(sel.status)" @click="act = 'update'">Estimate & parts</ion-button>
            <ion-button size="small" v-if="sel.status === 'in_progress'" @click="act = 'complete'">Complete</ion-button>
            <ion-button size="small" fill="outline" :router-link="'/messages?to=' + sel.client_id" @click="sel = null">Message client</ion-button>
          </template>
        </div>

        <form class="card" style="margin-top:12px" v-if="act === 'resched'" @submit.prevent="reschedule"><div class="field"><label>New date and time</label><input type="datetime-local" v-model="f.when" required /></div><ion-button type="submit">Send new time</ion-button></form>
        <form class="card" style="margin-top:12px" v-if="act === 'assign'" @submit.prevent="assign"><div class="field"><label>Technician</label><select v-model="f.technicianId"><option value="">Unassigned</option><option v-for="s in staff.filter((x) => x.status === 'active')" :key="s.id" :value="s.id">{{ s.name }}</option></select></div><ion-button type="submit">Assign</ion-button></form>
        <form class="card" style="margin-top:12px" v-if="act === 'update'" @submit.prevent="update"><div class="field"><label>Estimate (₱)</label><input type="number" min="0" step="any" v-model="f.estimate" /></div><div class="field"><label>Parts, one per line as name:cost</label><textarea rows="3" v-model="f.partsText" placeholder="OLED screen:2500" /></div><div class="field"><label>Note for the client</label><input v-model="f.note" /></div><ion-button type="submit">Save update</ion-button></form>
        <form class="card" style="margin-top:12px" v-if="act === 'complete'" @submit.prevent="complete"><div class="field"><label>Final total (₱)</label><input type="number" min="0" step="any" v-model="f.total" required /></div><div class="field"><label>Repair result</label><textarea rows="2" v-model="f.result" /></div><div class="field"><label>Warranty (days)</label><input type="number" min="0" v-model="f.warrantyDays" /></div><ion-button type="submit">Mark completed</ion-button></form>
        <form class="card" style="margin-top:12px" v-if="act === 'rate'" @submit.prevent="rate"><div class="field"><label>Rating</label><select v-model="f.rating"><option v-for="n in [5, 4, 3, 2, 1]" :key="n" :value="n">{{ n }} ★</option></select></div><div class="field"><label>Comment</label><textarea rows="3" v-model="f.comment" /></div><ion-button type="submit">Submit rating</ion-button></form>
      </ion-content>
    </ion-modal>
  </Page>
</template>
