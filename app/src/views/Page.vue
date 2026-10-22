<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { session } from '../api';
import { menus } from '../nav';
defineProps({ title: String });
const route = useRoute();
const tabs = computed(() => (menus[session.user?.role] || []).slice(0, 5));
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button class="ion-hide-lg-up" /></ion-buttons>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end"><slot name="actions" /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content><div class="wrap"><slot /></div></ion-content>
    <ion-footer class="ion-hide-lg-up">
      <ion-toolbar style="--background:#fff;--color:#5B6B8C">
        <div class="tabs">
          <ion-button v-for="m in tabs" :key="m.to" fill="clear" :router-link="m.to" :class="{ on: route.path === m.to }" size="small">
            <div style="display:flex;flex-direction:column;align-items:center"><ion-icon :icon="m.i" /><span>{{ m.t.split(' ')[0] }}</span></div>
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>
