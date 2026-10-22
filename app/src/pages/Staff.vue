<script setup>
import { ref, reactive } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../views/Page.vue';
import { api, safe, toast, statusColor } from '../api';
const list = ref([]), show = ref(false), f = reactive({ name: '', email: '', password: '', specialties: '' });
const load = async () => (list.value = await api('/staff'));
onIonViewWillEnter(load);
const add = () => safe(async () => { await api('/staff', { method: 'POST', body: { ...f, specialties: f.specialties || undefined } }); Object.assign(f, { name: '', email: '', password: '', specialties: '' }); show.value = false; toast('Technician account created'); load(); });
const setStatus = (s, status) => safe(async () => { await api('/staff/' + s.id, { method: 'PATCH', body: { status } }); load(); });
</script>

<template>
  <Page title="Staff access">
    <template #actions><ion-button @click="show = !show">Add technician</ion-button></template>
    <form class="card" v-if="show" @submit.prevent="add" style="margin-bottom:16px">
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <div class="field"><label>Name</label><input v-model="f.name" required /></div><div class="field"><label>Email</label><input type="email" v-model="f.email" required /></div>
        <div class="field"><label>Temporary password</label><input type="password" v-model="f.password" required autocomplete="new-password" /></div><div class="field"><label>Specialties</label><input v-model="f.specialties" /></div>
      </div><div class="muted">At least 10 characters with upper case, lower case and a number. Share it privately; the technician can change it in Profile.</div><ion-button type="submit" style="margin-top:8px">Create account</ion-button>
    </form>
    <p v-if="!list.length" class="muted">No staff yet. Staff can only see jobs you assign to them.</p>
    <div class="grid"><div class="card" v-for="s in list" :key="s.id"><div class="row sb"><strong>{{ s.name }}</strong><span class="badge" :class="statusColor(s.status)">{{ s.status }}</span></div><div class="muted">{{ s.email }}</div><div class="muted">{{ s.specialties }}</div>
      <ion-button size="small" fill="outline" style="margin-top:8px" @click="setStatus(s, s.status === 'active' ? 'suspended' : 'active')">{{ s.status === 'active' ? 'Suspend access' : 'Restore access' }}</ion-button></div></div>
  </Page>
</template>
