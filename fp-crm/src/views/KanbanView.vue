<!-- src/views/KanbanView.vue — канбан: колонки-статусы, drag-drop = смена этапа -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '../api/client'
import { isDeal, isOverdue, fmtDate, TEMP, FUNNEL_STATUSES, SIDE_STATUSES } from '../lib/deals'
import DealCard from './DealCard.vue'

const deals = ref([])
const loading = ref(true)
const error = ref('')
const selectedId = ref(null)
const draggedId = ref(null)
const dragOver = ref(null)   // статус-колонка под курсором

const COLUMNS = [...FUNNEL_STATUSES, ...SIDE_STATUSES]

function nowMysql() { return new Date().toISOString().slice(0, 19).replace('T', ' ') }

async function load() {
  loading.value = true; error.value = ''
  try { deals.value = await db.list('deals', { size: 1000, order: 'updated_at,desc' }) }
  catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)

const active = computed(() => deals.value.filter(isDeal))

function sortCol(list) {
  return list.slice().sort((a, b) => {
    const ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1
    if (ao !== bo) return ao - bo
    const ad = a.next_date ? new Date(a.next_date) : new Date(8.64e15)
    const bd = b.next_date ? new Date(b.next_date) : new Date(8.64e15)
    return ad - bd
  })
}
function colDeals(status) {
  return sortCol(active.value.filter(d => (d.status || 'Первичный контакт') === status))
}

// drag-and-drop
function onDragStart(id, e) {
  draggedId.value = id
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(id)) } catch (_) {} }
}
function onDragEnd() { draggedId.value = null; dragOver.value = null }
async function onDrop(status) {
  const id = draggedId.value
  dragOver.value = null; draggedId.value = null
  if (!id) return
  await moveDealStatus(id, status)
}

// перенос = PUT (как putDeal) + служебная запись в историю (как в старом фронте)
async function moveDealStatus(dealId, newStatus) {
  try {
    const existing = await db.get('deals', dealId)
    if ((existing.status || 'Первичный контакт') === newStatus) return
    const stamp = nowMysql()
    const merged = { ...existing, status: newStatus, updated_at: stamp }
    delete merged.id
    await db.replace('deals', dealId, merged)
    await db.create('activity', {
      deal_id: Number(dealId), created_at: stamp, seller_id: existing.seller_id || null,
      type: 'note', summary: `Перенос на этап «${newStatus}»`,
      status_after: newStatus, temperature_after: existing.temperature || '',
      next_step: existing.next_step || '', next_date: existing.next_date || null,
    })
    await load()
  } catch (e) { error.value = e.message }
}
</script>

<template>
  <section>
    <p v-if="loading" class="muted">Загрузка…</p>
    <p v-else-if="error" class="err">Ошибка: {{ error }}</p>

    <div v-else class="kanban-wrap">
      <div
        v-for="status in COLUMNS"
        :key="status"
        class="kanban-col"
        :class="{ 'drag-over': dragOver === status, side: SIDE_STATUSES.includes(status) }"
        @dragover.prevent="dragOver = status"
        @dragleave="dragOver === status && (dragOver = null)"
        @drop.prevent="onDrop(status)">
        <div class="col-head">
          <span class="col-title">{{ status }}</span>
          <span class="col-count">{{ colDeals(status).length }}</span>
        </div>
        <div class="col-cards">
          <div v-if="colDeals(status).length === 0" class="empty">пусто</div>
          <div
            v-for="d in colDeals(status)"
            :key="d.id"
            class="kcard"
            :class="{ dragging: draggedId === d.id }"
            draggable="true"
            @dragstart="onDragStart(d.id, $event)"
            @dragend="onDragEnd"
            @click="selectedId = d.id">
            <div class="kcard-head">
              <span class="kcard-name">{{ d.client_name || 'Без названия' }}</span>
              <span v-if="TEMP[d.temperature]" class="temp" :class="TEMP[d.temperature].cls">{{ TEMP[d.temperature].label }}</span>
            </div>
            <div v-if="d.type" class="kcard-type">{{ d.type }}</div>
            <div class="kcard-foot">
              <span class="kcard-step" :title="d.next_step || ''">{{ d.next_step || 'нет шага' }}</span>
              <span class="kcard-date" :class="{ overdue: isOverdue(d) }">{{ d.next_date ? fmtDate(d.next_date) : '' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <DealCard v-if="selectedId" :key="selectedId" :id="selectedId" @close="selectedId = null" @saved="load" />
  </section>
</template>

<style scoped>
.kanban-wrap { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 12px; align-items: flex-start; }
.kanban-col {
  flex: 0 0 var(--col-w, 260px);
  width: var(--col-w, 260px); min-width: var(--col-w, 260px); max-width: var(--col-w, 260px);
  box-sizing: border-box;
  background: var(--bg-secondary); border: 0.5px solid var(--border);
  border-radius: var(--radius); padding: 10px; display: flex; flex-direction: column; min-height: 120px;
}
.kanban-col.side { background: var(--bg-tertiary); }
.kanban-col.drag-over { background: var(--bg-tertiary); outline: 2px dashed var(--border-strong); }
.col-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.col-title { font-size: 13px; font-weight: 600; }
.col-count { font-size: 12px; color: var(--text-tertiary); background: var(--bg); border-radius: 999px; padding: 0 7px; }
.col-cards { display: flex; flex-direction: column; gap: 6px; }
.empty { color: var(--text-tertiary); font-size: 12px; padding: 8px 4px; }

.kcard {
  background: var(--bg); border: 0.5px solid var(--border); border-radius: var(--radius);
  padding: 8px 10px; cursor: grab; overflow: hidden;
}
.kcard:hover { border-color: var(--border-strong); }
.kcard.dragging { opacity: .35; cursor: grabbing; }
.kcard-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
.kcard-name { font-weight: 500; font-size: 13px; min-width: 0; overflow-wrap: anywhere; }
.kcard-type { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.kcard-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 6px; }
.kcard-step { font-size: 12px; color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.kcard-date { font-size: 12px; color: var(--text-secondary); white-space: nowrap; flex-shrink: 0; }
.kcard-date.overdue { color: var(--danger); font-weight: 500; }
.muted { color: var(--text-tertiary); }
.err { color: var(--danger); }
</style>
