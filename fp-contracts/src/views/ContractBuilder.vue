<!-- src/views/ContractBuilder.vue — конструктор: создание и правка черновика -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '../api/client'
import { templates } from '../lib/templates'
import { buildBlocks, blocksToHtml } from '../lib/merge'
import { printHtml } from '../lib/print'
import { downloadDocx } from '../lib/docx'

const route = useRoute()
const router = useRouter()
const editId = route.params.id || null

const type = 'partner'
const tpl = templates[type]

const partners = ref([])
const entities = ref([])
const selPartner = ref('')
const selEntity = ref('')
const error = ref('')
const saving = ref(false)

const today = new Date().toISOString().slice(0, 10)
const vars = ref({ number: '', date: today, rate_attract: 12, rate_support: 20 })

async function loadEntities(partnerId) {
  entities.value = partnerId ? await db.listWhere('entities', 'partner_id', partnerId) : []
}
async function onPartnerChange() {
  selEntity.value = ''
  await loadEntities(selPartner.value)
  if (entities.value.length === 1) selEntity.value = entities.value[0].id
}

onMounted(async () => {
  try {
    partners.value = await db.list('partners')
    if (editId) {
      const c = await db.get('contracts', editId)
      if (c.status === 'signed') { alert('Подписанный договор нельзя редактировать.'); router.push('/contracts'); return }
      let m = {}; try { m = JSON.parse(c.variables || '{}') } catch {}
      selPartner.value = c.partner_id
      await loadEntities(c.partner_id)
      selEntity.value = c.entity_id
      vars.value = {
        number: c.number || '',
        date: (c.date || today).slice(0, 10),
        rate_attract: m.rate_attract ?? 12,
        rate_support: m.rate_support ?? 20,
      }
    }
  } catch (e) { error.value = e.message }
})

const partnerObj = computed(() => partners.value.find(p => String(p.id) === String(selPartner.value)))
const entityObj  = computed(() => entities.value.find(e => String(e.id) === String(selEntity.value)))

// единый источник: блоки -> и предпросмотр, и DOCX
const blocks = computed(() =>
  entityObj.value ? buildBlocks(type, { partner: partnerObj.value, entity: entityObj.value, vars: vars.value }) : []
)
const previewHtml = computed(() => blocksToHtml(blocks.value))

function fileName() { return `Договор № ${vars.value.number || ''}`.trim() }
function doPrint() { printHtml(previewHtml.value, fileName()) }
function doDocx() { downloadDocx(blocks.value, fileName() + '.docx') }

async function save() {
  if (!entityObj.value) return
  saving.value = true; error.value = ''
  try {
    const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const payload = {
      partner_id: selPartner.value,
      entity_id: selEntity.value,
      number: vars.value.number,
      date: vars.value.date || null,
      type,
      variables: JSON.stringify({
        rate_attract: vars.value.rate_attract,
        rate_support: vars.value.rate_support,
        partner_name: partnerObj.value?.name || '',
        entity_label: `${entityObj.value.form} ${entityObj.value.legal_name}`,
      }),
      body: JSON.stringify(blocks.value),   // снимок = блоки (из них и HTML, и DOCX)
      updated_at: stamp,
    }
    if (editId) await db.update('contracts', editId, payload)
    else await db.create('contracts', { ...payload, status: 'draft', created_at: stamp })
    router.push('/contracts')
  } catch (e) { error.value = e.message } finally { saving.value = false }
}
</script>

<template>
  <section>
    <router-link to="/contracts" class="back">← К списку договоров</router-link>
    <h2>{{ editId ? 'Редактирование договора' : 'Новый договор' }}</h2>
    <p v-if="error" class="err">Ошибка: {{ error }}</p>

    <div class="builder">
      <div class="panel">
        <div class="muted type">{{ tpl.name }}</div>

        <label>Партнёр
          <select v-model="selPartner" @change="onPartnerChange">
            <option value="">— выберите —</option>
            <option v-for="p in partners" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>

        <label>Юрлицо
          <select v-model="selEntity" :disabled="!selPartner">
            <option value="">— выберите —</option>
            <option v-for="e in entities" :key="e.id" :value="e.id">{{ e.form }} {{ e.legal_name }}</option>
          </select>
        </label>
        <p v-if="selPartner && entities.length === 0" class="muted small">
          У партнёра нет юрлиц — добавьте их в карточке партнёра.
        </p>

        <label>Номер договора<input v-model="vars.number" placeholder="13" /></label>
        <label>Дата договора<input type="date" v-model="vars.date" /></label>
        <label>Ставка за привлечение, %<input type="number" v-model="vars.rate_attract" /></label>
        <label>Ставка за тех. сопровождение, %<input type="number" v-model="vars.rate_support" /></label>

        <div class="btns">
          <button class="primary" :disabled="!entityObj || saving" @click="save">
            {{ saving ? 'Сохранение…' : (editId ? 'Сохранить изменения' : 'Сохранить договор') }}
          </button>
          <button :disabled="!entityObj" @click="doDocx">Скачать DOCX</button>
          <button :disabled="!entityObj" @click="doPrint">Печать / PDF</button>
        </div>
      </div>

      <div class="preview-wrap">
        <div v-if="!entityObj" class="muted placeholder">
          Выберите партнёра и юрлицо — здесь появится договор.
        </div>
        <div v-else class="doc" v-html="previewHtml"></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.back { display: inline-block; margin-bottom: 12px; color: var(--text-secondary); text-decoration: none; }
.back:hover { color: var(--text-primary); }
.builder { display: grid; grid-template-columns: 280px 1fr; gap: 20px; align-items: start; }
.panel { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 16px; }
.panel .type { font-weight: 600; color: var(--text-secondary); }
.panel label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-secondary); }
.btns { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }

.preview-wrap { border: 1px solid var(--border); border-radius: 8px; background: #fff; padding: 24px 28px; min-height: 400px; }
.placeholder { text-align: center; padding: 80px 0; }
.muted { color: var(--text-tertiary); }
.small { font-size: 12px; }
.err { color: var(--danger); }

.doc { color: #111; font-size: 14px; line-height: 1.5; }
.doc :deep(.doc-title) { text-align: center; font-size: 15px; font-weight: 700; }
.doc :deep(.doc-date) { display: flex; justify-content: space-between; margin: 10px 0 16px; }
.doc :deep(.doc-date .spacer) { flex: 1; }
.doc :deep(h3) { font-size: 14px; margin: 16px 0 6px; }
.doc :deep(p) { margin: 5px 0; text-align: justify; }
.doc :deep(table.req) { width: 100%; border-collapse: collapse; margin-top: 18px; }
.doc :deep(table.req th), .doc :deep(table.req td) { border: 1px solid #888; padding: 5px 8px; vertical-align: top; width: 50%; font-size: 12px; }
.doc :deep(table.req .sign td) { padding-top: 26px; }
</style>
