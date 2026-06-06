<!-- src/views/StubView.vue — заглушка для ещё не перенесённых разделов -->
<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <div class="stub">
    <h2>{{ route.meta.title || 'Раздел' }}</h2>
    <p>Этот раздел перенесём из старой CRM на следующих шагах.</p>
  </div>
</template>

<style scoped>
.stub { padding: 40px; text-align: center; color: var(--text-tertiary); }
.stub h2 { color: var(--text); }
</style>
