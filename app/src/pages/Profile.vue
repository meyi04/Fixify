<script setup>
import { ref, reactive } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../views/Page.vue';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { api, safe, upload, toast, img, session, openPrivate, statusColor } from '../api';
import { firebaseAuth } from '../firebase';
const p = ref(null), pw = reactive({ current: '', password: '' }), docType = ref('Business permit');
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const isProv = () => ['shop', 'technician'].includes(session.user.role);
async function load() { p.value = await api('/profile'); }
onIonViewWillEnter(load);
const num = (v) => (v === '' || v == null ? null : +v);
async function save() {
  const x = p.value, body = { name: x.name, phone: x.phone || undefined };
  if (isProv()) Object.assign(body, { business_name: x.business_name || undefined, bio: x.bio || '', address: x.address || '', city: x.city || '', specialties: x.specialties || '', supported_devices: x.supported_devices || '', service_areas: x.service_areas || '', warranty_terms: x.warranty_terms || '', service_radius_km: +x.service_radius_km || 0, capacity: +x.capacity || 1, lat: num(x.lat), lng: num(x.lng), working_hours: x.working_hours });
  else body.city = x.city || '';
  await safe(async () => {
    await api('/profile', { method: 'PUT', body });
    if (firebaseAuth.currentUser && x.name !== firebaseAuth.currentUser.displayName) await updateProfile(firebaseAuth.currentUser, { displayName: x.name });
    session.user.name = x.name;
    toast('Profile saved');
  });
}
const pick = (cb) => (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) safe(() => cb(f)); };
const setAvatar = pick(async (f) => { const r = await upload('/profile/avatar', f); p.value.avatar = r.avatar; session.user.avatar = r.avatar; });
const addPhoto = pick(async (f) => { p.value.gallery = (await upload('/profile/gallery', f)).gallery; });
const addDoc = pick(async (f) => { await upload('/documents', f, { type: docType.value }); toast('Submitted for review'); load(); });
const rmPhoto = (u) => safe(async () => { await api('/profile/gallery?url=' + encodeURIComponent(u), { method: 'DELETE' }); load(); });
const rmDoc = (id) => safe(async () => { await api('/documents/' + id, { method: 'DELETE' }); load(); });
const toggleDay = (d) => { const h = p.value.working_hours; if (h[d]) delete h[d]; else h[d] = ['09:00', '18:00']; };
const locate = () => navigator.geolocation?.getCurrentPosition((g) => { p.value.lat = +g.coords.latitude.toFixed(5); p.value.lng = +g.coords.longitude.toFixed(5); }, () => toast('Location permission denied', 'danger'));
const changePw = () => safe(async () => {
  const user = firebaseAuth.currentUser;
  if (!user?.email) throw new Error('Sign in again before changing your password');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw.current));
  await updatePassword(user, pw.password);
  pw.current = '';
  pw.password = '';
  toast('Password updated');
});
</script>

