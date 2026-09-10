<script setup lang="ts">
/**
 * 極簡的畫面切換（用網址 hash，不必額外安裝 vue-router）
 *   預設        → 客戶叫瓦斯表單（LIFF）
 *   #/driver    → 師傅送貨路線規劃
 *   #/dashboard → 後台儀表板
 */
import { ref, onMounted, onUnmounted } from 'vue'
import OrderForm from './components/OrderForm.vue'
import DriverRoute from './components/DriverRoute.vue'
import Dashboard from './components/Dashboard.vue'

const routes: Record<string, any> = {
  '#/driver': DriverRoute,
  '#/dashboard': Dashboard
}

const currentView = ref<any>(routes[window.location.hash] || OrderForm)

const syncView = () => {
  currentView.value = routes[window.location.hash] || OrderForm
}

onMounted(() => window.addEventListener('hashchange', syncView))
onUnmounted(() => window.removeEventListener('hashchange', syncView))
</script>

<template>
  <component :is="currentView" />
</template>
