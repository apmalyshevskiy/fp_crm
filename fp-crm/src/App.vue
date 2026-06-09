<!-- src/App.vue — каркас CRM: шапка + вкладки -->
<script setup>
import { onMounted } from 'vue'
import { userStore, initUsers } from './lib/users'
onMounted(initUsers)
const tabs = [
  { to: '/dashboard',  label: 'Дашборд' },
  { to: '/leads',      label: 'Лиды' },
  { to: '/kanban',     label: 'Канбан' },
  { to: '/calendar',   label: 'Календарь' },
  { to: '/deals',      label: 'Сделки' },
  { to: '/quotes',     label: 'Цитаты боли' },
  { to: '/rejections', label: 'Отказы' },
]
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">FUSIONPOS · CRM</div>
      <div v-if="userStore.currentUser" class="whoami">Вы: <b>{{ userStore.currentUser.full_name || userStore.currentUser.login }}</b></div>
    </header>
    <nav class="tabs">
      <router-link v-for="t in tabs" :key="t.to" :to="t.to" class="tab">{{ t.label }}</router-link>
    </nav>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.shell { max-width: none; width: 100%; margin: 0; padding: 0 24px 40px; }
.topbar { padding: 16px 0 12px; display: flex; align-items: center; justify-content: space-between; }
.whoami { font-size: 13px; color: var(--text-secondary); }
.whoami b { color: var(--text); font-weight: 600; }
.brand { font-weight: 600; letter-spacing: .2px; }
.tabs {
  display: flex; gap: 4px; border-bottom: 0.5px solid var(--border);
  margin-bottom: 1.25rem; background: var(--bg); border-radius: var(--radius) var(--radius) 0 0;
}
.tab {
  padding: 10px 14px; font-size: 14px; text-decoration: none;
  color: var(--text-secondary); border-bottom: 2px solid transparent;
}
.tab:hover { color: var(--text); }
.tab.router-link-active { color: var(--text); border-bottom-color: var(--text); font-weight: 500; }
.content { background: transparent; }
</style>
