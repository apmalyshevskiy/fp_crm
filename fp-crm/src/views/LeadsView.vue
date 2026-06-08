<!-- src/views/LeadsView.vue — лиды (status='Лид') -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '../api/client'
import { isArchived, isLead, daysSinceTouch, isFreshLead } from '../lib/deals'
import DealCard from './DealCard.vue'

const deals = ref([])
const loading = ref(true)
const error = ref('')
const selectedId = ref(null)
const creating = ref(false)
const filter = ref('all')   // all | fresh | stale
const sort = ref('newest')  // newest | oldest

function closeCard() { selectedId.value = null; creating.value = false }

async function load() {
  loading.value = true; error.value = ''
  try { deals.value = await db.list('deals', { size: 1000, order: 'created_at,desc' }) }
  catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)

const list = computed(() => {
  let l = deals.value.filter(d => !isArchived(d) && isLead(d))
  if (filter.value === 'fresh') l = l.filter(isFreshLead)
  else if (filter.value === 'stale') l = l.filter(d => (daysSinceTouch(d) || 0) > 3)
  l = l.slice().sort((a, b) => {
    const av = new Date(a.created_at || 0), bv = new Date(b.created_at || 0)
    return sort.value === 'oldest' ? av - bv : bv - av
  })
  return l
})

function badge(d) {
  const days = daysSinceTouch(d)
  if (days === 0) return { text: 'сегодня', cls: 'ok' }
  if (days === 1) return { text: 'вчера', cls: 'muted' }
  if (days > 3) return { text: `${days} дн.`, cls: 'danger' }
  return { text: `${days} дн. назад`, cls: 'muted' }
}
function contactLine(d) { return [d.type, d.phone, d.email].filter(Boolean).join(' · ') }
</script>

<template>
  <section>
    <div class="top-row">
      <h2>Лиды</h2>
      <button class="primary new-deal" @click="creating = true">+ Новый лид</button>
    </div>

    <div class="filter-row">
      <button class="chip" :class="{ active: filter==='all' }" @click="filter='all'">Все</button>
      <button class="chip" :class="{ active: filter==='fresh' }" @click="filter='fresh'">Свежие (без касаний)</button>
      <button class="chip" :class="{ active: filter==='stale' }" @click="filter='stale'">Залежавшиеся &gt;3 дн.</button>
      <div class="sort">
        <span class="sort-label">Сортировка</span>
        <button class="chip" :class="{ active: sort==='newest' }" @click="sort='newest'">Новые</button>
        <button class="chip" :class="{ active: sort==='oldest' }" @click="sort='oldest'">Старые</button>
      </div>
    </div>

    <p v-if="loading" class="muted">Загрузка…</p>
    <p v-else-if="error" class="err">Ошибка: {{ error }}</p>
    <div v-else-if="list.length === 0" class="empty">Лидов под этот фильтр нет.</div>

    <div v-else>
      <div v-for="d in list" :key="d.id" class="deal-row" @click="d.id != null && (selectedId = d.id)">
        <div class="deal-main">
          <div class="deal-name">{{ d.client_name || '— без названия —' }}</div>
          <div class="deal-meta">
            <span v-if="d.source" class="src">{{ d.source }}</span>{{ contactLine(d) }}
          </div>
          <div v-if="d.contact_name" class="deal-sub">{{ [d.contact_name, d.contact_role].filter(Boolean).join(' · ') }}</div>
        </div>
        <span class="lead-badge" :class="badge(d).cls">{{ badge(d).text }}</span>
      </div>
    </div>

    <DealCard
      v-if="selectedId || creating"
      :key="creating ? 'new' : selectedId"
      :id="selectedId" :create="creating" create-status="Лид"
      @close="closeCard" @saved="load" />
  </section>
</template>

<style scoped>
.top-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.top-row h2 { margin: 0; }
.new-deal { background: var(--text); color: var(--bg); border-color: var(--text); font-weight: 500; }
.filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
.chip { font-size: 13px; padding: 6px 12px; border-radius: 999px; background: var(--bg); border: 0.5px solid var(--border); }
.chip.active { background: var(--text); color: var(--bg); border-color: var(--text); }
.sort { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.sort-label { font-size: 12px; color: var(--text-tertiary); }
.deal-row { display: flex; align-items: center; gap: 12px; cursor: pointer; background: var(--bg); border: 0.5px solid var(--border); border-radius: var(--radius); padding: 12px 14px; margin-bottom: 8px; }
.deal-row:hover { border-color: var(--border-strong); }
.deal-main { flex: 1; min-width: 0; }
.deal-name { font-weight: 500; }
.deal-meta { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
.src { background: var(--bg-secondary); padding: 2px 8px; border-radius: var(--radius); font-size: 11px; margin-right: 6px; }
.deal-sub { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
.lead-badge { font-size: 11px; white-space: nowrap; }
.lead-badge.ok { color: #1D9E75; }
.lead-badge.danger { color: var(--danger); }
.lead-badge.muted { color: var(--text-secondary); }
.empty { color: var(--text-tertiary); padding: 1rem; }
.muted { color: var(--text-tertiary); }
.err { color: var(--danger); }
</style>
