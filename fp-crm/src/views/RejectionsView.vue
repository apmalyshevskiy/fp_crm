<!-- src/views/RejectionsView.vue — аналитика отказов (срезы считаем на клиенте) -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '../api/client'
import { isArchived, fmtDateShort } from '../lib/deals'
import DealCard from './DealCard.vue'

const deals = ref([])
const loading = ref(true)
const error = ref('')
const selectedId = ref(null)

async function load() {
  loading.value = true; error.value = ''
  try { deals.value = await db.list('deals', { size: 1000, order: 'updated_at,desc' }) }
  catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)

const rejected = computed(() => deals.value.filter(d => !isArchived(d) && d.status === 'Отказ'))

const stats = computed(() => {
  const byCat = {}, byReason = {}, byComp = {}, reanim = []
  for (const d of rejected.value) {
    const cat = d.rejection_category || 'Не указано'
    byCat[cat] = (byCat[cat] || 0) + 1
    const reason = d.rejection_reason || ''
    if (reason) {
      const key = cat + ' / ' + reason
      if (!byReason[key]) byReason[key] = { category: cat, reason, count: 0, quotes: [] }
      byReason[key].count++
      if (d.rejection_quote && byReason[key].quotes.length < 5) byReason[key].quotes.push(String(d.rejection_quote))
    }
    if (cat === 'Уже выбрали конкурента' && reason) byComp[reason] = (byComp[reason] || 0) + 1
    if (d.can_reanimate === true || Number(d.can_reanimate) === 1) reanim.push(d)
  }
  reanim.sort((a, b) => {
    const ad = a.reanimate_after_date ? new Date(a.reanimate_after_date) : new Date(8.64e15)
    const bd = b.reanimate_after_date ? new Date(b.reanimate_after_date) : new Date(8.64e15)
    return ad - bd
  })
  return {
    byCategory: Object.entries(byCat).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    byReason: Object.values(byReason).sort((a, b) => b.count - a.count),
    byCompetitor: Object.entries(byComp).map(([competitor, count]) => ({ competitor, count })).sort((a, b) => b.count - a.count),
    reanimation: reanim,
  }
})
const totalRejections = computed(() => stats.value.byCategory.reduce((s, x) => s + x.count, 0))
function isDue(r) { return r.reanimate_after_date && new Date(String(r.reanimate_after_date).replace(' ', 'T')) <= new Date() }
const dueCount = computed(() => stats.value.reanimation.filter(isDue).length)
const isEmpty = computed(() => stats.value.byCategory.length === 0 && stats.value.reanimation.length === 0)

// раскрытие групп: показать сделки внутри категории/причины/конкурента
const expanded = ref({})
function toggle(key) { expanded.value[key] = !expanded.value[key] }
function catDeals(cat) { return rejected.value.filter(d => (d.rejection_category || 'Не указано') === cat) }
function reasonDeals(r) { return rejected.value.filter(d => (d.rejection_category || 'Не указано') === r.category && (d.rejection_reason || '') === r.reason) }
function compDeals(name) { return rejected.value.filter(d => d.rejection_category === 'Уже выбрали конкурента' && (d.rejection_reason || '') === name) }
</script>

