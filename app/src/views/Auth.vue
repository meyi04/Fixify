<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { api, clearSessionCache, safe, setSession, toast } from '../api';
import { firebaseAuth } from '../firebase';
import { constructOutline, eyeOffOutline, eyeOutline, phonePortraitOutline, shieldCheckmarkOutline } from 'ionicons/icons';
const router = useRouter();
const mode = ref('login');
const f = reactive({ role: 'client', name: '', email: '', phone: '', password: '', businessName: '', city: '' });
const busy = ref(false);
const showPassword = ref(false);
const activeSlide = ref(0);
const slides = [
  { icon: phonePortraitOutline, variant: 'device' },
  { icon: constructOutline, variant: 'repair' },
  { icon: shieldCheckmarkOutline, variant: 'secure' },
];
let carouselTimer;
const recentEmail = ref('');
try {
  recentEmail.value = window.localStorage.getItem('fixify.recentLoginEmail') || '';
} catch (error) {
  console.warn('Unable to load the recent login email.', error);
}
const titles = { login: 'Welcome back', register: 'Create your account', verify: 'Verify your email', forgot: 'Reset password' };
const strength = computed(() => [/.{10,}/, /[a-z]/, /[A-Z]/, /\d/].filter((r) => r.test(f.password)).length);
async function run(fn) { busy.value = true; await safe(fn); busy.value = false; }

onMounted(() => {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    carouselTimer = window.setInterval(() => {
      activeSlide.value = (activeSlide.value + 1) % slides.length;
    }, 5000);
  }
});
onBeforeUnmount(() => window.clearInterval(carouselTimer));

function rememberEmail(email) {
  try {
    window.localStorage.setItem('fixify.recentLoginEmail', email);
    recentEmail.value = email;
  } catch (error) {
    console.warn('Unable to save the recent login email.', error);
  }
}

