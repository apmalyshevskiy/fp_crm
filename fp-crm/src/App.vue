<!-- src/App.vue — каркас CRM: шапка + вкладки + глобальные кнопки создания -->
<script setup>
import { ref, onMounted } from 'vue'
import { userStore, initUsers } from './lib/users'
import { notifyDealsChanged } from './lib/refresh'
import DealCard from './views/DealCard.vue'

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

// глобальное создание лида/сделки
const creating = ref(false)
const createStatus = ref('Первичный контакт')
function newLead() { createStatus.value = 'Лид'; creating.value = true }
function newDeal() { createStatus.value = 'Первичный контакт'; creating.value = true }
function onSaved() { notifyDealsChanged() }
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">FUSIONPOS · CRM</div>
      <div v-if="userStore.currentUser" class="whoami">Вы: <b>{{ userStore.currentUser.full_name || userStore.currentUser.login }}</b></div>
    </header>

    <nav class="tabs">
      <router-link v-for="t in tabs" :key="t.to" :to="t.to" class="tab">{{ t.label }}</router-link>
      <span class="tabs-spacer"></span>
      <button class="new-btn lead" @click="newLead">+ Новый лид</button>
      <button class="new-btn deal" @click="newDeal">+ Новая сделка</button>
    </nav>

    <main class="content">
      <router-view />
    </main>

    <DealCard
      v-if="creating"
      key="global-new"
      :create="true"
      :create-status="createStatus"
      @close="creating = false"
      @saved="onSaved" />
  </div>
</template>

<style scoped>
.shell { max-width: none; width: 100%; margin: 0; padding: 0 24px 40px; }
.topbar { padding: 16px 0 12px; display: flex; align-items: center; justify-content: space-between; }
.whoami { font-size: 13px; color: var(--text-secondary); }
.whoami b { color: var(--text); font-weight: 600; }
.brand { font-weight: 600; letter-spacing: .2px; }
.tabs {
  display: flex; align-items: center; gap: 4px; border-bottom: 0.5px solid var(--border);
  margin-bottom: 1.25rem; background: var(--bg); border-radius: var(--radius) var(--radius) 0 0;
}
.tab {
  padding: 10px 14px; font-size: 14px; text-decoration: none;
  color: var(--text-secondary); border-bottom: 2px solid transparent;
}
.tab:hover { color: var(--text); }
.tab.router-link-active { color: var(--text); border-bottom-color: var(--text); font-weight: 500; }
.tabs-spacer { flex: 1; }
.new-btn { font-size: 13px; padding: 7px 14px; border-radius: var(--radius); border: 0.5px solid var(--border); cursor: pointer; margin: 4px 0; }
.new-btn.lead { background: var(--bg); color: var(--text); }
.new-btn.lead:hover { border-color: var(--border-strong); }
.new-btn.deal { background: var(--text); color: var(--bg); border-color: var(--text); font-weight: 500; margin-left: 6px; }
.new-btn.deal:hover { background: #000; }
.content { background: transparent; }
@media (max-width: 720px) {
  .tabs { flex-wrap: wrap; }
  .tabs-spacer { flex-basis: 100%; height: 0; }
}
</style>
