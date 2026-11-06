<script setup>
import { ref, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../views/Page.vue';
import { api, safe, upload, toast, img, peso, day, toEpoch } from '../api';
const route = useRoute(), router = useRouter();
const p = ref(null), photos = ref([]);
const b = reactive({ serviceId: '', technicianId: '', device: '', issue: '', when: '' });
const minWhen = ref('');
const localDateTime = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
onIonViewWillEnter(async () => {
  minWhen.value = localDateTime(new Date(Math.ceil(Date.now() / 60000) * 60000));
  p.value = await api('/providers/' + route.params.id);
  b.technicianId = p.value.technicianId || '';
  photos.value = [];
});
const pickService = () => { const s = p.value.services.find((x) => x.id === b.serviceId); if (s) b.device = s.device || b.device; };
const addPhoto = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) safe(async () => photos.value.push((await upload('/uploads/photo', f)).url)); };
const book = () => safe(async () => {
  if (!b.when || new Date(b.when).getTime() <= Date.now()) {
    throw new Error('Choose a future date and time for your booking.');
  }
  await api('/bookings', { method: 'POST', body: { providerId: p.value.id, technicianId: b.technicianId || undefined, serviceId: b.serviceId || undefined, device: b.device, issue: b.issue, scheduledAt: toEpoch(b.when), photos: photos.value } });
  toast('Booking sent. You will be notified when it is accepted.'); router.push('/bookings');
});
const report = () => { const reason = prompt('What went wrong?'); if (reason) safe(async () => { await api('/reports', { method: 'POST', body: { targetId: p.value.id, reason } }); toast('Report sent to administrators'); }); };
</script>

<template>
  <Page :title="p?.business_name || p?.name || 'Provider'">
    <div v-if="p" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));align-items:start">
      <div style="display:grid;gap:14px">
        <div class="card">
          <div class="row"><img class="avatar" style="width:64px;height:64px" :src="img(p.avatar)" alt="" /><div><h2 style="margin:0;color:var(--fx-navy)">{{ p.technicianId ? p.name : p.business_name || p.name }}</h2><span class="badge green">{{ p.technicianId ? `Technician at ${p.business_name || p.name}` : `Verified ${p.role === 'shop' ? 'shop' : 'independent technician'}` }}</span></div></div>
          <p>{{ p.technicianSpecialties || p.bio }}</p><div class="muted">{{ p.address }} {{ p.city }}</div><div class="muted" v-if="p.supported_devices">Devices: {{ p.supported_devices }}</div><div class="muted" v-if="p.warranty_terms">Warranty: {{ p.warranty_terms }}</div>
          <div class="row" style="margin-top:10px"><ion-button size="small" :router-link="'/messages?to=' + p.id">Message</ion-button><ion-button size="small" fill="clear" color="danger" @click="report">Report</ion-button></div>
          <div class="row" v-if="p.gallery.length" style="margin-top:10px"><img class="thumb" v-for="g in p.gallery" :key="g" :src="img(g)" alt="" /></div>
        </div>
        <div class="card"><strong>Services</strong><div class="row sb" v-for="s in p.services" :key="s.id" style="margin-top:8px"><span>{{ s.title }}<span class="muted"> · {{ s.device }}</span></span><strong>{{ peso(s.price) }}</strong></div><p v-if="!p.services.length" class="muted">No price list yet. Describe your issue and the provider will send an estimate.</p></div>
        <div class="card"><strong>Reviews</strong><p v-if="!p.reviews.length" class="muted">No reviews yet.</p><div v-for="(r, i) in p.reviews" :key="i" style="margin-top:8px"><span class="badge green">{{ r.rating }}★</span> <strong>{{ r.client }}</strong> <span class="muted">{{ day(r.created_at) }}</span><div class="muted">{{ r.comment }}</div></div></div>
      </div>
      <form class="card" @submit.prevent="book"><strong>Book a repair</strong>
        <div class="field" style="margin-top:10px" v-if="p.services.length"><label>Service</label><select v-model="b.serviceId" @change="pickService"><option value="">Not sure / other</option><option v-for="s in p.services" :key="s.id" :value="s.id">{{ s.title }} – {{ peso(s.price) }}</option></select></div>
        <div class="field" v-if="p.technicians.length"><label>Preferred technician</label><select v-model="b.technicianId"><option value="">Any available</option><option v-for="t in p.technicians" :key="t.id" :value="t.id">{{ t.name }}</option></select></div>
        <div class="field"><label>Device (brand and model)</label><input v-model="b.device" required placeholder="iPhone 13, Galaxy A54…" /></div>
        <div class="field"><label>What is wrong?</label><textarea v-model="b.issue" rows="4" minlength="5" required /></div>
        <div class="field"><label>Preferred date and time</label><input type="datetime-local" v-model="b.when" :min="minWhen" required /></div>
        <div class="field"><label>Photos of the device (up to 6)</label><input type="file" accept="image/png,image/jpeg,image/webp" @change="addPhoto" :disabled="photos.length >= 6" /><div class="row" style="margin-top:8px"><img class="thumb" v-for="u in photos" :key="u" :src="img(u)" alt="" /></div></div>
        <ion-button type="submit" expand="block">Send booking request</ion-button>
      </form>
    </div>
  </Page>
</template>
