<!-- src/components/ProposalForm.vue — модалка создания/редактирования КП (блок 2).
     Позиции из каталога (datalist) или произвольные, НДС «изнутри» цены, итоги,
     запись касания и перевод статуса сделки при отправке. PUT+merge — как везде. -->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { db } from '../api/client'
import {
  VAT_RATES, calcRow, calcTotals, round2, fmtMoney2, ADVANCE_BLOCKED_STATUSES,
} from '../lib/proposals'

const props = defineProps({
  deal: { type: Object, required: true },     // { id, client_name, seller_id, status, ... }
  proposalId: { default: null },              // null = новое КП
})
const emit = defineEmits(['close', 'saved'])

const isEdit = computed(() => props.proposalId != null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const showVat = ref(false)
const originalStatus = ref(null)              // статус редактируемого КП (для логики кнопок)

const header = ref({ date: today(), valid_until: '', comment: '' })
const items = ref([])

// каталог: плоский список опций для datalist + индекс по подписи «Категория — Позиция»
const catalogOptions = ref([])               // [{ label, item }]
const catalogByLabel = ref({})

function today() { return new Date().toISOString().slice(0, 10) }

const totals = computed(() => calcTotals(items.value))

// ---- загрузка ----
async function loadCatalog() {
  try {
    const rows = await db.list('catalog_items', { filter: 'is_active,eq,1', order: 'position,asc', size: 500 })
    const cats = rows.filter(r => !r.parent_id).sort((a, b) => (a.position || 0) - (b.position || 0))
    const opts = []
    const byLabel = {}
    for (const c of cats) {
      const children = rows.filter(r => r.parent_id === c.id).sort((a, b) => (a.position || 0) - (b.position || 0))
      for (const r of children) {
        const item = { id: r.id, name: r.name, unit: r.unit || '', price: Number(r.price || 0), vat_rate: r.vat_rate || 'no_vat' }
        const label = `${c.name} — ${r.name}`
        opts.push({ label, item })
        byLabel[label] = item
      }
    }
    catalogOptions.value = opts
    catalogByLabel.value = byLabel
  } catch (e) {
    // каталог не критичен — позицию можно ввести руками
    console.warn('Каталог не загружен:', e.message)
  }
}

async function loadProposal() {
  const [proposal, its] = await Promise.all([
    db.get('proposals', props.proposalId),
    db.list('proposal_items', { filter: `proposal_id,eq,${props.proposalId}`, order: 'position,asc', size: 500 }),
  ])
  if (proposal.status === 'cancelled') throw new Error('Отменённое КП редактировать нельзя')
  originalStatus.value = proposal.status
  header.value = {
    date: proposal.date || today(),
    valid_until: proposal.valid_until || '',
    comment: proposal.comment || '',
  }
  items.value = its.map(it => ({
    catalog_item_id: it.catalog_item_id || null,
    name: it.name || '', unit: it.unit || '',
    quantity: Number(it.quantity) || 0, price: Number(it.price) || 0,
    vat_rate: it.vat_rate || 'no_vat',
    pick: '',
  }))
}

// ---- позиции ----
function addItem() {
  items.value.push({ catalog_item_id: null, name: '', unit: '', quantity: 1, price: 0, vat_rate: 'no_vat', pick: '' })
}
function removeItem(i) { items.value.splice(i, 1) }
function onPick(i) {
  const matched = catalogByLabel.value[items.value[i].pick]
  if (!matched) return
  const it = items.value[i]
  it.catalog_item_id = matched.id
  it.name = matched.name
  it.unit = matched.unit
  it.price = matched.price
  it.vat_rate = matched.vat_rate
  it.pick = ''   // очищаем поле выбора, наименование уже заполнено
}
function rowAmount(it) { return calcRow(it).amount }
function rowVat(it) { const r = calcRow(it); return (!it.vat_rate || it.vat_rate === 'no_vat') ? null : r.vat_amount }

// ---- валидация и сохранение ----
function validate() {
  if (!props.deal?.id) return 'Не определена сделка'
  if (items.value.length === 0) return 'Добавьте хотя бы одну позицию'
  for (let i = 0; i < items.value.length; i++) {
    const it = items.value[i]
    if (!String(it.name || '').trim()) return `Не заполнено наименование в строке ${i + 1}`
    if (Number(it.quantity) <= 0) return `Количество должно быть больше 0 (строка ${i + 1})`
  }
  return null
}

async function save(statusValue) {
  const err = validate()
  if (err) { error.value = err; return }
  saving.value = true; error.value = ''
  try {
    const t = calcTotals(items.value)
    const payload = {
      deal_id: props.deal.id,
      date: header.value.date || null,
      valid_until: header.value.valid_until || null,
      comment: header.value.comment || '',
      status: statusValue,
      total_amount: round2(t.total),
      total_vat: round2(t.total_vat),
      total_no_vat: round2(t.total_no_vat),
      seller_id: props.deal.seller_id || null,
    }

    let proposalId
    if (isEdit.value) {
      // PUT+merge (PATCH глючит) + пересоздание позиций
      proposalId = props.proposalId
      const existing = await db.get('proposals', proposalId)
      const merged = { ...existing, ...payload }
      delete merged.id
      await db.replace('proposals', proposalId, merged)
      const old = await db.list('proposal_items', { filter: `proposal_id,eq,${proposalId}`, size: 500 })
      await Promise.all(old.map(it => db.remove('proposal_items', it.id)))
    } else {
      const created = await db.create('proposals', payload)
      proposalId = (created && typeof created === 'object') ? created.id : created
      proposalId = Number(proposalId)
      if (!proposalId) throw new Error('Не удалось получить id нового КП')
    }

    // позиции
    await Promise.all(items.value.map((it, idx) => {
      const r = calcRow(it)
      return db.create('proposal_items', {
        proposal_id: proposalId, position: idx + 1,
        catalog_item_id: it.catalog_item_id || null,
        name: it.name, unit: it.unit || '',
        quantity: Number(it.quantity) || 0, price: round2(it.price),
        vat_rate: it.vat_rate || 'no_vat',
        amount: round2(r.amount), vat_amount: round2(r.vat_amount),
      })
    }))

    // отправлено (и не было отправлено раньше) → касание + продвижение статуса сделки
    if (statusValue === 'sent' && originalStatus.value !== 'sent') {
      await postProposalActivity(proposalId, t.total)
      await maybeAdvanceDealStatus()
    }

    emit('saved')
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

async function postProposalActivity(proposalId, totalAmount) {
  try {
    await db.create('activity', {
      deal_id: Number(props.deal.id),
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      seller_id: props.deal.seller_id || null,
      type: 'proposal',
      summary: `Отправлено КП №${proposalId} на сумму ${fmtMoney2(totalAmount)}`,
      status_after: '', temperature_after: '', next_step: '', next_date: null,
    })
  } catch (e) { console.warn('activity для КП не записан:', e.message) }
}

async function maybeAdvanceDealStatus() {
  if (ADVANCE_BLOCKED_STATUSES.includes(props.deal.status)) return
  try {
    const existing = await db.get('deals', props.deal.id)
    const merged = { ...existing, status: 'КП отправлено', updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ') }
    delete merged.id
    await db.replace('deals', props.deal.id, merged)
  } catch (e) { console.warn('Статус сделки не обновлён:', e.message) }
}

// ---- кнопки сохранения зависят от режима/статуса ----
const buttons = computed(() => {
  if (isEdit.value && originalStatus.value === 'sent') {
    return [{ label: 'Сохранить изменения', status: 'sent' }]   // повторно не отправляем
  }
  return [
    { label: 'Сохранить и отправить', status: 'sent', primary: true },
    { label: isEdit.value ? 'Сохранить (черновик)' : 'Сохранить как черновик', status: 'draft' },
  ]
})

function onEsc(e) { if (e.key === 'Escape' && !saving.value) { e.stopPropagation(); emit('close') } }
onMounted(async () => {
  window.addEventListener('keydown', onEsc, true)   // capture — чтобы не закрыть карточку под формой
  try { await Promise.all([loadCatalog(), isEdit.value ? loadProposal() : Promise.resolve()]) }
  catch (e) { error.value = e.message }
  finally { loading.value = false }
})
onBeforeUnmount(() => window.removeEventListener('keydown', onEsc, true))
</script>

<template>
  <div class="overlay" @click.self="!saving && emit('close')">
    <div class="modal">
      <div class="modal-head">
        <h2>{{ isEdit ? `Редактирование КП №${proposalId}` : 'Новое коммерческое предложение' }}<span class="muted"> · {{ deal.client_name || 'без названия' }}</span></h2>
        <button class="x" @click="!saving && emit('close')">×</button>
      </div>

      <div class="modal-body">
        <p v-if="loading" class="muted">Загрузка…</p>
        <template v-else>
          <p v-if="error" class="err">{{ error }}</p>

          <div class="card">
            <div class="grid">
              <label>Дата КП<input type="date" v-model="header.date" /></label>
              <label>Действительно до<input type="date" v-model="header.valid_until" /></label>
            </div>
            <label class="block">Комментарий<textarea v-model="header.comment" rows="2" placeholder="Контекст КП, условия, договорённости…"></textarea></label>
          </div>

          <div class="card">
            <div class="sub-head">
              <span class="card-title">Позиции</span>
              <label class="vat-toggle"><input type="checkbox" v-model="showVat" /> Показать ставку и НДС</label>
            </div>

            <datalist id="catalog-dl">
              <option v-for="o in catalogOptions" :key="o.label" :value="o.label"></option>
            </datalist>

            <p v-if="items.length === 0" class="muted">Добавьте позиции из каталога или создайте произвольную.</p>

            <div v-for="(it, i) in items" :key="i" class="item" :class="{ 'with-vat': showVat }">
              <div class="item-name">
                <input class="pick" list="catalog-dl" v-model="it.pick" @change="onPick(i)" placeholder="Выбрать из каталога…" autocomplete="off" />
                <textarea v-model="it.name" rows="1" placeholder="Наименование"></textarea>
              </div>
              <input class="unit" v-model="it.unit" placeholder="ед." />
              <input class="qty" type="number" v-model.number="it.quantity" min="0" step="1" />
              <input class="price" type="number" v-model.number="it.price" min="0" step="0.01" />
              <select v-if="showVat" class="vat" v-model="it.vat_rate">
                <option v-for="r in VAT_RATES" :key="r.value" :value="r.value">{{ r.label }}</option>
              </select>
              <div v-if="showVat" class="calc">{{ rowVat(it) == null ? '—' : fmtMoney2(rowVat(it)) }}</div>
              <div class="calc strong">{{ fmtMoney2(rowAmount(it)) }}</div>
              <button type="button" class="x small" @click="removeItem(i)" title="Удалить">×</button>
            </div>

            <button type="button" class="mini add" @click="addItem">+ Добавить позицию</button>
          </div>

          <div class="totals">
            <div class="row main"><span>Всего к оплате:</span><span>{{ fmtMoney2(totals.total) }}</span></div>
            <div class="row"><span>В т.ч. НДС:</span><span>{{ fmtMoney2(totals.total_vat) }}</span></div>
          </div>
        </template>
      </div>

      <div v-if="!loading" class="modal-foot">
        <button
          v-for="b in buttons" :key="b.label"
          :class="{ primary: b.primary }" :disabled="saving"
          @click="save(b.status)"
        >{{ saving ? 'Сохранение…' : b.label }}</button>
        <button :disabled="saving" @click="emit('close')">Отмена</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 200; overflow-y: auto; }
.modal { background: var(--bg); border-radius: var(--radius-lg); width: 100%; max-width: 980px; display: flex; flex-direction: column; max-height: calc(100vh - 80px); }
.modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 0.5px solid var(--border); }
.modal-head h2 { margin: 0; font-size: 17px; }
.modal-body { padding: 16px 20px; overflow-y: auto; }
.modal-foot { display: flex; gap: 8px; padding: 14px 20px; border-top: 0.5px solid var(--border); }
.modal-foot .primary { background: var(--text); color: var(--bg); border-color: var(--text); font-weight: 500; }
.modal-foot .primary:hover { background: #000; border-color: #000; }
.x { border: none; background: none; font-size: 22px; line-height: 1; color: var(--text-tertiary, #9a9a93); padding: 0 4px; }
.x.small { font-size: 18px; }

.card { background: var(--bg); border: 0.5px solid var(--border); border-radius: var(--radius); padding: 1rem 1.25rem; margin-bottom: 12px; }
.card-title { font-weight: 600; font-size: 13px; color: var(--text-secondary); }
.sub-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.vat-toggle { font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }
.vat-toggle input { width: auto; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
label, .block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-secondary); }
.block { margin: 10px 0 0; }
input, select, textarea { font: inherit; padding: 7px 10px; border: 0.5px solid var(--border); border-radius: var(--radius); background: var(--bg); width: 100%; }

/* строка позиции: имя | ед | кол | цена | [ставка | ндс] | всего | × */
.item { display: grid; grid-template-columns: minmax(180px,1fr) 64px 70px 110px 90px 36px; gap: 6px; align-items: start; margin-bottom: 8px; }
.item.with-vat { grid-template-columns: minmax(180px,1fr) 64px 70px 110px 96px 96px 90px 36px; }
.item-name { display: flex; flex-direction: column; gap: 4px; }
.item-name .pick { font-size: 12px; color: var(--text-secondary); }
.item-name textarea { resize: vertical; min-height: 36px; }
.item .calc { padding: 7px 4px; text-align: right; font-size: 13px; }
.item .calc.strong { font-weight: 600; }
.item .x.small { align-self: center; }
.add { margin-top: 6px; font-size: 12px; padding: 6px 12px; border-radius: var(--radius); }

.totals { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin: 8px 4px 0; }
.totals .row { display: flex; gap: 16px; font-size: 13px; color: var(--text-secondary); }
.totals .row.main { font-size: 16px; font-weight: 700; color: var(--text); }
.muted { color: var(--text-tertiary, #9a9a93); }
.err { color: var(--danger); margin-bottom: 10px; }
@media (max-width: 720px) {
  .item, .item.with-vat { grid-template-columns: 1fr 1fr; }
}
</style>