<template>
  <Page title="Profile">
    <div v-if="p" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));align-items:start">
      <div class="card">
        <div class="row" style="margin-bottom:12px">
          <img class="avatar" style="width:72px;height:72px" :src="img(p.avatar)" alt="" />
          <label class="muted"><input type="file" accept="image/png,image/jpeg,image/webp" @change="setAvatar" /></label>
        </div>
        <div class="field"><label>Name</label><input v-model="p.name" /></div>
        <div class="field"><label>Email</label><input :value="p.email" disabled /></div>
        <div class="field"><label>Phone</label><input v-model="p.phone" type="tel" /></div>
        <div class="field"><label>City</label><input v-model="p.city" /></div>
        <template v-if="isProv()">
          <div class="field" v-if="p.role === 'shop'"><label>Business name</label><input v-model="p.business_name" /></div>
          <div class="field"><label>About</label><textarea v-model="p.bio" rows="3" /></div>
          <div class="field"><label>Address</label><input v-model="p.address" /></div>
          <div class="row"><div class="field" style="flex:1"><label>Latitude</label><input v-model="p.lat" type="number" step="any" /></div><div class="field" style="flex:1"><label>Longitude</label><input v-model="p.lng" type="number" step="any" /></div></div>
          <ion-button size="small" fill="outline" @click="locate">Use my location</ion-button>
          <div class="field" style="margin-top:12px"><label>Specialties (comma separated)</label><input v-model="p.specialties" /></div>
          <div class="field"><label>Supported devices (comma separated)</label><input v-model="p.supported_devices" /></div>
          <div class="field"><label>Service areas</label><input v-model="p.service_areas" /></div>
          <div class="row"><div class="field" style="flex:1"><label>Service radius (km)</label><input v-model="p.service_radius_km" type="number" min="0" /></div><div class="field" style="flex:1"><label>Jobs per day</label><input v-model="p.capacity" type="number" min="1" /></div></div>
          <div class="field"><label>Warranty terms</label><textarea v-model="p.warranty_terms" rows="2" /></div>
        </template>
        <ion-button expand="block" @click="save">Save changes</ion-button>
      </div>

      <div v-if="isProv()" style="display:grid;gap:14px">
        <div class="card"><strong>Working hours</strong>
          <div class="row" v-for="d in DAYS" :key="d" style="margin-top:8px;flex-wrap:nowrap">
            <ion-checkbox :checked="!!p.working_hours[d]" @ionChange="toggleDay(d)" style="width:60px">{{ d }}</ion-checkbox>
            <template v-if="p.working_hours[d]"><input type="time" v-model="p.working_hours[d][0]" /><span>to</span><input type="time" v-model="p.working_hours[d][1]" /></template><span v-else class="muted">Closed</span>
          </div>
        </div>
        <div class="card"><strong>Photos</strong>
          <div class="row" style="margin:10px 0"><div v-for="g in p.gallery" :key="g" style="position:relative"><img class="thumb" :src="img(g)" alt="" /><a style="position:absolute;top:2px;right:6px;color:#fff;cursor:pointer" @click="rmPhoto(g)">✕</a></div></div>
          <input type="file" accept="image/png,image/jpeg,image/webp" @change="addPhoto" />
        </div>
        <div class="card" v-if="!session.user.shop_id"><strong>Permits & documents</strong>
          <div class="row sb" style="margin:8px 0"><span class="muted">Account verification</span><span class="badge" :class="p.approved ? 'green' : 'amber'">{{ p.approved ? 'Approved' : 'Pending approval' }}</span></div>
          <div class="row sb" v-for="d in p.documents" :key="d.id" style="margin-bottom:6px"><a style="cursor:pointer" @click="openPrivate(`/documents/${d.id}/file`)">{{ d.type }}</a>
            <span><span class="badge" :class="statusColor(d.status)">{{ d.status }}</span> <a v-if="d.status !== 'approved'" style="cursor:pointer;color:var(--ion-color-danger)" @click="rmDoc(d.id)">remove</a></span><div v-if="d.note" class="muted" style="width:100%">{{ d.note }}</div></div>
          <div class="field"><select v-model="docType"><option>Business permit</option><option>DTI / SEC registration</option><option>Mayor's permit</option><option>Government ID</option><option>Technician certificate</option></select></div>
          <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" @change="addDoc" />
          <p class="muted">Only you and administrators can open these files.</p>
        </div>
      </div>

      <div class="card"><strong>Security</strong>
        <div class="field" style="margin-top:10px"><label>Current password</label><input type="password" v-model="pw.current" autocomplete="current-password" /></div>
        <div class="field"><label>New password</label><input type="password" v-model="pw.password" autocomplete="new-password" /></div>
        <ion-button fill="outline" @click="changePw">Change password</ion-button><div class="muted">You will be signed out on all devices.</div>
      </div>
    </div>
  </Page>
</template>
