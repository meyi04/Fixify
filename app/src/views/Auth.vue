<script setup>
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { api, clearSessionCache, safe, setSession, toast } from '../api';
import { firebaseAuth } from '../firebase';
import { constructOutline, shieldCheckmarkOutline, timeOutline } from 'ionicons/icons';
const router = useRouter();
const mode = ref('login');
const f = reactive({ role: 'client', name: '', email: '', phone: '', password: '', businessName: '', city: '' });
const busy = ref(false);
const titles = { login: 'Welcome back', register: 'Create your account', verify: 'Verify your email', forgot: 'Reset password' };
const strength = computed(() => [/.{10,}/, /[a-z]/, /[A-Z]/, /\d/].filter((r) => r.test(f.password)).length);
async function run(fn) { busy.value = true; await safe(fn); busy.value = false; }

async function finishLogin(user) {
  const token = await user.getIdToken(true);
  const account = await api('/auth/me');
  await setSession(token, account);
  router.replace('/dashboard');
}
const login = () => run(async () => {
  const credential = await signInWithEmailAndPassword(firebaseAuth, f.email.trim(), f.password);
  await credential.user.reload();
  if (!credential.user.emailVerified) {
    clearSessionCache();
    mode.value = 'verify';
    toast('Verify your email using the link we sent before signing in.');
    return;
  }
  await finishLogin(credential.user);
});
const register = () => run(async () => {
  if (strength.value !== 4) throw new Error('Use at least 10 characters with an uppercase letter, a lowercase letter, and a number.');
  let user = firebaseAuth.currentUser;
  if (!user || user.email !== f.email.trim()) {
    user = (await createUserWithEmailAndPassword(firebaseAuth, f.email.trim(), f.password)).user;
  }
  if (user.displayName !== f.name) await updateProfile(user, { displayName: f.name });
  await api('/auth/register', { method: 'POST', body: {
    role: f.role, name: f.name, phone: f.phone || undefined, city: f.city || undefined,
    businessName: f.role === 'shop' ? f.businessName : undefined,
  } });
  await user.reload();
  if (!user.emailVerified) await sendEmailVerification(user);
  clearSessionCache();
  mode.value = 'verify';
  toast('Check your email and open the verification link to activate your account.');
});
const verify = () => run(async () => {
  const user = firebaseAuth.currentUser;
  if (!user) {
    mode.value = 'login';
    toast('Sign in after opening the Firebase verification link.');
    return;
  }
  await user.reload();
  if (!user.emailVerified) {
    toast('Your email is not verified yet. Open the link in your inbox.');
    return;
  }
  await finishLogin(user);
});
const resend = () => run(async () => {
  const user = firebaseAuth.currentUser;
  if (!user || user.email !== f.email.trim()) {
    mode.value = 'login';
    toast('Sign in with this email to request a new verification link.');
    return;
  }
  await sendEmailVerification(user);
  toast('A new verification link was sent.');
});
const forgot = () => run(async () => {
  try {
    await sendPasswordResetEmail(firebaseAuth, f.email.trim());
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
  toast('If an account exists for that email, a password reset link was sent.');
  mode.value = 'login';
});
const submit = () => ({ login, register, verify, forgot }[mode.value])();
</script>

<template>
  <ion-page>
    <ion-content :scroll-y="true">
      <div class="auth">
        <section class="hero">
          <div class="hero-brand"><span class="hero-mark"><ion-icon :icon="constructOutline" /></span><span>Fixify</span></div>
          <div class="hero-copy">
            <span class="hero-kicker">REPAIRS, WITHOUT THE RUNAROUND</span>
            <h1>Your gadgets.<br />Back to their best.</h1>
            <p>Find a trusted local repair expert, book with confidence, and follow every step from one simple place.</p>
            <div class="hero-points">
              <div><ion-icon :icon="shieldCheckmarkOutline" /><span>Verified repair professionals</span></div>
              <div><ion-icon :icon="timeOutline" /><span>Booking and repair updates</span></div>
            </div>
          </div>
          <div class="hero-art" aria-hidden="true">
            <div class="repair-card">
              <div class="repair-card-top"><span class="repair-icon"><ion-icon :icon="constructOutline" /></span><span class="repair-status">REPAIR CARE</span></div>
              <div class="repair-line"></div><div class="repair-line short"></div>
              <div class="repair-progress"><span></span></div>
              <div class="repair-caption">A better way to get it fixed.</div>
            </div>
            <span class="hero-spark spark-one">✦</span><span class="hero-spark spark-two">✳</span>
          </div>
        </section>
        <section class="panel">
          <div class="panel-inner">
          <div class="panel-kicker">{{ mode === 'login' ? 'YOUR REPAIR JOURNEY STARTS HERE' : 'A FEW DETAILS AND YOU’RE SET' }}</div>
          <h2>{{ titles[mode] }}</h2>
          <p class="panel-intro">{{ mode === 'login' ? 'Sign in to manage bookings, message your fixer, and keep track of every repair.' : mode === 'verify' ? 'Open the verification link from Firebase in your email, then continue.' : 'Enter your details below to continue securely.' }}</p>
          <form @submit.prevent="submit" autocomplete="on">
            <div v-if="mode === 'register'">
              <div class="field"><label>I am a</label>
                <select v-model="f.role"><option value="client">Client – I need a repair</option><option value="shop">Repair shop owner</option><option value="technician">Independent technician</option></select></div>
              <div class="field"><label>Full name</label><input v-model="f.name" required autocomplete="name" /></div>
              <div class="field" v-if="f.role === 'shop'"><label>Business name</label><input v-model="f.businessName" required /></div>
              <div class="field"><label>Phone</label><input v-model="f.phone" type="tel" autocomplete="tel" /></div>
              <div class="field"><label>City</label><input v-model="f.city" autocomplete="address-level2" /></div>
            </div>
            <div class="field" v-if="mode !== 'verify'"><label>Email</label><input v-model="f.email" type="email" required autocomplete="email" /></div>
            <div class="field" v-if="['login', 'register'].includes(mode)">
              <label>Password</label>
              <input v-model="f.password" type="password" required :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" />
              <div v-if="mode !== 'login'" class="muted">At least 10 characters with upper case, lower case and a number. Strength {{ strength }}/4</div>
            </div>
            <ion-button v-if="mode !== 'verify'" type="submit" expand="block" :disabled="busy">{{ { login: 'Sign in', register: 'Create account', forgot: 'Send reset link' }[mode] }}</ion-button>
          </form>
          <ion-button v-if="mode === 'verify'" expand="block" :disabled="busy" @click="verify">I verified my email</ion-button>
          <div class="links">
            <template v-if="mode === 'login'"><a @click="mode = 'register'">Create an account</a><a @click="mode = 'forgot'">Forgot password?</a></template>
            <template v-else><a @click="mode = 'login'">Back to sign in</a><a v-if="mode === 'verify'" @click="resend">Send a new code</a></template>
          </div>
          <div class="panel-foot"><ion-icon :icon="shieldCheckmarkOutline" /> Your account and information are protected.</div>
          </div>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.auth { min-height: 100%; display: grid; grid-template-columns: 1fr; background: #fff; }
.hero {
  position: relative;
  display: flex;
  min-height: 330px;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  padding: 26px 24px 34px;
  background: radial-gradient(ellipse at 83% 72%, rgb(109 146 255 / 45%), transparent 34%), linear-gradient(145deg, #172954, #233f86 58%, #365fe0);
  color: #fff;
}
.hero::before { position: absolute; top: 25%; right: -190px; width: 460px; height: 460px; border: 1px solid rgb(255 255 255 / 10%); border-radius: 50%; content: ''; box-shadow: 0 0 0 42px rgb(255 255 255 / 4%), 0 0 0 86px rgb(255 255 255 / 3%); }
.hero-brand, .hero-copy, .hero-art { position: relative; z-index: 1; }
.hero-brand { display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 800; letter-spacing: -.05em; }
.hero-mark { display: grid; width: 37px; height: 37px; place-items: center; border: 1px solid rgb(255 255 255 / 25%); border-radius: 12px; background: rgb(255 255 255 / 13%); font-size: 19px; }
.hero-copy { max-width: 510px; margin-top: 37px; }
.hero-kicker { color: #c2d0ff; font-size: 9px; font-weight: 800; letter-spacing: .16em; }
.hero h1 { margin: 12px 0 11px; color: #fff; font-size: clamp(34px, 8vw, 52px); font-weight: 800; line-height: 1.07; letter-spacing: -.06em; }
.hero p { max-width: 420px; margin: 0; color: #e0e7ff; font-size: 13px; line-height: 1.75; }
.hero-points { display: flex; flex-wrap: wrap; gap: 11px 20px; margin-top: 21px; }
.hero-points div { display: flex; align-items: center; gap: 7px; color: #e3eaff; font-size: 10px; font-weight: 600; }
.hero-points ion-icon { color: #a7bcff; font-size: 16px; }
.hero-art { display: none; }
.panel { display: flex; width: 100%; align-items: flex-start; justify-content: center; padding: 32px 22px 42px; }
.panel-inner { width: min(100%, 430px); }
.panel-kicker { margin-bottom: 7px; color: #8793a8; font-size: 9px; font-weight: 800; letter-spacing: .13em; }
.panel h2 { margin: 0 0 7px; color: var(--fx-navy); font-size: 25px; font-weight: 800; letter-spacing: -.05em; }
.panel-intro { margin: 0 0 23px; color: var(--fx-muted); font-size: 12px; line-height: 1.6; }
.links { display: flex; justify-content: space-between; gap: 12px; margin-top: 17px; font-size: 12px; }
.links a { color: var(--fx-blue); cursor: pointer; font-weight: 700; }
.panel-foot { display: flex; align-items: center; gap: 7px; margin-top: 28px; color: #8a95a8; font-size: 10px; }
.panel-foot ion-icon { color: #318c70; font-size: 15px; }
@media (min-width: 900px) {
  .auth { min-height: 100vh; grid-template-columns: minmax(420px, 1.04fr) minmax(460px, .96fr); }
  .hero { min-height: 100vh; padding: 32px clamp(42px, 7vw, 100px) 48px; }
  .hero-copy { margin-top: auto; margin-bottom: auto; padding: 42px 0; }
  .hero h1 { font-size: clamp(48px, 5vw, 68px); }
  .hero p { font-size: 14px; }
  .hero-points { gap: 17px 23px; }
  .hero-points div { font-size: 11px; }
  .hero-art { display: block; position: absolute; right: 10%; bottom: 10%; width: 235px; }
  .repair-card { padding: 17px; border: 1px solid rgb(255 255 255 / 28%); border-radius: 16px; background: rgb(255 255 255 / 11%); box-shadow: 0 22px 60px rgb(10 24 59 / 25%); backdrop-filter: blur(12px); transform: rotate(-5deg); }
  .repair-card-top { display: flex; align-items: center; gap: 10px; }
  .repair-icon { display: grid; width: 31px; height: 31px; place-items: center; border-radius: 10px; background: rgb(255 255 255 / 17%); font-size: 16px; }
  .repair-status { color: #d8e1ff; font-size: 8px; font-weight: 800; letter-spacing: .13em; }
  .repair-line { width: 88%; height: 7px; margin-top: 17px; border-radius: 9px; background: rgb(255 255 255 / 35%); }
  .repair-line.short { width: 56%; height: 5px; margin-top: 8px; background: rgb(255 255 255 / 19%); }
  .repair-progress { height: 5px; margin-top: 17px; overflow: hidden; border-radius: 9px; background: rgb(255 255 255 / 19%); }
  .repair-progress span { display: block; width: 68%; height: 100%; border-radius: inherit; background: #b7cbff; }
  .repair-caption { margin-top: 10px; color: #ecf1ff; font-size: 9px; font-weight: 600; }
  .hero-spark { position: absolute; color: #d5dfff; }
  .spark-one { top: -21px; right: -21px; font-size: 20px; }
  .spark-two { bottom: -22px; left: -23px; font-size: 18px; }
  .panel { align-items: center; padding: 50px 42px; }
}
@media (max-width: 480px) {
  .hero { min-height: 270px; padding: 22px 20px 27px; }
  .hero-copy { margin-top: 27px; }
  .hero h1 { font-size: 35px; }
  .hero-points { gap: 8px 14px; margin-top: 15px; }
  .hero-points div { font-size: 9px; }
  .panel { padding: 28px 20px 38px; }
}
</style>
