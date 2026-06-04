<!-- src/App.vue — каркас приложения: шапка с навигацией + место под страницы -->
<script setup>
// <script setup> — это и есть Composition API "по умолчанию".
// Здесь пока ничего не нужно: навигацию рисует <router-link>,
// а саму страницу подставляет <router-view>.
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">FUSIONPOS · Договоры</div>
      <nav class="nav">
        <router-link to="/partners">Партнёры</router-link>
        <router-link to="/contracts">Договоры</router-link>
      </nav>
    </header>

    <main class="content">
      <!-- сюда роутер подставляет нужный экран -->
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app { max-width: 1080px; margin: 0 auto; padding: 0 16px; }

.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 0; border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}
.brand { font-weight: 600; letter-spacing: .2px; }

.nav { display: flex; gap: 8px; }
.nav a {
  padding: 8px 14px; border-radius: 8px; text-decoration: none;
  color: var(--text-secondary); font-size: 14px;
}
.nav a:hover { background: var(--bg-secondary); color: var(--text-primary); }
/* активную ссылку роутер сам помечает классом router-link-active */
.nav a.router-link-active { background: var(--gold); color: #1a1a1a; }
</style>
