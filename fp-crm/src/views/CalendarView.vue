<!-- src/views/CalendarView.vue — недельный календарь по дням -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '../api/client'
import { isArchived, isOverdue, TEMP } from '../lib/deals'
import DealCard from './DealCard.vue'

const deals = ref([])
const loading = ref(true)
const error = ref('')
const selectedId = ref(null)
const draggedId = ref(null)
const dragOver = ref(null)

const WD = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const MON = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек']
const pad = n => String(n).padStart(2, '0')
function nowMysql() { return new Date().toISOString().slice(0, 19).replace('T', ' ') }
function mondayOf(d) { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); x.setHours(0,0,0,0); return x }
function keyOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

const weekStart = ref(mondayOf(new Date()))

async function load() {
  loading.value = true; error.value = ''
  try { deals.value = await db.list('deals', { size: 1000, order: 'updated_at,desc' }) }
  catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)

const days = computed(() => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(weekStart.value); d.setDate(d.getDate() + i); return d
}))
const todayKey = keyOf(new Date())

// сделки с датой следующего шага (не архив)
const scheduled = computed(() => deals.value.filter(d => !isArchived(d) && d.next_date))
function dealsOn(day) {
  const k = keyOf(day)
  return scheduled.value
    .filter(d => String(d.next_date).slice(0, 10) === k)
    .sort((a, b) => String(a.next_date).slice(11) .localeCompare(String(b.next_date).slice(11)))
}
function timeOf(d) { const t = String(d.next_date).slice(11, 16); return /\d\d:\d\d/.test(t) ? t : '' }

const weekLabel = computed(() => {
  const a = days.value[0], b = days.value[6]
  const m = a.getMonth() === b.getMonth() ? ` ${MON[b.getMonth()]}` : ''
  return `${a.getDate()}${a.getMonth() !== b.getMonth() ? ' ' + MON[a.getMonth()] : ''} – ${b.getDate()} ${MON[b.getMonth()]}`
})
function shiftWeek(n) { const d = new Date(weekStart.value); d.setDate(d.getDate() + n * 7); weekStart.value = d }
function thisWeek() { weekStart.value = mondayOf(new Date()) }

// drag-and-drop: перенос даты следующего шага на другой день (время сохраняем)
function onDragStart(id, e) { draggedId.value = id; if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(id)) } catch (_) {} } }
function onDragEnd() { draggedId.value = null; dragOver.value = null }
async function onDrop(day) {
  const id = draggedId.value; const k = keyOf(day)
  dragOver.value = null; draggedId.value = null
  if (!id) return
  try {
    const existing = await db.get('deals', id)
    const time = String(existing.next_date || '').slice(11, 19) || '10:00:00'
    if (String(existing.next_date || '').slice(0, 10) === k) return
    const merged = { ...existing, next_date: `${k} ${time}`, updated_at: nowMysql() }
    delete merged.id
    await db.replace('deals', id, merged)
    await load()
  } catch (e) { error.value = e.message }
}
</script>

<template>
  <section>
    <div class="cal-toolbar">
      <button class="cal-btn" @click="shiftWeek(-1)">‹</button>
      <button class="cal-btn" @click="thisWeek">Сегодня</button>
      <button class="cal-btn" @click="shiftWeek(1)">›</button>
      <span class="cal-label">{{ weekLabel }}</span>
    </div>

    <p v-if="loading" class="muted">Загрузка…</p>
    <p v-else-if="error" class="err">Ошибка: {{ error }}</p>

    <div v-else class="cal-week">
      <div
        v-for="(day, i) in days"
        :key="i"
        class="cal-day"
        :class="{ 'drag-over': dragOver === keyOf(day), today: keyOf(day) === todayKey }"
        @dragover.prevent="dragOver = keyOf(day)"
        @dragleave="dragOver === keyOf(day) && (dragOver = null)"
        @drop.prevent="onDrop(day)">
        <div class="cal-dayhead">
          <span class="wd">{{ WD[i] }}</span>
          <span class="num">{{ day.getDate() }}</span>
        </div>
        <div class="cal-events">
          <div v-if="dealsOn(day).length === 0" class="cal-empty">—</div>
          <div
            v-for="d in dealsOn(day)"
            :key="d.id"
            class="cal-ev"
            :class="[d.temperature ? 'temp-' + d.temperature : '', { dragging: draggedId === d.id, overdue: isOverdue(d) }]"
            draggable="true"
            @dragstart="onDragStart(d.id, $event)"
            @dragend="onDragEnd"
            @click="selectedId = d.id">
            <span v-if="timeOf(d)" class="ev-time">{{ timeOf(d) }}</span>
            <span class="ev-name">{{ d.client_name || 'Без названия' }}</span>
            <div v-if="d.next_step" class="ev-step">{{ d.next_step }}</div>
          </div>
        </div>
      </div>
    </div>

    <DealCard v-if="selectedId" :key="selectedId" :id="selectedId" @close="selectedId = null" @saved="load" />
  </section>
</template>

<style scoped>
.cal-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.cal-btn { font-size: 14px; padding: 6px 12px; }
.cal-label { font-size: 15px; font-weight: 500; margin-left: 6px; }

.cal-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; align-items: start; }
@media (max-width: 720px) { .cal-week { grid-template-columns: repeat(3, 1fr); } }
.cal-day {
  background: var(--bg-secondary); border: 0.5px solid var(--border); border-radius: var(--radius);
  padding: 8px; min-height: 140px; display: flex; flex-direction: column;
}
.cal-day.today { border-color: var(--text); }
.cal-day.drag-over { background: var(--bg-tertiary); outline: 2px dashed var(--border-strong); }
.cal-dayhead { display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px; }
.cal-dayhead .wd { font-size: 12px; color: var(--text-tertiary); }
.cal-dayhead .num { font-size: 15px; font-weight: 500; }
.cal-day.today .num { background: var(--text); color: var(--bg); border-radius: 50%; padding: 1px 7px; }
.cal-events { display: flex; flex-direction: column; gap: 5px; }
.cal-empty { color: var(--text-tertiary); font-size: 12px; }

.cal-ev {
  background: var(--bg); border: 0.5px solid var(--border); border-left: 3px solid var(--border-strong);
  border-radius: 5px; padding: 5px 7px; font-size: 12px; cursor: grab; overflow: hidden;
}
.cal-ev:hover { border-color: var(--border-strong); }
.cal-ev.dragging { opacity: .35; cursor: grabbing; }
.cal-ev.temp-hot  { background: var(--hot-bg);  color: var(--hot-text);  border-left-color: var(--hot-text); }
.cal-ev.temp-warm { background: var(--warm-bg); color: var(--warm-text); border-left-color: var(--warm-text); }
.cal-ev.temp-cold { background: var(--cold-bg); color: var(--cold-text); border-left-color: var(--cold-text); }
.cal-ev.overdue { border-left-color: var(--danger); }
.ev-time { font-weight: 600; margin-right: 4px; }
.ev-name { overflow-wrap: anywhere; }
.ev-step { font-size: 11px; opacity: .75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.muted { color: var(--text-tertiary); }
.err { color: var(--danger); }
</style>
