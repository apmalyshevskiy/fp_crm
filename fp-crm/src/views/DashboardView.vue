<!-- src/views/DashboardView.vue -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '../api/client'
import { isArchived, isLead, isDeal, isOverdue, fmtDate, TEMP } from '../lib/deals'

const deals = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    deals.value = await db.list('deals', { size: 1000, order: 'updated_at,desc' })
  } catch (e) { error.value = e.message } finally { loading.value = false }
})

const active = computed(() => deals.value.filter(isDeal))

const stats = computed(() => [
  { label: 'Лиды',        value: deals.value.filter(d => !isArchived(d) && isLead(d)).length, color: 'var(--gold)' },
  { label: 'Всего сделок', value: active.value.length },
  { label: 'Горячие',     value: active.value.filter(d => d.temperature === 'hot').length,  color: 'var(--hot-text)' },
  { label: 'Тёплые',      value: active.value.filter(d => d.temperature === 'warm').length, color: 'var(--warm-text)' },
  { label: 'Срочно',      value: active.value.filter(isOverdue).length, color: 'var(--danger)' },
])

const upcoming = computed(() =>
  active.value
    .filter(d => d.next_date && d.status !== 'Оплачено' && d.status !== 'Отказ')
    .sort((a, b) => new Date(a.next_date) - new Date(b.next_date))
    .slice(0, 5)
)
</script>

<template>
  <section>
    <p v-if="loading" class="muted">Загрузка…</p>
    <p v-else-if="error" class="err">Ошибка: {{ error }}</p>

    <template v-else>
      <div class="grid-stats">
        <div v-for="s in stats" :key="s.label" class="stat">
          <div class="stat-label">{{ s.label }}</div>
          <div class="stat-value" :style="{ color: s.color || 'var(--text)' }">{{ s.value }}</div>
        </div>
      </div>

      <div class="section-title">Ближайшие follow-up</div>
      <div v-if="upcoming.length === 0" class="empty">Нет запланированных follow-up</div>
      <div v-else>
        <div v-for="d in upcoming" :key="d.id" class="deal-row">
          <div class="deal-main">
            <div class="deal-name">{{ d.client_name || 'Без названия' }}</div>
            <div class="deal-meta">{{ d.next_step || '—' }}</div>
          </div>
          <span v-if="TEMP[d.temperature]" class="temp" :class="TEMP[d.temperature].cls">
            {{ TEMP[d.temperature].label }}
          </span>
          <div class="next-date" :class="{ overdue: isOverdue(d) }">{{ fmtDate(d.next_date) }}</div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.grid-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.stat { background: var(--bg); border-radius: var(--radius); padding: 1rem; border: 0.5px solid var(--border); }
.stat-label { font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }
.stat-value { font-size: 28px; font-weight: 600; }

.section-title { margin: 1.5rem 0 .75rem; font-weight: 600; }
.empty { color: var(--text-tertiary); padding: 1rem; }
.deal-row {
  display: flex; align-items: center; gap: 12px;
  background: var(--bg); border: 0.5px solid var(--border); border-radius: var(--radius);
  padding: 12px 14px; margin-bottom: 8px;
}
.deal-main { flex: 1; min-width: 0; }
.deal-name { font-weight: 500; }
.deal-meta { font-size: 13px; color: var(--text-secondary); }
.next-date { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }
.next-date.overdue { color: var(--danger); font-weight: 500; }
.muted { color: var(--text-tertiary); }
.err { color: var(--danger); }
</style>