<template>
  <section>
    <div class="legend">Анализ причин отказов: что чинить в продукте, кого можно реанимировать, какие аргументы готовить.</div>

    <p v-if="loading" class="muted">Загрузка…</p>
    <p v-else-if="error" class="err">Ошибка: {{ error }}</p>
    <div v-else-if="isEmpty" class="empty">Пока нет отказов с заполненной причиной. Когда у сделки статус «Отказ» и заполнен блок причин — здесь появится сводка.</div>

    <template v-else>
      <!-- Реанимация -->
      <div v-if="stats.reanimation.length" class="rej-section">
        <div class="rej-title">Реанимация
          <span class="hint" :class="{ ok: dueCount > 0 }">{{ dueCount > 0 ? `пора звонить: ${dueCount}` : `всего ожидают возврата: ${stats.reanimation.length}` }}</span>
        </div>
        <div v-for="r in stats.reanimation" :key="r.id" class="rej-reanim" :class="{ due: isDue(r) }" @click="r.id != null && (selectedId = r.id)">
          <div class="rej-reanim-head">
            <div class="rej-reanim-name">{{ r.client_name || 'Без названия' }}</div>
            <div class="rej-reanim-date" :class="{ due: isDue(r) }">{{ r.reanimate_after_date ? (isDue(r) ? '✓ ' : '') + fmtDateShort(r.reanimate_after_date) : 'без даты' }}</div>
          </div>
          <div v-if="r.rejection_category || r.rejection_reason" class="rej-reanim-reason">
            {{ r.rejection_category || '' }}{{ r.rejection_reason ? ' › ' + r.rejection_reason : '' }}{{ r.rejection_reason_other ? ' — ' + r.rejection_reason_other : '' }}
          </div>
          <div v-if="r.rejection_quote" class="rej-reanim-quote">« {{ r.rejection_quote }} »</div>
        </div>
      </div>

      <!-- По категориям -->
      <div v-if="stats.byCategory.length" class="rej-section">
        <div class="rej-title">По категориям <span class="hint">всего отказов: {{ totalRejections }}</span></div>
        <template v-for="c in stats.byCategory" :key="c.category">
          <div class="rej-bar clickable" @click="toggle('cat:' + c.category)">
            <div class="rej-bar-label"><span class="caret" :class="{ open: expanded['cat:' + c.category] }">›</span>{{ c.category }}</div>
            <div class="rej-bar-count">{{ c.count }}</div>
          </div>
          <div v-if="expanded['cat:' + c.category]" class="drill">
            <div v-for="d in catDeals(c.category)" :key="d.id" class="drill-row" @click="d.id != null && (selectedId = d.id)">
              <span class="drill-name">{{ d.client_name || 'Без названия' }}</span>
              <span class="drill-meta">{{ [d.type, d.rejection_reason].filter(Boolean).join(' · ') }}</span>
            </div>
          </div>
        </template>
      </div>

      <!-- Конкуренты -->
      <div v-if="stats.byCompetitor.length" class="rej-section">
        <div class="rej-title">Выбрали конкурента <span class="hint">кому проигрываем чаще</span></div>
        <template v-for="c in stats.byCompetitor" :key="c.competitor">
          <div class="rej-bar clickable" @click="toggle('comp:' + c.competitor)">
            <div class="rej-bar-label"><span class="caret" :class="{ open: expanded['comp:' + c.competitor] }">›</span>{{ c.competitor }}</div>
            <div class="rej-bar-count">{{ c.count }}</div>
          </div>
          <div v-if="expanded['comp:' + c.competitor]" class="drill">
            <div v-for="d in compDeals(c.competitor)" :key="d.id" class="drill-row" @click="d.id != null && (selectedId = d.id)">
              <span class="drill-name">{{ d.client_name || 'Без названия' }}</span>
              <span class="drill-meta">{{ d.type || '' }}</span>
            </div>
          </div>
        </template>
      </div>

      <!-- По конкретным причинам -->
      <div v-if="stats.byReason.length" class="rej-section">
        <div class="rej-title">По конкретным причинам <span class="hint">материал для бэклога продукта</span></div>
        <template v-for="r in stats.byReason" :key="r.category + r.reason">
          <div class="rej-bar reason clickable" @click="toggle('reason:' + r.category + r.reason)">
            <div class="rej-bar-main">
              <div class="rej-bar-label"><span class="caret" :class="{ open: expanded['reason:' + r.category + r.reason] }">›</span><span class="cat">{{ r.category }} › </span>{{ r.reason }}</div>
              <div v-if="r.quotes.length" class="rej-quotes">
                <div v-for="(q, i) in r.quotes" :key="i" class="rej-quote">« {{ q }} »</div>
              </div>
            </div>
            <div class="rej-bar-count">{{ r.count }}</div>
          </div>
          <div v-if="expanded['reason:' + r.category + r.reason]" class="drill">
            <div v-for="d in reasonDeals(r)" :key="d.id" class="drill-row" @click="d.id != null && (selectedId = d.id)">
              <span class="drill-name">{{ d.client_name || 'Без названия' }}</span>
              <span class="drill-meta">{{ d.type || '' }}</span>
            </div>
          </div>
        </template>
      </div>
    </template>

    <DealCard v-if="selectedId" :key="selectedId" :id="selectedId" @close="selectedId = null" @saved="load" />
  </section>
</template>

<style scoped>
.legend { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }
.rej-section { margin-bottom: 22px; }
.rej-title { font-weight: 600; margin-bottom: 10px; }
.hint { font-weight: 400; font-size: 12px; color: var(--text-tertiary); margin-left: 8px; }
.hint.ok { color: #1D9E75; font-weight: 600; }

.rej-bar { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; background: var(--bg); border: 0.5px solid var(--border); border-radius: var(--radius); padding: 12px 16px; margin-bottom: 8px; }
.rej-bar-main { flex: 1; min-width: 0; }
.rej-bar-label { font-size: 14px; }
.rej-bar-label .cat { color: var(--text-tertiary); }
.rej-bar-count { flex-shrink: 0; min-width: 28px; text-align: center; font-weight: 600; color: var(--text-secondary); background: var(--bg-secondary); border-radius: 999px; padding: 1px 8px; }
.rej-quotes { margin-top: 8px; }
.rej-quote { font-size: 12px; color: var(--text-tertiary); font-style: italic; margin-top: 3px; }

.rej-bar.clickable { cursor: pointer; }
.rej-bar.clickable:hover { border-color: var(--border-strong); }
.caret { display: inline-block; margin-right: 6px; color: var(--text-tertiary); transition: transform .15s; }
.caret.open { transform: rotate(90deg); }
.drill { margin: -4px 0 10px 14px; }
.drill-row { display: flex; gap: 10px; align-items: baseline; padding: 7px 12px; background: var(--bg); border: 0.5px solid var(--border); border-radius: var(--radius); margin-bottom: 4px; cursor: pointer; }
.drill-row:hover { border-color: var(--border-strong); }
.drill-name { font-weight: 500; font-size: 13px; }
.drill-meta { font-size: 12px; color: var(--text-tertiary); }

.rej-reanim { background: var(--bg-secondary); border: 0.5px solid var(--border); border-left: 3px solid #1D9E75; border-radius: var(--radius); padding: 12px 16px; margin-bottom: 8px; cursor: pointer; }
.rej-reanim:hover { border-color: var(--border-strong); border-left-color: #1D9E75; }
.rej-reanim-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.rej-reanim-name { font-weight: 600; }
.rej-reanim-date { font-size: 12px; color: var(--text-tertiary); white-space: nowrap; }
.rej-reanim-date.due { color: #1D9E75; font-weight: 600; }
.rej-reanim-reason { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.rej-reanim-quote { font-size: 12px; color: var(--text-tertiary); font-style: italic; margin-top: 4px; }

.empty { color: var(--text-tertiary); padding: 1rem; }
.muted { color: var(--text-tertiary); }
.err { color: var(--danger); }
</style>
