<!-- src/views/DealsView.vue — список сделок (карточка открывается модалкой) -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '../api/client'
import { isArchived, isDeal, isOverdue, dealMatches, fmtDate, fmtDateShort, TEMP } from '../lib/deals'
import DealCard from './DealCard.vue'

const deals = ref([])
const loading = ref(true)
const error = ref('')

const search = ref('')
const filter = ref('all')
const sort = ref('created')
const selectedId = ref(null)   // открытая в модалке сделка
const creating = ref(false)    // открыта модалка создания

function closeCard() { selectedId.value = null; creating.value = false }

const FILTERS = [
  { id: 'all', label: 'Все' }, { id: 'hot', label: 'Горячие' },
  { id: 'warm', label: 'Тёплые' }, { id: 'cold', label: 'Холодные' },
  { id: 'overdue', label: 'Срочно' }, { id: 'archived', label: 'Архив' },
]

async function load() {
  loading.value = true; error.value = ''
  try { deals.value = await db.list('deals', { size: 1000, order: 'updated_at,desc' }) }
  catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)

const list = computed(() => {
  let l = filter.value === 'archived' ? deals.value.filter(isArchived) : deals.value.filter(isDeal)
  if (filter.value === 'hot') l = l.filter(d => d.temperature === 'hot')
  else if (filter.value === 'warm') l = l.filter(d => d.temperature === 'warm')
  else if (filter.value === 'cold') l = l.filter(d => d.temperature === 'cold')
  else if (filter.value === 'overdue') l = l.filter(isOverdue)
  if (search.value.trim()) l = l.filter(d => dealMatches(d, search.value.trim()))
  l = l.slice().sort((a, b) => {
    if (sort.value === 'next') {
      const ad = a.next_date ? new Date(a.next_date) : new Date(8.64e15)
      const bd = b.next_date ? new Date(b.next_date) : new Date(8.64e15)
      return ad - bd
    }
    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  })
  return l
})

function subDate(d) {
  if (sort.value === 'next') return d.created_at ? `Создана ${fmtDateShort(d.created_at)}` : ''
  return d.next_date ? `След. ${fmtDate(d.next_date)}` : 'нет следующего шага'
}
</script>

<template>
  <section>
    <div class="top-row">
      <h2>Сделки</h2>
      <button class="primary new-deal" @click="creating = true">+ Новая сделка</button>
    </div>

    <div class="search-row">
      <input v-model="search" type="search" placeholder="Поиск: название, телефон, ЛПР, система, ИНН…" />
    </div>

    <div class="filter-row">
      <button v-for="f in FILTERS" :key="f.id" class="chip" :class="{ active: filter === f.id }" @click="filter = f.id">{{ f.label }}</button>
      <div class="sort">
        <span class="sort-label">Сортировка</span>
        <button class="chip" :class="{ active: sort === 'created' }" @click="sort = 'created'">Новые сверху</button>
        <button class="chip" :class="{ active: sort === 'next' }" @click="sort = 'next'">По касанию</button>
      </div>
      <button class="chip" @click="load">↻ Обновить</button>
    </div>

    <p v-if="loading" class="muted">Загрузка…</p>
    <p v-else-if="error" class="err">Ошибка: {{ error }}</p>
    <div v-else-if="list.length === 0" class="empty">
      {{ search ? `Ничего не найдено по запросу «${search}»` : 'Нет сделок под этот фильтр' }}
    </div>

    <div v-else>
      <div v-for="d in list" :key="d.id" class="deal-row" :class="{ archived: isArchived(d) }" @click="d.id != null && (selectedId = d.id)">
        <div class="deal-main">
          <div class="deal-name">
            {{ d.client_name || 'Без названия' }}
            <span v-if="isArchived(d)" class="arch">· архив</span>
          </div>
          <div class="deal-meta">{{ d.type || '—' }} · {{ d.status || '—' }} · {{ d.next_step || 'нет шага' }}</div>
          <div class="deal-sub" :class="{ overdue: isOverdue(d) && !isArchived(d) && sort !== 'next' }">{{ subDate(d) }}</div>
        </div>
        <span v-if="TEMP[d.temperature]" class="temp" :class="TEMP[d.temperature].cls">{{ TEMP[d.temperature].label }}</span>
        <div class="next-date" :class="{ overdue: isOverdue(d) && !isArchived(d) && sort === 'next' }">
          {{ sort === 'next' ? fmtDate(d.next_date) : fmtDateShort(d.created_at) }}
        </div>
      </div>
    </div>

    <!-- модальная карточка -->
    <DealCard
      v-if="selectedId || creating"
      :key="creating ? 'new' : selectedId"
      :id="selectedId"
      :create="creating"
      @close="closeCard"
      @saved="load" />
  </section>
</template>

<style scoped>
.top-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.top-row h2 { margin: 0; }
.new-deal { background: var(--text); color: var(--bg); border-color: var(--text); font-weight: 500; }
.new-deal:hover { background: #000; }
.search-row { margin-bottom: 12px; }
.search-row input { width: 100%; padding: 9px 12px; border: 0.5px solid var(--border); border-radius: var(--radius); background: var(--bg); }
.filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
.chip { font-size: 13px; padding: 6px 12px; border-radius: 999px; background: var(--bg); border: 0.5px solid var(--border); }
.chip.active { background: var(--text); color: var(--bg); border-color: var(--text); }
.sort { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.sort-label { font-size: 12px; color: var(--text-tertiary); }
.deal-row { display: flex; align-items: center; gap: 12px; cursor: pointer; background: var(--bg); border: 0.5px solid var(--border); border-radius: var(--radius); padding: 12px 14px; margin-bottom: 8px; }
.deal-row:hover { border-color: var(--border-strong); }
.deal-row.archived { opacity: .65; }
.deal-main { flex: 1; min-width: 0; }
.deal-name { font-weight: 500; }
.arch { color: var(--text-tertiary); font-weight: 400; font-size: 12px; }
.deal-meta { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
.deal-sub { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
.deal-sub.overdue { color: var(--danger); }
.next-date { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }
.next-date.overdue { color: var(--danger); font-weight: 500; }
.empty { color: var(--text-tertiary); padding: 1rem; }
.muted { color: var(--text-tertiary); }
.err { color: var(--danger); }
</style>
