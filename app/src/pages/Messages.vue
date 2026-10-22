<script setup>
import { ref, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { onIonViewWillEnter, onIonViewDidLeave } from '@ionic/vue';
import Page from '../views/Page.vue';
import { api, safe, session, img, fmt } from '../api';
const route = useRoute();
const threads = ref([]), current = ref(null), convo = ref({ messages: [] }), text = ref(''); let timer;
async function loadThreads() { threads.value = await api('/messages/threads'); }
async function open(id) {
  current.value = id; convo.value = await api('/messages/' + id); await nextTick();
  const el = document.getElementById('msgs'); if (el) el.scrollTop = el.scrollHeight;
}
async function send() { if (!text.value.trim()) return; await safe(() => api('/messages', { method: 'POST', body: { to: current.value, body: text.value } })); text.value = ''; await open(current.value); loadThreads(); }
onIonViewWillEnter(async () => {
  await loadThreads(); if (route.query.to) await open(+route.query.to);
  timer = setInterval(async () => { loadThreads(); if (current.value) { const c = await api('/messages/' + current.value); if (c.messages.length !== convo.value.messages.length) open(current.value); } }, 5000); // simple polling; swap for WebSocket/SSE later
});
onIonViewDidLeave(() => clearInterval(timer));
</script>

<template>
  <Page title="Messages">
    <div class="chat">
      <div class="list" :class="{ hide: current }">
        <p v-if="!threads.length" class="muted">No conversations yet. Open a provider profile and tap Message.</p>
        <div class="card click row" v-for="t in threads" :key="t.id" @click="open(t.id)" style="margin-bottom:8px">
          <img class="avatar" :src="img(t.avatar)" alt="" /><div style="flex:1;min-width:0"><strong>{{ t.name }}</strong><div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ t.last }}</div></div>
          <span class="badge" v-if="t.unread">{{ t.unread }}</span>
        </div>
      </div>
      <div class="pane card" v-if="current">
        <div class="row"><ion-button size="small" fill="clear" class="back" @click="current = null">Back</ion-button><strong>{{ convo.with?.name }}</strong></div>
        <div id="msgs" class="msgs">
          <div v-for="m in convo.messages" :key="m.id" :class="['m', m.sender_id === session.user.id ? 'me' : '']"><div>{{ m.body }}</div><small>{{ fmt(m.created_at) }}</small></div>
        </div>
        <form class="row" @submit.prevent="send" style="flex-wrap:nowrap"><div class="field" style="flex:1;margin:0"><input v-model="text" maxlength="2000" placeholder="Write a message" /></div><ion-button type="submit">Send</ion-button></form>
      </div>
      <div class="pane card muted gone" v-else>Select a conversation</div>
    </div>
  </Page>
</template>

<style scoped>
.chat { display: grid; gap: 14px; grid-template-columns: 1fr; }
.list.hide { display: none; } .gone { display: none; }
.msgs { height: 55vh; overflow-y: auto; padding: 10px 0; display: flex; flex-direction: column; gap: 8px; }
.m { max-width: 78%; background: var(--fx-sky); padding: 8px 12px; border-radius: 14px 14px 14px 4px; align-self: flex-start; }
.m.me { background: var(--fx-blue); color: #fff; align-self: flex-end; border-radius: 14px 14px 4px 14px; } .m small { opacity: .7; font-size: 10px; }
@media (min-width: 900px) { .chat { grid-template-columns: 300px 1fr; } .list.hide { display: block; } .gone { display: block; } .back { display: none; } }
</style>
