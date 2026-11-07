<script setup>
import { ref, reactive } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../views/Page.vue';
import { api, safe, session, toast, peso } from '../api';
const list = ref([]), cats = ref([]), edit = ref(null);
const blank = () => ({ title: '', device: '', repair_type: '', price: 0, duration_min: 60 });
const f = reactive(blank());
const readOnly = !!session.user.shop_id;
async function load() { list.value = await api('/services'); cats.value = await api('/categories'); }
onIonViewWillEnter(load);
const startEdit = (s) => { edit.value = s?.id ?? 'new'; Object.assign(f, s ? { ...s } : blank()); };
const save = () => safe(async () => {
  const body = { title: f.title, device: f.device || undefined, repair_type: f.repair_type || undefined, price: +f.price, duration_min: +f.duration_min };
  await api(edit.value === 'new' ? '/services' : '/services/' + edit.value, { method: edit.value === 'new' ? 'POST' : 'PUT', body }); edit.value = null; toast('Saved'); load();
});
const toggle = (s) => safe(async () => { await api('/services/' + s.id, { method: 'PUT', body: { active: !s.active } }); load(); });
const del = (s) => confirm('Delete this service?') && safe(async () => { await api('/services/' + s.id, { method: 'DELETE' }); load(); });
</script>

<template>
  <Page title="Services & prices">
    <div v-if="!readOnly" class="row" style="margin-bottom:14px"><ion-button @click="startEdit(null)">Add service</ion-button></div>
    <form class="card" v-if="edit" @submit.prevent="save" style="margin-bottom:16px">
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <div class="field"><label>Title</label><input v-model="f.title" required /></div>
        <div class="field"><label>Device</label><select v-model="f.device"><option value="">Any</option><option v-for="c in cats.filter((x) => x.kind === 'device')" :key="c.id">{{ c.name }}</option></select></div>
        <div class="field"><label>Repair type</label><select v-model="f.repair_type"><option value="">Other</option><option v-for="c in cats.filter((x) => x.kind === 'repair')" :key="c.id">{{ c.name }}</option></select></div>
        <div class="field"><label>Price (₱)</label><input type="number" min="0" step="any" v-model="f.price" required /></div>
        <div class="field"><label>Duration (minutes)</label><input type="number" min="5" v-model="f.duration_min" /></div>
      </div>
      <ion-button type="submit">Save</ion-button><ion-button fill="clear" @click="edit = null">Cancel</ion-button>
    </form>
    <p v-if="!list.length" class="muted">No services yet. Add your repair types and prices so clients can book them.</p>
    <div class="grid">
      <div class="card" v-for="s in list" :key="s.id" :style="{ opacity: s.active ? 1 : .55 }">
        <div class="row sb"><strong>{{ s.title }}</strong><strong>{{ peso(s.price) }}</strong></div>
        <div class="muted">{{ s.device || 'Any device' }} · {{ s.repair_type || 'General' }} · {{ s.duration_min }} min</div>
        <div class="row" v-if="!readOnly" style="margin-top:8px"><ion-button size="small" fill="outline" @click="startEdit(s)">Edit</ion-button><ion-button size="small" fill="outline" @click="toggle(s)">{{ s.active ? 'Hide' : 'Show' }}</ion-button><ion-button size="small" fill="clear" color="danger" @click="del(s)">Delete</ion-button></div>
      </div>
    </div>
  </Page>
</template>
