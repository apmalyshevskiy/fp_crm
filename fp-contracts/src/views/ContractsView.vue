<!-- src/views/ContractsView.vue — список выпущенных договоров -->
<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../api/client'
import { formatDateShort, blocksToHtml } from '../lib/merge'
import { printHtml } from '../lib/print'
import { downloadDocx } from '../lib/docx'

const contracts = ref([])
const loading = ref(true)
const error = ref('')

const STATUS = { draft: 'Черновик', signed: 'Подписан', cancelled: 'Расторгнут' }

function meta(c) { try { return JSON.parse(c.variables || '{}') } catch { return {} } }

// снимок body хранится как блоки (JSON-массив). Старые записи могли быть HTML.
function blocksOf(c) {
  try { const v = JSON.parse(c.body); return Array.isArray(v) ? v : null } catch { return null }
}

async function load() {
  loading.value = true; error.value = ''
  try {
    contracts.value = await db.list('contracts')
    contracts.value.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  } catch (e) { error.value = e.message } finally { loading.value = false }
}

function reprint(c) {
  const b = blocksOf(c)
  printHtml(b ? blocksToHtml(b) : c.body, `Договор № ${c.number || ''}`)
}
function docx(c) {
  const b = blocksOf(c)
  if (!b) { alert('Договор сохранён в старом формате. Пересоздайте его, чтобы выгрузить DOCX.'); return }
  downloadDocx(b, `Договор № ${c.number || ''}.docx`)
}

async function markSigned(c) {
  if (!confirm(`Пометить договор № ${c.number || ''} как подписанный? После этого его нельзя будет редактировать.`)) return
  try {
    const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
    await db.update('contracts', c.id, { status: 'signed', updated_at: stamp })
    await load()
  } catch (e) { error.value = e.message }
}
async function remove(c) {
  if (!confirm(`Удалить договор № ${c.number || ''}?`)) return
  try { await db.remove('contracts', c.id); await load() } catch (e) { error.value = e.message }
}

onMounted(load)
</script>

<template>
  <section>
    <div class="head">
      <h2>Договоры</h2>
      <router-link to="/contracts/new" class="newbtn">+ Новый договор</router-link>
    </div>

    <p v-if="loading" class="muted">Загрузка…</p>
    <p v-else-if="error" class="err">Ошибка: {{ error }}</p>
    <p v-else-if="contracts.length === 0" class="muted">Договоров пока нет.</p>

    <ul v-else class="list">
      <li v-for="c in contracts" :key="c.id">
        <div class="info">
          <strong>Договор № {{ c.number || '—' }}</strong>
          <span class="muted"> от {{ formatDateShort(c.date) || '—' }}</span>
          <span class="badge" :class="c.status">{{ STATUS[c.status] || c.status }}</span>
          <div class="muted sub">{{ meta(c).partner_name || '—' }} · {{ meta(c).entity_label || '—' }}</div>
        </div>
        <div class="actions">
          <button @click="docx(c)">DOCX</button>
          <button @click="reprint(c)">Печать / PDF</button>
          <template v-if="c.status === 'draft'">
            <router-link :to="`/contracts/${c.id}/edit`" class="linkbtn">Изменить</router-link>
            <button @click="markSigned(c)">Подписан</button>
          </template>
          <button class="danger" @click="remove(c)">Удалить</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; }
.newbtn { padding: 8px 14px; border-radius: 8px; text-decoration: none; background: var(--gold); color: #1a1a1a; font-size: 14px; }
.list { list-style: none; padding: 0; }
.list li { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; gap: 12px; }
.sub { font-size: 13px; margin-top: 2px; }
.badge { display: inline-block; margin-left: 8px; padding: 1px 8px; font-size: 12px; border: 1px solid var(--border); border-radius: 999px; color: var(--text-secondary); }
.badge.signed { color: var(--success); border-color: var(--success); }
.actions { display: flex; gap: 8px; flex-shrink: 0; align-items: center; }
.linkbtn { padding: 8px 14px; border: 1px solid var(--border); border-radius: 8px; text-decoration: none; color: var(--text-primary); font-size: 14px; }
.linkbtn:hover { background: var(--bg-secondary); }
button.danger { color: var(--danger); border-color: var(--danger); }
button.danger:hover { background: #fbecea; }
.muted { color: var(--text-tertiary); }
.err { color: var(--danger); }
</style>