async function finishLogin(user) {
  const token = await user.getIdToken(true);
  const account = await api('/auth/me');
  await setSession(token, account);
  router.replace('/dashboard');
}
const login = () => run(async () => {
  const credential = await signInWithEmailAndPassword(firebaseAuth, f.email.trim(), f.password);
  rememberEmail(f.email.trim());
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
  rememberEmail(f.email.trim());
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
          <div class="carousel" aria-label="Fixify illustrations">
            <div class="carousel-window">
              <div class="carousel-track" :style="{ transform: `translateX(-${activeSlide * 100}%)` }">
                <div v-for="slide in slides" :key="slide.variant" class="carousel-slide">
                  <div class="scene" :class="`scene-${slide.variant}`">
                    <span class="scene-orbit orbit-one"></span><span class="scene-orbit orbit-two"></span>
                    <div class="scene-device"><ion-icon :icon="slide.icon" /></div>
                    <div class="scene-card">
                      <span class="scene-card-icon"><ion-icon :icon="slide.icon" /></span>
                      <span class="scene-line"></span><span class="scene-line short"></span>
                      <span class="scene-status"><span></span></span>
                    </div>
                    <span class="scene-spark spark-one"></span><span class="scene-spark spark-two"></span>
                  </div>
                </div>
              </div>
            </div>
            <div class="carousel-dots" role="group" aria-label="Choose illustration">
              <button
                v-for="(_, index) in slides"
                :key="index"
                type="button"
                :class="{ active: activeSlide === index }"
                :aria-label="`Show illustration ${index + 1}`"
                :aria-pressed="activeSlide === index"
                @click="activeSlide = index"
              />
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-inner">
          <div class="panel-brand"><span class="panel-brand-mark"><ion-icon :icon="constructOutline" /></span><span>Fixify</span></div>
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
            <div class="field" v-if="mode !== 'verify'">
              <label>Email</label>
              <input v-model="f.email" type="email" required :autocomplete="mode === 'login' ? 'username' : 'email'" />
              <button
                v-if="mode === 'login' && recentEmail && f.email.trim().toLowerCase() !== recentEmail.toLowerCase()"
                class="email-suggestion"
                type="button"
                @click="f.email = recentEmail"
              >Use recently used email: {{ recentEmail }}</button>
            </div>
            <div class="field" v-if="['login', 'register'].includes(mode)">
              <label>Password</label>
              <div class="password-input">
                <input v-model="f.password" :type="showPassword ? 'text' : 'password'" required :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" />
                <button
                  class="password-toggle"
                  type="button"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  :title="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                ><ion-icon :icon="showPassword ? eyeOffOutline : eyeOutline" /></button>
              </div>
              <div v-if="mode !== 'login'" class="muted">At least 10 characters with upper case, lower case and a number. Strength {{ strength }}/4</div>
            </div>
            <ion-button v-if="mode !== 'verify'" type="submit" expand="block" :disabled="busy">{{ { login: 'Sign in', register: 'Create account', forgot: 'Send reset link' }[mode] }}</ion-button>
          </form>
          <ion-button v-if="mode === 'verify'" expand="block" :disabled="busy" @click="verify">I verified my email</ion-button>
          <div class="links">
            <template v-if="mode === 'login'"><a @click="mode = 'register'">Create an account</a><a @click="mode = 'forgot'">Forgot password?</a></template>
            <template v-else><a @click="mode = 'login'">Back to sign in</a><a v-if="mode === 'verify'" @click="resend">Send a new code</a></template>
          </div>
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
  min-height: 270px;
  flex-direction: column;
  justify-content: flex-start;
  overflow: hidden;
  padding: 22px 24px 18px;
  background: radial-gradient(ellipse at 82% 72%, rgb(109 146 255 / 48%), transparent 38%), linear-gradient(145deg, #172954, #233f86 58%, #365fe0);
  color: #fff;
}
.hero::before { position: absolute; top: 20%; right: -190px; width: 460px; height: 460px; border: 1px solid rgb(255 255 255 / 10%); border-radius: 50%; content: ''; box-shadow: 0 0 0 42px rgb(255 255 255 / 4%), 0 0 0 86px rgb(255 255 255 / 3%); }
.hero-brand, .carousel { position: relative; z-index: 1; }
.hero-brand { display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 800; letter-spacing: -.05em; animation: brand-enter .65s both; }
.hero-mark { display: grid; width: 37px; height: 37px; place-items: center; border: 1px solid rgb(255 255 255 / 25%); border-radius: 12px; background: rgb(255 255 255 / 13%); font-size: 19px; }
.carousel { width: min(100%, 390px); margin: auto; }
.carousel-window { overflow: hidden; }
.carousel-track { display: flex; transition: transform .75s cubic-bezier(.22, .75, .25, 1); }
.carousel-slide { display: grid; min-width: 100%; place-items: center; }
.scene { position: relative; display: grid; width: min(100%, 300px); height: 190px; place-items: center; isolation: isolate; animation: scene-enter .8s both; }
.scene-orbit { position: absolute; z-index: -1; width: 150px; height: 150px; border: 1px solid rgb(255 255 255 / 18%); border-radius: 50%; box-shadow: 0 0 0 23px rgb(255 255 255 / 4%), 0 0 0 46px rgb(255 255 255 / 3%); }
.orbit-two { width: 190px; height: 190px; opacity: .7; }
.scene-device { display: grid; width: 112px; height: 148px; place-items: center; border: 1px solid rgb(255 255 255 / 68%); border-radius: 25px; background: linear-gradient(150deg, #fff, #dce7ff); box-shadow: 0 24px 50px rgb(8 20 53 / 32%), inset 0 0 0 6px rgb(49 83 165 / 7%); color: #315ce7; font-size: 48px; animation: device-float 4s ease-in-out infinite; }
.scene-repair .scene-device { transform: rotate(-8deg); background: linear-gradient(145deg, #d9e8ff, #fff); color: #4a71e7; }
.scene-secure .scene-device { border-radius: 38px 38px 27px 27px; background: linear-gradient(150deg, #e1fbf2, #fff); color: #18866b; }
.scene-card { position: absolute; right: 3px; bottom: 20px; display: flex; width: 111px; height: 83px; flex-direction: column; justify-content: center; gap: 9px; padding: 12px; border: 1px solid rgb(255 255 255 / 70%); border-radius: 15px; background: rgb(255 255 255 / 90%); box-shadow: 0 17px 36px rgb(8 20 53 / 25%); animation: card-float 4.5s ease-in-out infinite; }
.scene-card-icon { display: grid; width: 21px; height: 21px; place-items: center; border-radius: 7px; background: #e9efff; color: #315ce7; font-size: 13px; }
.scene-secure .scene-card-icon { background: #e2f5ee; color: #18866b; }
.scene-line { display: block; width: 100%; height: 5px; border-radius: 5px; background: #dce4f2; }
.scene-line.short { width: 61%; margin-top: -5px; }
.scene-status { display: block; height: 4px; overflow: hidden; border-radius: 5px; background: #e8edf7; }
.scene-status span { display: block; width: 70%; height: 100%; border-radius: inherit; background: #5b7df1; }
.scene-secure .scene-status span { background: #27a785; }
.scene-spark { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: #b6ccff; box-shadow: 0 0 15px rgb(196 214 255 / 90%); animation: sparkle 2.4s ease-in-out infinite; }
.spark-one { top: 29px; right: 51px; }
.spark-two { bottom: 43px; left: 34px; width: 5px; height: 5px; animation-delay: .8s; }
.carousel-dots { display: flex; justify-content: center; gap: 8px; margin-top: 4px; }
.carousel-dots button { width: 7px; height: 7px; padding: 0; border: 0; border-radius: 999px; background: rgb(255 255 255 / 42%); cursor: pointer; transition: width .25s ease, background-color .25s ease; }
.carousel-dots button.active { width: 22px; background: #fff; }
.carousel-dots button:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
.panel { display: flex; width: 100%; align-items: flex-start; justify-content: center; padding: 30px 22px 42px; }
.panel-inner { width: min(100%, 430px); animation: panel-enter .65s .08s both; }
.panel-brand { display: none; align-items: center; gap: 9px; margin-bottom: 22px; color: var(--fx-navy); font-size: 19px; font-weight: 800; letter-spacing: -.05em; }
.panel-brand-mark { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 12px; background: #edf2ff; color: var(--fx-blue); font-size: 19px; }
.panel h2 { margin: 0 0 20px; color: var(--fx-navy); font-size: 27px; font-weight: 800; letter-spacing: -.05em; }
.password-input { position: relative; }
.password-input input { padding-right: 46px; }
.password-toggle { position: absolute; top: 50%; right: 12px; display: grid; width: 28px; height: 28px; place-items: center; padding: 0; transform: translateY(-50%); border: 0; background: transparent; color: var(--fx-muted); cursor: pointer; font-size: 18px; }
.password-toggle:focus-visible, .email-suggestion:focus-visible { outline: 2px solid var(--fx-blue); outline-offset: 2px; }
.email-suggestion { display: block; margin-top: 7px; padding: 0; border: 0; background: transparent; color: var(--fx-blue); cursor: pointer; font-size: 11px; font-weight: 700; text-align: left; }
.links { display: flex; justify-content: space-between; gap: 12px; margin-top: 17px; font-size: 12px; }
.links a { color: var(--fx-blue); cursor: pointer; font-weight: 700; }
@media (min-width: 900px) {
  .auth { min-height: 100vh; grid-template-columns: minmax(420px, 1.04fr) minmax(460px, .96fr); }
  .hero { min-height: 100vh; padding: 32px clamp(42px, 7vw, 100px) 48px; }
  .carousel { width: min(100%, 430px); }
  .scene { width: min(100%, 360px); height: 320px; }
  .scene-device { width: 152px; height: 205px; border-radius: 34px; font-size: 66px; }
  .scene-card { right: 8px; bottom: 39px; width: 142px; height: 106px; gap: 11px; padding: 15px; border-radius: 18px; }
  .scene-card-icon { width: 27px; height: 27px; border-radius: 8px; font-size: 16px; }
  .scene-line { height: 6px; }
  .scene-line.short { margin-top: -6px; }
  .scene-status { height: 5px; }
  .panel { align-items: center; padding: 50px 42px; }
  .panel-brand { display: flex; }
}
@media (max-width: 480px) {
  .hero { min-height: 235px; padding: 16px 20px 12px; }
  .scene { height: 150px; }
  .scene-device { width: 86px; height: 118px; border-radius: 21px; font-size: 38px; }
  .scene-card { right: 11px; bottom: 13px; transform: scale(.84); transform-origin: bottom right; }
  .orbit-two { width: 155px; height: 155px; }
  .panel { padding: 24px 20px 38px; }
  .panel-brand { margin-bottom: 17px; }
  .panel h2 { font-size: 24px; }
}
@keyframes brand-enter { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes panel-enter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes scene-enter { from { opacity: 0; transform: scale(.93); } to { opacity: 1; transform: scale(1); } }
@keyframes device-float { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-8px) rotate(2deg); } }
@keyframes card-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -7px; } }
@keyframes sparkle { 0%, 100% { opacity: .45; scale: .8; } 50% { opacity: 1; scale: 1.35; } }
@media (prefers-reduced-motion: reduce) {
  .carousel-track { transition: none; }
  .hero-brand, .panel-inner, .scene, .scene-device, .scene-card, .scene-spark { animation: none; }
}
</style>
