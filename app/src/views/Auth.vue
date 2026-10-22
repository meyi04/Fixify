<script setup>
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api, safe, setSession, toast } from '../api';
const router = useRouter();
const mode = ref('login'); // login | register | verify | forgot | reset
const f = reactive({ role: 'client', name: '', email: '', phone: '', password: '', businessName: '', city: '', code: '' });
const busy = ref(false);
const titles = { login: 'Welcome back', register: 'Create your account', verify: 'Verify your email', forgot: 'Reset password', reset: 'Choose a new password' };
const strength = computed(() => [/.{10,}/, /[a-z]/, /[A-Z]/, /\d/].filter((r) => r.test(f.password)).length);
async function run(fn) { busy.value = true; await safe(fn); busy.value = false; }

const login = () => run(async () => {
  try { const r = await api('/auth/login', { method: 'POST', body: { email: f.email, password: f.password } }); setSession(r.token, r.user); router.replace('/dashboard'); }
  catch (e) { if (e.data?.needsVerify) { mode.value = 'verify'; toast('Enter the code we sent you'); } else throw e; }
});
const register = () => run(async () => {
  const body = { role: f.role, name: f.name, email: f.email, password: f.password, phone: f.phone || undefined, city: f.city || undefined, businessName: f.role === 'shop' ? f.businessName : undefined };
  await api('/auth/register', { method: 'POST', body }); mode.value = 'verify'; toast('Check your email for a 6-digit code');
});
const verify = () => run(async () => { const r = await api('/auth/verify', { method: 'POST', body: { email: f.email, code: f.code } }); toast(r.message); f.code = ''; mode.value = 'login'; });
const resend = () => run(async () => toast((await api('/auth/resend', { method: 'POST', body: { email: f.email } })).message));
const forgot = () => run(async () => { toast((await api('/auth/forgot', { method: 'POST', body: { email: f.email } })).message); mode.value = 'reset'; });
const reset = () => run(async () => { toast((await api('/auth/reset', { method: 'POST', body: { email: f.email, code: f.code, password: f.password } })).message); mode.value = 'login'; });
const submit = () => ({ login, register, verify, forgot, reset }[mode.value])();
</script>

<template>
  <ion-page>
    <ion-content :scroll-y="true">
      <div class="auth">
        <section class="hero">
          <h1>Fixify</h1>
          <p>Find a trusted repair shop or technician for your phone and gadgets. Book, chat and track your repair in one place.</p>
        </section>
        <section class="panel">
          <h2>{{ titles[mode] }}</h2>
          <form @submit.prevent="submit" autocomplete="on">
            <div v-if="mode === 'register'">
              <div class="field"><label>I am a</label>
                <select v-model="f.role"><option value="client">Client – I need a repair</option><option value="shop">Repair shop owner</option><option value="technician">Independent technician</option></select></div>
              <div class="field"><label>Full name</label><input v-model="f.name" required autocomplete="name" /></div>
              <div class="field" v-if="f.role === 'shop'"><label>Business name</label><input v-model="f.businessName" required /></div>
              <div class="field"><label>Phone</label><input v-model="f.phone" type="tel" autocomplete="tel" /></div>
              <div class="field"><label>City</label><input v-model="f.city" autocomplete="address-level2" /></div>
            </div>
            <div class="field"><label>Email</label><input v-model="f.email" type="email" required autocomplete="email" /></div>
            <div class="field" v-if="['login', 'register', 'reset'].includes(mode)">
              <label>{{ mode === 'reset' ? 'New password' : 'Password' }}</label>
              <input v-model="f.password" type="password" required :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" />
              <div v-if="mode !== 'login'" class="muted">At least 10 characters with upper case, lower case and a number. Strength {{ strength }}/4</div>
            </div>
            <div class="field" v-if="['verify', 'reset'].includes(mode)"><label>6-digit code</label><input v-model="f.code" inputmode="numeric" maxlength="6" required autocomplete="one-time-code" /></div>
            <ion-button type="submit" expand="block" :disabled="busy">{{ { login: 'Sign in', register: 'Create account', verify: 'Verify email', forgot: 'Send reset code', reset: 'Save new password' }[mode] }}</ion-button>
          </form>
          <div class="links">
            <template v-if="mode === 'login'"><a @click="mode = 'register'">Create an account</a><a @click="mode = 'forgot'">Forgot password?</a></template>
            <template v-else><a @click="mode = 'login'">Back to sign in</a><a v-if="mode === 'verify'" @click="resend">Send a new code</a></template>
          </div>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.auth { min-height: 100%; display: grid; grid-template-columns: 1fr; }
.hero { background: linear-gradient(160deg, #0A2A6B, #1E5EFF); color: #fff; padding: 40px 24px 32px; }
.hero h1 { font-size: 40px; font-weight: 800; margin: 0 0 8px; letter-spacing: -1px; }
.hero p { max-width: 380px; line-height: 1.5; opacity: .92; margin: 0; }
.panel { padding: 28px 24px 48px; max-width: 460px; width: 100%; margin: 0 auto; }
.panel h2 { color: var(--fx-navy); margin: 0 0 18px; }
.links { display: flex; justify-content: space-between; margin-top: 16px; font-size: 14px; }
.links a { color: var(--fx-blue); cursor: pointer; font-weight: 600; }
@media (min-width: 900px) {
  .auth { grid-template-columns: 1fr 1fr; min-height: 100vh; }
  .hero { display: flex; flex-direction: column; justify-content: center; padding: 64px; } .hero h1 { font-size: 64px; }
  .panel { align-self: center; }
}
</style>
