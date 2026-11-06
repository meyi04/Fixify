<script setup>
import { ref, reactive } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import Page from '../../views/Page.vue';
import { api, safe, toast, day, statusColor, session } from '../../api';
const list = ref([]), q = reactive({ role: '', status: '', q: '' }), show = ref(false);
const PERMS = ['users', 'documents', 'billing', 'finance', 'reports', 'content', 'admins', 'settings'];
const f = reactive({ name: '', email: '', password: '', role: 'admin', permissions: [] });
const permissions = JSON.parse(session.user.permissions || '[]');
const isSuper = permissions.includes('*');
const canCreateAccounts = isSuper || permissions.includes('admins');
async function load() { list.value = await api('/admin/users?' + new URLSearchParams(Object.entries(q).filter(([, v]) => v))); }
onIonViewWillEnter(load);
const setStatus = (u, status) => { const reason = status === 'active' ? '' : prompt('Reason (shown to the user)') ?? null; if (reason === null) return; safe(async () => { await api('/admin/users/' + u.id, { method: 'PATCH', body: { status, reason } }); load(); }); };
const create = () => safe(async () => { await api('/admin/users', { method: 'POST', body: { ...f } }); show.value = false; toast('Account created'); load(); });
const setPerms = (u) => { const cur = JSON.parse(u.permissions || '[]'); const v = prompt('Permissions (comma separated)\n' + PERMS.join(', '), cur.join(', ')); if (v !== null) safe(async () => { await api(`/admin/users/${u.id}/permissions`, { method: 'PUT', body: { permissions: v.split(',').map((s) => s.trim()).filter(Boolean) } }); load(); }); };
</script>

<template>
  <Page title="Users">
    <template #actions><ion-button v-if="canCreateAccounts" @click="show = !show">New account</ion-button></template>
    <form class="card" v-if="show" @submit.prevent="create" style="margin-bottom:16px">
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <div class="field"><label>Name</label><input v-model="f.name" required /></div><div class="field"><label>Email</label><input type="email" v-model="f.email" required /></div>
        <div class="field"><label>Password (12+ chars)</label><input type="password" v-model="f.password" required minlength="12" autocomplete="new-password" /></div>
        <div class="field"><label>Role</label><select v-model="f.role"><option>admin</option><option>client</option><option>shop</option><option>technician</option></select></div>
      </div>
      <div class="row" v-if="f.role === 'admin'"><label v-for="p in PERMS" :key="p" class="muted"><input type="checkbox" :value="p" v-model="f.permissions" /> {{ p }}</label></div>
      <ion-button type="submit" style="margin-top:8px">Create</ion-button>
    </form>
    <form class="row" style="margin-bottom:12px" @submit.prevent="load">
      <div class="field" style="margin:0"><input v-model="q.q" placeholder="Search name or email" /></div>
      <div class="field" style="margin:0"><select v-model="q.role" @change="load"><option value="">All roles</option><option>client</option><option>shop</option><option>technician</option><option>admin</option></select></div>
      <div class="field" style="margin:0"><select v-model="q.status" @change="load"><option value="">All statuses</option><option>active</option><option>unverified</option><option>suspended</option><option>deleted</option></select></div>
      <ion-button type="submit" size="small">Search</ion-button>
    </form>
    <div class="card scroll-x"><table class="t"><tr><th>Name</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr>
      <tr v-for="u in list" :key="u.id"><td><strong>{{ u.name }}</strong><div class="muted">{{ u.email }}</div></td><td>{{ u.role }}<span class="muted" v-if="u.shop_id"> (staff)</span></td><td><span class="badge" :class="statusColor(u.status)">{{ u.status }}</span></td><td>{{ day(u.created_at) }}</td>
        <td><template v-if="u.id !== session.user.id"><ion-button size="small" fill="outline" v-if="u.status === 'active'" color="danger" @click="setStatus(u, 'suspended')">Suspend</ion-button><ion-button size="small" fill="outline" v-else @click="setStatus(u, 'active')">Reactivate</ion-button>
          <ion-button size="small" fill="clear" color="danger" v-if="u.status !== 'deleted'" @click="setStatus(u, 'deleted')">Delete</ion-button><ion-button size="small" fill="clear" v-if="isSuper && u.role === 'admin'" @click="setPerms(u)">Permissions</ion-button></template></td></tr></table></div>
  </Page>
</template>
