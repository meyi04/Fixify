import { createApp } from 'vue';
import * as ionic from '@ionic/vue';
import App from './App.vue';
import router from './router';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/display.css';
import './theme/variables.css';

const app = createApp(App).use(ionic.IonicVue, { mode: 'md' }).use(router);
Object.entries(ionic).forEach(([k, v]) => { if (/^Ion[A-Z]/.test(k) && k !== 'IonicVue' && v && typeof v !== 'string') app.component(k, v); });
router.isReady().then(() => app.mount('#app'));
