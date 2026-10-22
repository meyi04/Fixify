<script setup>
import { ref, reactive } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../../views/Page.vue';
import { api, safe, toast } from '../../api';
const cats = ref([]), c = reactive({ name: '', kind: 'device' }), a = reactive({ title: '', body: '', audience: 'all' }), terms = ref('');
async function load() { cats.value = await api('/admin/categories'); terms.value = (await api('/admin/settings')).terms; }
onIonViewWillEnter(load);
const addCat = () => safe(async () => { await api('/admin/categories', { method: 'POST', body: c }); c.name = ''; load(); });
const toggle = (x) => safe(async () => { await api('/admin/categories/' + x.id, { method: 'PATCH', body: { active: !x.active } }); load(); });
const del = (x) => confirm('Delete category?') && safe(async () => { await api('/admin/categories/' + x.id, { method: 'DELETE' }); load(); });
const announce = () => safe(async () => { await api('/admin/announcements', { method: 'POST', body: a }); Object.assign(a, { title: '', body: '' }); toast('Announcement sent'); });
const saveTerms = () => safe(async () => { await api('/admin/settings', { method: 'PUT', body: { terms: terms.value } }); toast('Saved'); });
</script>

<template>
  <Page title="Content & announcements">
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));align-items:start">
      <div class="card"><strong>Device & repair categories</strong>
        <form class="row" style="margin:10px 0" @submit.prevent="addCat"><div class="field" style="margin:0"><input v-model="c.name" placeholder="New category" required /></div><select v-model="c.kind"><option value="device">device</option><option value="repair">repair</option></select><ion-button size="small" type="submit">Add</ion-button></form>
        <div class="row sb" v-for="x in cats" :key="x.id" :style="{ opacity: x.active ? 1 : .5 }"><span>{{ x.name }} <span class="muted">{{ x.kind }}</span></span><span><ion-button size="small" fill="clear" @click="toggle(x)">{{ x.active ? 'Hide' : 'Show' }}</ion-button><ion-button size="small" fill="clear" color="danger" @click="del(x)">Delete</ion-button></span></div></div>
      <div style="display:grid;gap:14px">
        <form class="card" @submit.prevent="announce"><strong>System announcement</strong>
          <div class="field" style="margin-top:10px"><label>Audience</label><select v-model="a.audience"><option value="all">Everyone</option><option value="client">Clients</option><option value="shop">Shops</option><option value="technician">Technicians</option></select></div>
          <div class="field"><label>Title</label><input v-model="a.title" required /></div><div class="field"><label>Message</label><textarea rows="3" v-model="a.body" required /></div><ion-button type="submit">Send announcement</ion-button></form>
        <div class="card"><strong>Terms of service</strong><div class="field" style="margin-top:10px"><textarea rows="6" v-model="terms" /></div><ion-button size="small" @click="saveTerms">Save terms</ion-button></div>
      </div>
    </div>
  </Page>
</template>
