<!-- src/views/QuotesView.vue — цитаты боли (pain_quotes) -->
<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../api/client'
import { fmtDate } from '../lib/deals'
import DealCard from './DealCard.vue'

const quotes = ref([])
const loading = ref(true)
const error = ref('')
const selectedId = ref(null)

async function load() {
  loading.value = true; error.value = ''
  try { quotes.value = await db.list('pain_quotes', { size: 1000, order: 'created_at,desc' }) }
  catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)

function meta(q) {
  return [q.client_name, q.venue_type, q.current_system ? `сейчас: ${q.current_system}` : '', fmtDate(q.created_at)]
    .filter(Boolean).join(' · ')
}
function openDeal(q) { if (q.deal_id != null) selectedId.value = q.deal_id }
</script>

<template>
  <section>
    <h2 class="title">Цитаты боли</h2>

    <p v-if="loading" class="muted">Загрузка…</p>
    <p v-else-if="error" class="err">Ошибка: {{ error }}</p>
    <div v-else-if="quotes.length === 0" class="empty">Цитат пока нет. Они добавляются при касании, если заполнить «Цитату боли».</div>

    <div v-else>
      <div v-for="q in quotes" :key="q.id" class="quote" :class="{ link: q.deal_id != null }" @click="openDeal(q)">
        <div class="quote-text">«{{ q.quote }}»</div>
        <div class="quote-meta">{{ meta(q) }}</div>
      </div>
    </div>

    <DealCard v-if="selectedId" :key="selectedId" :id="selectedId" @close="selectedId = null" @saved="load" />
  </section>
</template>

<style scoped>
.title { margin: 0 0 16px; }
.quote { background: var(--bg); border: 0.5px solid var(--border); border-left: 3px solid var(--gold); border-radius: var(--radius); padding: 12px 16px; margin-bottom: 10px; }
.quote.link { cursor: pointer; }
.quote.link:hover { border-color: var(--border-strong); border-left-color: var(--gold); }
.quote-text { font-size: 15px; line-height: 1.4; }
.quote-meta { font-size: 12px; color: var(--text-tertiary); margin-top: 6px; }
.empty { color: var(--text-tertiary); padding: 1rem; }
.muted { color: var(--text-tertiary); }
.err { color: var(--danger); }
</style>
