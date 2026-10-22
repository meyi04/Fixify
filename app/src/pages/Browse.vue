<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../views/Page.vue';
import { api, safe, img, peso, toast } from '../api';
const router = useRouter();
const f = reactive({ q: '', type: '', device: '', repair: '', city: '', maxPrice: '', minRating: '', date: '', lat: '', lng: '' });
const list = ref([]), cats = ref([]), loading = ref(false), show = ref(false);
async function search() {
  loading.value = true;
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '')).toString();
  await safe(async () => (list.value = await api('/providers?' + qs))); loading.value = false;
}
onIonViewWillEnter(async () => { cats.value = await api('/categories'); search(); });
const near = () => navigator.geolocation?.getCurrentPosition((g) => { f.lat = g.coords.latitude; f.lng = g.coords.longitude; search(); }, () => toast('Location permission denied', 'danger'));
</script>

<template>
  <Page title="Find a fixer">
    <div class="card" style="margin-bottom:16px">
      <form @submit.prevent="search"><div class="row" style="flex-wrap:nowrap"><div class="field" style="flex:1;margin:0"><input v-model="f.q" placeholder="Search shops, technicians, devices" /></div><ion-button type="submit">Search</ion-button><ion-button fill="outline" @click="show = !show">Filters</ion-button></div>
      <div v-if="show" class="grid" style="margin-top:12px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
        <div class="field"><label>Type</label><select v-model="f.type"><option value="">Shops & technicians</option><option value="shop">Repair shops</option><option value="technician">Technicians</option></select></div>
        <div class="field"><label>Device</label><select v-model="f.device"><option value="">Any</option><option v-for="c in cats.filter((x) => x.kind === 'device')" :key="c.id">{{ c.name }}</option></select></div>
        <div class="field"><label>Repair</label><select v-model="f.repair"><option value="">Any</option><option v-for="c in cats.filter((x) => x.kind === 'repair')" :key="c.id">{{ c.name }}</option></select></div>
        <div class="field"><label>City</label><input v-model="f.city" /></div>
        <div class="field"><label>Max starting price</label><input v-model="f.maxPrice" type="number" min="0" /></div>
        <div class="field"><label>Minimum rating</label><select v-model="f.minRating"><option value="">Any</option><option>3</option><option>4</option><option>4.5</option></select></div>
        <div class="field"><label>Available on</label><input v-model="f.date" type="date" /></div>
        <div class="field"><label>Location</label><ion-button size="small" fill="outline" @click="near">{{ f.lat ? 'Using your location' : 'Sort by nearest' }}</ion-button></div>
      </div></form>
    </div>
    <p v-if="!loading && !list.length" class="muted">No verified fixers match. Try removing a filter.</p>
    <div class="grid">
      <div class="card click" v-for="x in list" :key="x.id" @click="router.push('/provider/' + x.id)">
        <div class="row"><img class="avatar" :src="img(x.avatar)" alt="" /><div><strong>{{ x.business_name || x.name }}</strong><div class="muted">{{ x.role === 'shop' ? 'Repair shop' : 'Technician' }} · {{ x.city || '—' }}<span v-if="x.distance_km != null"> · {{ x.distance_km }} km</span></div></div></div>
        <div style="margin:10px 0" class="muted">{{ x.specialties || x.supported_devices || 'General repairs' }}</div>
        <div class="row sb"><span class="badge green">{{ x.rating ? x.rating + '★ (' + x.reviews + ')' : 'New' }}</span><strong v-if="x.min_price != null">from {{ peso(x.min_price) }}</strong></div>
      </div>
    </div>
  </Page>
</template>
