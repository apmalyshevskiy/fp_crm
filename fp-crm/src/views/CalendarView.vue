<!-- src/views/CalendarView.vue — почасовой календарь (день/неделя/месяц), порт из fp_crm.html -->
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { db } from '../api/client'
import { isArchived, isLead } from '../lib/deals'
import DealCard from './DealCard.vue'
import { refreshStore } from '../lib/refresh'

const SLOT_PX = 34          // высота получасового слота
const DAY_START = 8, DAY_END = 20
const EVENT_MIN = 30        // длительность контакта, мин

const deals = ref([])
const loading = ref(true)
const error = ref('')
const selectedId = ref(null)

const view = ref('week')    // day | week | month
const anchor = ref(startOfDay(new Date()))

const drag = ref(null)      // { id, kind:'event'|'month', grabOffset }
const indicator = ref(null) // { dayKey, top }
const monthHover = ref(null)
let justDragged = false

// ---- даты ----
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function sameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate() }
function startOfWeek(d) { const x = startOfDay(d); const wd = (x.getDay()+6)%7; return addDays(x, -wd) }
function startOfMonth(d) { const x = startOfDay(d); x.setDate(1); return x }
function weekDays(d) { const s = startOfWeek(d); return Array.from({length:7}, (_,i)=>addDays(s,i)) }
const pad = n => String(n).padStart(2,'0')
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function fmtMysql(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00` }
function timeStr(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
function parseDT(s) {
  if (!s) return null
  const str = String(s).trim()
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (m) return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6]||0))
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return new Date(+m[1], +m[2]-1, +m[3])
  const d = new Date(str); return isNaN(d) ? null : d
}

async function load() {
  loading.value = true; error.value = ''
  try { deals.value = await db.list('deals', { size: 1000, order: 'updated_at,desc' }) }
  catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)
watch(() => refreshStore.deals, load)

// ---- события ----
const events = computed(() => deals.value
  .filter(d => !isArchived(d) && d.next_date && d.status !== 'Оплачено' && d.status !== 'Отказ')
  .map(d => { const start = parseDT(d.next_date); return start ? { deal: d, start } : null })
  .filter(Boolean))

function eventsForDay(day) { return events.value.filter(e => sameDay(e.start, day)).sort((a,b)=>a.start-b.start) }
function isAllDay(e) { return e.start.getHours()===0 && e.start.getMinutes()===0 }

const days = computed(() => view.value==='week' ? weekDays(anchor.value) : [startOfDay(anchor.value)])

// диапазон часов сетки (8–20, расширяется под крайние события)
const range = computed(() => {
  let startH = DAY_START, endH = DAY_END
  for (const day of days.value) for (const e of eventsForDay(day)) {
    if (isAllDay(e)) continue
    const h = e.start.getHours(); if (h < startH) startH = h; if (h+1 > endH) endH = h+1
  }
  startH = Math.max(0, startH); endH = Math.min(24, Math.max(endH, startH+1))
  return { startH, endH }
})
const gridHeight = computed(() => (range.value.endH - range.value.startH) * 2 * SLOT_PX)
const gutter = computed(() => {
  const out = []
  for (let h = range.value.startH; h <= range.value.endH; h++) out.push({ h, top: (h-range.value.startH)*2*SLOT_PX })
  return out
})
const lines = computed(() => {
  const out = []
  for (let h = range.value.startH; h <= range.value.endH; h++) {
    const top = (h-range.value.startH)*2*SLOT_PX
    out.push({ top, half: false })
    if (h < range.value.endH) out.push({ top: top+SLOT_PX, half: true })
  }
  return out
})

function packLanes(list) {
  const dur = EVENT_MIN*60000, laneEnds = []
  list.forEach(e => {
    e.end = new Date(e.start.getTime()+dur); let placed = false
    for (let i=0;i<laneEnds.length;i++){ if (laneEnds[i] <= e.start){ e.lane=i; laneEnds[i]=e.end; placed=true; break } }
    if (!placed){ e.lane=laneEnds.length; laneEnds.push(e.end) }
  })
  list.forEach(e => { const g = list.filter(o => o.start < e.end && e.start < o.end); e.cols = Math.max(...g.map(o=>o.lane))+1 })
}

const columns = computed(() => days.value.map(day => {
  const r = range.value
  const timed = eventsForDay(day).filter(e => !isAllDay(e)).map(e => ({ deal: e.deal, start: e.start }))
  packLanes(timed)
  const evs = timed.map(e => {
    const mins = (e.start.getHours()-r.startH)*60 + e.start.getMinutes()
    const width = 100/e.cols
    return {
      deal: e.deal, time: timeStr(e.start), isLead: isLead(e.deal),
      top: mins/30*SLOT_PX, height: (EVENT_MIN/30)*SLOT_PX - 2,
      left: e.lane*width, width,
    }
  })
  const now = new Date()
  let nowTop = null
  if (sameDay(day, now) && now.getHours() >= r.startH && now.getHours() < r.endH) {
    nowTop = ((now.getHours()-r.startH)*60 + now.getMinutes())/30*SLOT_PX
  }
  const allday = eventsForDay(day).filter(isAllDay).map(e => e.deal)
  return {
    day, dayKey: ymd(day), isToday: sameDay(day, now),
    wd: day.toLocaleDateString('ru-RU', { weekday: 'short' }), num: day.getDate(),
    events: evs, nowTop, allday,
  }
}))
const hasAllday = computed(() => columns.value.some(c => c.allday.length > 0))
const isEmpty = computed(() => columns.value.every(c => c.events.length===0 && c.allday.length===0))

// ---- месяц ----
const monthCells = computed(() => {
  const first = startOfMonth(anchor.value), gridStart = startOfWeek(first), now = new Date()
  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(gridStart, i)
    const evs = eventsForDay(day)
    return {
      day, dayKey: ymd(day), inMonth: day.getMonth()===first.getMonth(), isToday: sameDay(day, now),
      num: day.getDate(),
      chips: evs.slice(0,3).map(e => ({ deal: e.deal, time: isAllDay(e) ? '' : timeStr(e.start)+' ' })),
      more: Math.max(0, evs.length-3),
    }
  })
})
const WD = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

// ---- подпись и навигация ----
const label = computed(() => {
  if (view.value==='day') return anchor.value.toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
  if (view.value==='week') {
    const s = startOfWeek(anchor.value), e = addDays(s,6)
    const sStr = s.getMonth()===e.getMonth() ? s.getDate() : s.toLocaleDateString('ru-RU', { day:'numeric', month:'short' })
    return `${sStr} – ${e.toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}`
  }
  return anchor.value.toLocaleDateString('ru-RU', { month:'long', year:'numeric' })
})
function setView(v) { view.value = v }
function today() { anchor.value = startOfDay(new Date()) }
function nav(dir) {
  if (view.value==='day') anchor.value = addDays(anchor.value, dir)
  else if (view.value==='week') anchor.value = addDays(anchor.value, 7*dir)
  else { const x = new Date(anchor.value); x.setMonth(x.getMonth()+dir); anchor.value = startOfDay(x) }
}

// ---- drag-drop ----
function onEventDragStart(deal, e) {
  const rect = e.currentTarget.getBoundingClientRect()
  drag.value = { id: deal.id, kind: 'event', grabOffset: e.clientY - rect.top }
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(deal.id)) } catch (_) {} }
}
function onAlldayDragStart(deal, e) {
  drag.value = { id: deal.id, kind: 'event', grabOffset: 0 }
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(deal.id)) } catch (_) {} }
}
function onMonthDragStart(deal, e) {
  drag.value = { id: deal.id, kind: 'month', grabOffset: 0 }
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(deal.id)) } catch (_) {} }
}
function computeMinutes(colEl, clientY) {
  const rect = colEl.getBoundingClientRect()
  const topPx = clientY - rect.top - (drag.value ? drag.value.grabOffset : 0)
  let slot = Math.round(topPx / SLOT_PX)
  const rows = (range.value.endH - range.value.startH) * 2
  slot = Math.max(0, Math.min(rows-1, slot))
  return range.value.startH*60 + slot*30
}
function onColDragOver(col, e) {
  if (!drag.value || drag.value.kind !== 'event') return
  e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  const mins = computeMinutes(e.currentTarget, e.clientY)
  indicator.value = { dayKey: col.dayKey, top: (mins - range.value.startH*60)/30*SLOT_PX }
}
function onColDrop(col, e) {
  if (!drag.value || drag.value.kind !== 'event') return
  e.preventDefault()
  const mins = computeMinutes(e.currentTarget, e.clientY)
  const [y,m,dd] = col.dayKey.split('-').map(Number)
  moveDeal(drag.value.id, new Date(y, m-1, dd, Math.floor(mins/60), mins%60, 0))
  indicator.value = null
}
function onMonthOver(cell, e) { if (!drag.value) return; e.preventDefault(); monthHover.value = cell.dayKey }
function onMonthDrop(cell) {
  if (!drag.value) return
  const d = deals.value.find(x => Number(x.id)===Number(drag.value.id))
  const old = d ? parseDT(d.next_date) : null
  const [y,m,dd] = cell.dayKey.split('-').map(Number)
  moveDeal(drag.value.id, new Date(y, m-1, dd, old?old.getHours():0, old?old.getMinutes():0, 0))
  monthHover.value = null
}
function onDragEnd() { drag.value = null; indicator.value = null; monthHover.value = null; justDragged = true; setTimeout(() => { justDragged = false }, 60) }
function openDeal(deal) { if (!justDragged) selectedId.value = deal.id }

// перенос next_date: оптимистично + PUT (как в старом фронте)
async function moveDeal(id, newStart) {
  const d = deals.value.find(x => Number(x.id)===Number(id)); if (!d) return
  const newStr = fmtMysql(newStart)
  const cur = parseDT(d.next_date)
  if (cur && fmtMysql(cur)===newStr) return
  const prev = d.next_date
  d.next_date = newStr
  try {
    const existing = await db.get('deals', id)
    const merged = { ...existing, next_date: newStr, updated_at: fmtMysql(new Date()) }
    delete merged.id
    await db.replace('deals', id, merged)
  } catch (e) { d.next_date = prev; error.value = e.message }
}
</script>

<template>
  <section>
    <div class="cal-toolbar">
      <button class="cal-btn" @click="today">Сегодня</button>
      <button class="cal-btn cal-arrow" @click="nav(-1)">‹</button>
      <button class="cal-btn cal-arrow" @click="nav(1)">›</button>
      <span class="cal-label">{{ label }}</span>
      <span class="cal-spacer"></span>
      <div class="cal-views">
        <button class="cal-btn" :class="{ active: view==='day' }" @click="setView('day')">День</button>
        <button class="cal-btn" :class="{ active: view==='week' }" @click="setView('week')">Неделя</button>
        <button class="cal-btn" :class="{ active: view==='month' }" @click="setView('month')">Месяц</button>
      </div>
    </div>
    <div class="cal-legend">Запланированные следующие контакты (по дате и времени из «Следующий шаг»). Один блок ≈ 30 минут. Клик по событию → карточка сделки. Перетащите событие, чтобы перенести его на другое время или день.</div>

    <p v-if="loading" class="muted">Загрузка…</p>
    <p v-else-if="error" class="err">Ошибка: {{ error }}</p>

    <!-- ===== МЕСЯЦ ===== -->
    <div v-else-if="view==='month'" class="cal-month">
      <div class="cal-mwds"><div v-for="w in WD" :key="w" class="cal-mwd">{{ w }}</div></div>
      <div class="cal-mgrid">
        <div
          v-for="cell in monthCells" :key="cell.dayKey"
          class="cal-mcell"
          :class="{ out: !cell.inMonth, today: cell.isToday, 'cal-drop-hover': monthHover===cell.dayKey }"
          @dragover="onMonthOver(cell, $event)" @drop.prevent="onMonthDrop(cell)" @dragleave="monthHover===cell.dayKey && (monthHover=null)">
          <div class="cal-mnum">{{ cell.num }}</div>
          <div
            v-for="c in cell.chips" :key="c.deal.id"
            class="cal-mchip" :class="c.deal.temperature ? 'temp-'+c.deal.temperature : ''"
            draggable="true" @dragstart="onMonthDragStart(c.deal, $event)" @dragend="onDragEnd" @click="openDeal(c.deal)">
            {{ c.time }}{{ c.deal.client_name || 'Без названия' }}
          </div>
          <div v-if="cell.more > 0" class="cal-mmore">+{{ cell.more }}</div>
        </div>
      </div>
    </div>

    <!-- ===== ДЕНЬ / НЕДЕЛЯ ===== -->
    <template v-else>
      <div class="cal-head-row">
        <div class="cal-gutter-spacer"></div>
        <div class="cal-heads">
          <div v-for="c in columns" :key="c.dayKey" class="cal-dayhead" :class="{ today: c.isToday }">
            <span class="cal-dh-wd">{{ c.wd }}</span> <span class="cal-dh-num">{{ c.num }}</span>
          </div>
        </div>
      </div>

      <div v-if="hasAllday" class="cal-allday-row">
        <div class="cal-allday-label">без времени</div>
        <div class="cal-allday-cells">
          <div v-for="c in columns" :key="c.dayKey" class="cal-allday-cell">
            <div
              v-for="d in c.allday" :key="d.id"
              class="cal-chip" :class="d.temperature ? 'temp-'+d.temperature : ''"
              draggable="true" @dragstart="onAlldayDragStart(d, $event)" @dragend="onDragEnd" @click="openDeal(d)">
              <div class="cal-chip-name">{{ d.client_name || 'Без названия' }}</div>
              <div v-if="d.next_step" class="cal-chip-goal">Цель: {{ d.next_step }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="isEmpty" class="cal-empty-note">На этот период нет запланированных контактов.</div>

      <div class="cal-scroll">
        <div class="cal-grid">
          <div class="cal-gutter" :style="{ height: gridHeight+'px' }">
            <div v-for="g in gutter" :key="g.h" class="cal-time" :style="{ top: g.top+'px' }">{{ pad(g.h) }}:00</div>
          </div>
          <div class="cal-cols">
            <div v-for="c in columns" :key="c.dayKey" class="cal-col">
              <div class="cal-col-grid" :style="{ height: gridHeight+'px' }"
                   @dragover="onColDragOver(c, $event)" @drop.prevent="onColDrop(c, $event)">
                <div v-for="(ln, i) in lines" :key="i" :class="ln.half ? 'cal-halfline' : 'cal-hourline'" :style="{ top: ln.top+'px' }"></div>
                <div v-if="c.nowTop !== null" class="cal-now" :style="{ top: c.nowTop+'px' }"></div>
                <div v-if="indicator && indicator.dayKey===c.dayKey" class="cal-drop-indicator" :style="{ top: indicator.top+'px' }"></div>
                <div
                  v-for="e in c.events" :key="e.deal.id"
                  class="cal-event" :class="[e.deal.temperature ? 'temp-'+e.deal.temperature : '', { 'cal-dragging': drag && drag.id===e.deal.id }]"
                  draggable="true"
                  :style="{ top: e.top+'px', height: e.height+'px', left: 'calc('+e.left+'% + 2px)', width: 'calc('+e.width+'% - 4px)' }"
                  @dragstart="onEventDragStart(e.deal, $event)" @dragend="onDragEnd" @click="openDeal(e.deal)">
                  <div class="cal-ev-line"><span class="cal-ev-time">{{ e.time }}</span>{{ e.deal.client_name || 'Без названия' }}<span v-if="e.isLead" class="cal-ev-lead">лид</span></div>
                  <div v-if="e.deal.next_step" class="cal-ev-goal">Цель: {{ e.deal.next_step }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <DealCard v-if="selectedId" :key="selectedId" :id="selectedId" @close="selectedId = null" @saved="load" />
  </section>
</template>

<style scoped>
.cal-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.cal-btn { padding: 6px 12px; border: 0.5px solid var(--border); background: var(--bg); border-radius: var(--radius); font-size: 13px; cursor: pointer; color: var(--text); }
.cal-btn:hover { border-color: var(--border-strong); }
.cal-btn.active { background: var(--text); color: #fff; border-color: var(--text); }
.cal-arrow { width: 34px; padding: 6px 0; font-size: 16px; line-height: 1; }
.cal-label { font-size: 15px; font-weight: 500; margin-left: 6px; text-transform: capitalize; }
.cal-spacer { flex: 1; }
.cal-views { display: flex; gap: 4px; }
.cal-legend { font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; }

.cal-head-row { display: flex; }
.cal-gutter-spacer, .cal-gutter { width: 56px; flex: 0 0 56px; }
.cal-heads, .cal-cols, .cal-allday-cells { display: flex; flex: 1; min-width: 0; }
.cal-dayhead { flex: 1 1 0; min-width: 0; text-align: center; padding: 6px 2px; font-size: 12px; color: var(--text-secondary); border-left: 0.5px solid var(--border); }
.cal-dayhead .cal-dh-num { font-size: 15px; font-weight: 500; color: var(--text); }
.cal-dayhead.today .cal-dh-num { background: var(--text); color: #fff; border-radius: 50%; padding: 1px 7px; display: inline-block; }

.cal-allday-row { display: flex; border-top: 0.5px solid var(--border); border-bottom: 0.5px solid var(--border); background: var(--bg-secondary); }
.cal-allday-label { width: 56px; flex: 0 0 56px; font-size: 10px; color: var(--text-tertiary); padding: 6px 4px; }
.cal-allday-cell { flex: 1 1 0; min-width: 0; border-left: 0.5px solid var(--border); padding: 4px; display: flex; flex-direction: column; gap: 3px; }

.cal-scroll { max-height: 64vh; overflow: auto; border: 0.5px solid var(--border); border-radius: var(--radius); background: var(--bg); }
.cal-grid { display: flex; position: relative; }
.cal-gutter { position: relative; }
.cal-time { position: absolute; right: 6px; transform: translateY(-50%); font-size: 11px; color: var(--text-tertiary); }
.cal-col { flex: 1 1 0; min-width: 0; border-left: 0.5px solid var(--border); }
.cal-col-grid { position: relative; }
.cal-hourline { position: absolute; left: 0; right: 0; border-top: 0.5px solid var(--border); }
.cal-halfline { position: absolute; left: 0; right: 0; border-top: 0.5px dashed var(--border); opacity: 0.5; }
.cal-now { position: absolute; left: 0; right: 0; border-top: 2px solid var(--danger); z-index: 3; }
.cal-now::before { content: ''; position: absolute; left: 0; top: -4px; width: 7px; height: 7px; border-radius: 50%; background: var(--danger); }
.cal-event { position: absolute; overflow: hidden; border-radius: 6px; padding: 2px 6px; font-size: 11px; line-height: 1.15; cursor: grab; border: 0.5px solid var(--border); background: var(--bg-secondary); box-shadow: 0 1px 2px rgba(0,0,0,0.06); z-index: 2; display: flex; flex-direction: column; gap: 0; }
.cal-ev-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cal-event .cal-ev-time { font-weight: 600; margin-right: 3px; }
.cal-ev-goal { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 10px; opacity: 0.8; }
.cal-event.temp-hot  { background: var(--hot-bg);  color: var(--hot-text);  border-color: var(--hot-text); }
.cal-event.temp-warm { background: var(--warm-bg); color: var(--warm-text); border-color: #c9892f; }
.cal-event.temp-cold { background: var(--cold-bg); color: var(--cold-text); border-color: #5b8fc0; }
.cal-ev-lead { font-size: 10px; background: var(--gold); color: #fff; border-radius: 4px; padding: 0 4px; margin-left: 4px; }
.cal-chip { font-size: 11px; padding: 2px 6px; border-radius: 5px; background: var(--bg-tertiary); cursor: grab; overflow: hidden; }
.cal-chip-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cal-chip-goal { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 10px; opacity: 0.8; }
.cal-chip.temp-hot  { background: var(--hot-bg);  color: var(--hot-text); }
.cal-chip.temp-warm { background: var(--warm-bg); color: var(--warm-text); }
.cal-chip.temp-cold { background: var(--cold-bg); color: var(--cold-text); }
.cal-empty-note { font-size: 12px; color: var(--text-tertiary); padding: 10px 4px; }

.cal-event.cal-dragging, .cal-mchip.cal-dragging { opacity: 0.4; }
.cal-drop-indicator { position: absolute; left: 0; right: 0; height: 0; border-top: 2px solid var(--gold); z-index: 5; pointer-events: none; }
.cal-drop-indicator::before { content: ''; position: absolute; left: 2px; top: -4px; width: 7px; height: 7px; border-radius: 50%; background: var(--gold); }
.cal-mcell.cal-drop-hover { outline: 2px solid var(--gold); outline-offset: -2px; background: var(--bg-secondary); }

.cal-mwds { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px; }
.cal-mwd { text-align: center; font-size: 12px; color: var(--text-secondary); padding: 4px; }
.cal-mgrid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--border); border: 0.5px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.cal-mcell { background: var(--bg); min-height: 96px; padding: 4px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
.cal-mcell.out { background: var(--bg-secondary); }
.cal-mcell.out .cal-mnum { color: var(--text-tertiary); }
.cal-mnum { font-size: 12px; font-weight: 500; align-self: flex-start; }
.cal-mcell.today .cal-mnum { background: var(--text); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.cal-mchip { font-size: 11px; padding: 1px 5px; border-radius: 4px; background: var(--bg-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: grab; }
.cal-mchip.temp-hot  { background: var(--hot-bg);  color: var(--hot-text); }
.cal-mchip.temp-warm { background: var(--warm-bg); color: var(--warm-text); }
.cal-mchip.temp-cold { background: var(--cold-bg); color: var(--cold-text); }
.cal-mmore { font-size: 10px; color: var(--text-secondary); }
@media (max-width: 720px) { .cal-mcell { min-height: 70px; } .cal-label { font-size: 13px; } }
.muted { color: var(--text-tertiary); }
.err { color: var(--danger); }
</style>
