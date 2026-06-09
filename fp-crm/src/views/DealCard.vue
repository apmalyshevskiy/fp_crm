<!-- src/views/DealCard.vue — модальная карточка: просмотр / правка / новое касание -->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { db } from '../api/client'
import { lookupByInn } from '../lib/inn'
import ProposalsBlock from '../components/ProposalsBlock.vue'
import ProposalForm from '../components/ProposalForm.vue'
import {
  fmtDate, TEMP, parseJsonArray,
  TYPES, STAGES, SOURCES, ROLES, PLANS, HARDWARE, CURRENT_SYSTEMS, TEMPS, NEEDS,
  ALL_STATUSES, ACTIVITY_TYPES, ACTIVITY_LABEL,
} from '../lib/deals'
import { userName, currentUserId } from '../lib/users'

const props = defineProps({
  id: { default: null },                      // id существующей сделки
  create: { type: Boolean, default: false },  // режим создания новой
  createStatus: { type: String, default: 'Первичный контакт' }, // статус для новой записи
})
const emit = defineEmits(['close', 'saved'])

const localId = ref(props.id || null)          // текущий id (появится после создания)
const showDelete = ref(false)                  // кнопка удаления (по секретной комбинации)

const deal = ref(null)
const activity = ref([])
const loading = ref(true)
const error = ref('')
const mode = ref('view')      // view | edit | touch
const saving = ref(false)
const innLoading = ref(false)
const form = ref({})
const touch = ref({})

const EDITABLE = [
  'client_name','company_name','inn','phone','email','contact_name','contact_role',
  'type','points','stage','open_date','source','current_system',
  'pain_quote','needs_text','temperature','revenue','plan','hardware',
  'next_step','next_date','comment',
]
function toLocal(s) { return s ? String(s).slice(0, 16).replace(' ', 'T') : '' }
function fromLocal(v) { return v ? v.replace('T', ' ') + (v.length === 16 ? ':00' : '') : null }
function numOrNull(v) { if (v === '' || v == null) return null; const n = Number(v); return isNaN(n) ? null : n }
function nowMysql() { const d = new Date(); const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` }

async function load() {
  const id = localId.value
  if (id === null || id === undefined || id === '' || id === 'null') { loading.value = false; return }
  loading.value = true; error.value = ''
  try { deal.value = await db.get('deals', localId.value) }
  catch (e) { error.value = e.message } finally { loading.value = false }
}
async function loadActivity() {
  if (!localId.value) { activity.value = []; return }
  try {
    activity.value = await db.list('activity', { filter: `deal_id,eq,${localId.value}`, order: 'created_at,desc', size: 200 })
  } catch { activity.value = [] }
}

// ---- правка карточки ----
function startEdit() {
  const f = {}
  for (const k of EDITABLE) f[k] = deal.value[k] ?? ''
  f.next_date = toLocal(deal.value.next_date)
  f.open_date = deal.value.open_date ? String(deal.value.open_date).slice(0, 10) : ''
  f.needs = parseJsonArray(deal.value.needs)
  f.contacts = parseJsonArray(deal.value.contacts)
  form.value = f
  mode.value = 'edit'
}
function toggleNeed(n) { const a = form.value.needs; const i = a.indexOf(n); i === -1 ? a.push(n) : a.splice(i, 1) }
function addContact() { form.value.contacts.push({ name: '', role: '', phone: '', email: '', is_dm: false }) }
function removeContact(i) { form.value.contacts.splice(i, 1) }

// ---- создание новой сделки ----
function blankForm() { const f = {}; for (const k of EDITABLE) f[k] = ''; f.needs = []; f.contacts = []; return f }
function startNew() { form.value = blankForm(); mode.value = 'edit'; loading.value = false }
function cancelEdit() { if (!localId.value) emit('close'); else mode.value = 'view' }

// ---- архив / восстановление / удаление ----
async function acceptLead() {
  if (!confirm('Принять этот лид в работу? Статус станет «Первичный контакт», лид станет сделкой.')) return
  saving.value = true; error.value = ''
  try { await putDeal({ status: 'Первичный контакт', updated_at: nowMysql() }); await load(); emit('saved') }
  catch (e) { error.value = e.message } finally { saving.value = false }
}
async function archiveDeal() {
  saving.value = true; error.value = ''
  try { await putDeal({ archived_at: nowMysql(), updated_at: nowMysql() }); await load(); emit('saved') }
  catch (e) { error.value = e.message } finally { saving.value = false }
}
async function unarchiveDeal() {
  saving.value = true; error.value = ''
  try { await putDeal({ archived_at: null, updated_at: nowMysql() }); await load(); emit('saved') }
  catch (e) { error.value = e.message } finally { saving.value = false }
}
async function deleteDeal() {
  if (!localId.value) return
  if (!confirm('Удалить сделку безвозвратно? История касаний и КП останутся в базе без привязки.')) return
  saving.value = true; error.value = ''
  try { await db.remove('deals', localId.value); emit('saved'); emit('close') }
  catch (e) { error.value = e.message; saving.value = false }
}

// Краткое имя для поля: 'ООО "МВ"' для юрлица, 'ИП Фамилия Имя' для ИП.
function shortOrgName(data) {
  const name = String(data.legal_name || '').trim()
  if (!name) return ''
  const form = String(data.form || '').trim()
  if (!form) return name
  // если имя уже начинается с формы (egrul не нашёл кавычки и вернул «ООО МВ») — не дублируем
  if (name.toUpperCase().startsWith(form.toUpperCase())) return name
  return form === 'ИП' ? `${form} ${name}` : `${form} "${name}"`
}

// Автозаполнение по ИНН через провайдера из src/lib/inn (egrul.org).
// Компанию перетираем данными реестра; название/контакт — только если пусто.
async function fillByInn() {
  const inn = String(form.value.inn || '').trim()
  if (!/^(\d{10}|\d{12})$/.test(inn)) { error.value = 'ИНН должен быть 10 (юрлицо) или 12 (ИП) цифр'; return }
  innLoading.value = true; error.value = ''
  try {
    const { data } = await lookupByInn(inn)
    const orgName = shortOrgName(data)
    if (orgName) {
      form.value.company_name = orgName
      if (!form.value.client_name?.trim()) form.value.client_name = orgName
    }
    if (data.signer_name && !form.value.contact_name?.trim()) form.value.contact_name = data.signer_name
  } catch (e) {
    error.value = `Не удалось получить данные по ИНН: ${e.message}`
  } finally {
    innLoading.value = false
  }
}

// Чек-лист заполненности карточки (как в старом фронте). Реактивен на правку формы.
const checklist = computed(() => {
  const f = form.value
  const pain = String(f.pain_quote || '').trim()
  return [
    { label: 'Тип заведения + точки', done: !!f.type && !!f.points },
    { label: 'Стадия', done: !!f.stage },
    { label: 'Что используют сейчас', done: !!f.current_system },
    { label: 'Причина смены (дословно)', done: pain.length > 10 },
    { label: 'Потребности отмечены', done: (f.needs?.length || 0) > 0 },
    { label: 'Температура', done: !!f.temperature },
    { label: 'ЛПР', done: !!(f.contacts?.some(c => c.is_dm) || f.contact_name) },
    { label: 'Оборот точки', done: !!f.revenue },
    { label: 'Тариф предложен', done: !!f.plan },
    { label: 'Оборудование', done: !!f.hardware },
    { label: 'Статус сделки', done: !!deal.value?.status },
    { label: 'Следующий шаг + дата', done: !!f.next_step && !!f.next_date },
  ]
})
const checklistDone = computed(() => checklist.value.filter(i => i.done).length)

// Запись сделки = GET существующей + merge + PUT (полная замена).
// PATCH в PHP-CRUD-API падает с "Invalid parameter number" (PDOException -> 500),
// поэтому правку карточки и смену статуса пишем через PUT, как в старом фронте.
async function putDeal(partial) {
  const existing = await db.get('deals', localId.value)
  const merged = { ...existing, ...partial }
  delete merged.id
  return db.replace('deals', localId.value, merged)
}

async function saveEdit() {
  if (!form.value.client_name?.trim()) { alert('Название обязательно'); return }
  saving.value = true; error.value = ''
  try {
    const p = { ...form.value }
    p.points = numOrNull(form.value.points); p.revenue = numOrNull(form.value.revenue)
    p.next_date = fromLocal(form.value.next_date); p.open_date = form.value.open_date || null
    p.needs = JSON.stringify(form.value.needs || [])
    p.contacts = JSON.stringify((form.value.contacts || []).filter(c => c.name || c.phone || c.email))
    p.updated_at = nowMysql()
    if (!localId.value) {
      // создание новой сделки: статус по умолчанию + дата создания, POST
      p.status = props.createStatus
      p.created_at = nowMysql()
      p.seller_id = currentUserId()
      const created = await db.create('deals', p)
      // tqdev обычно возвращает новый id числом; подстрахуемся от объекта/строки/пустого ответа
      let newId = (created && typeof created === 'object') ? created.id : created
      if (newId === '' || newId === undefined || newId === 'null') newId = null
      if (!newId) {
        // сервер не вернул id (пустое тело) — берём самую свежую сделку
        try { const recent = await db.list('deals', { order: 'id,desc', size: 1 }); newId = (recent && recent[0]) ? recent[0].id : null } catch (_) {}
      }
      if (!newId) {
        // id так и не получили — сделка создана, обновим список и закроем
        emit('saved'); emit('close'); return
      }
      localId.value = newId
      await load(); await loadActivity()
    } else {
      await putDeal(p)
      await load()
    }
    mode.value = 'view'; emit('saved')
  } catch (e) { error.value = e.message } finally { saving.value = false }
}

// ---- новое касание ----
function startTouch() {
  touch.value = {
    type: 'call', summary: '',
    status: deal.value.status || ALL_STATUSES[0],
    temperature: deal.value.temperature || '',
    next_step: deal.value.next_step || '',
    next_date: toLocal(deal.value.next_date),
    pain_quote: '',
  }
  mode.value = 'touch'
}
function quick(mins, days) {
  const d = new Date()
  if (days) d.setDate(d.getDate() + days)
  if (mins) d.setMinutes(d.getMinutes() + mins)
  const p = n => String(n).padStart(2, '0')
  const v = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  // пишем в то поле, что сейчас редактируется: касание или правка карточки
  if (mode.value === 'edit') form.value.next_date = v
  else touch.value.next_date = v
}

async function saveTouch() {
  saving.value = true; error.value = ''
  try {
    const stamp = nowMysql()
    const nd = fromLocal(touch.value.next_date)
    // 1) обновить сделку
    await putDeal({
      status: touch.value.status, temperature: touch.value.temperature || null,
      next_step: touch.value.next_step, next_date: nd, updated_at: stamp,
    })
    // 2) создать запись касания
    const created = await db.create('activity', {
      deal_id: localId.value, created_at: stamp, seller_id: currentUserId() || deal.value.seller_id || null,
      type: touch.value.type, summary: touch.value.summary || '',
      status_after: touch.value.status, temperature_after: touch.value.temperature || '',
      next_step: touch.value.next_step || '', next_date: nd,
    })
    const activityId = (created && typeof created === 'object') ? created.id : created
    // 3) цитата боли — если ввели новую
    const painText = String(touch.value.pain_quote || '').trim()
    if (painText.length > 5) {
      await db.create('pain_quotes', {
        deal_id: localId.value, activity_id: activityId, client_name: deal.value.client_name || '',
        venue_type: deal.value.type || '', current_system: deal.value.current_system || '',
        quote: painText, created_at: stamp,
      })
    }
    mode.value = 'view'; await load(); await loadActivity(); emit('saved')
  } catch (e) { error.value = e.message } finally { saving.value = false }
}

function val(key) { const v = deal.value?.[key]; return (v === null || v === undefined || v === '') ? '—' : v }

// Форма создания/редактирования КП
const proposalsRef = ref(null)
const proposalForm = ref({ open: false, id: null })
function openProposalForm(proposalId) { proposalForm.value = { open: true, id: proposalId } }
async function onProposalSaved() {
  proposalForm.value.open = false
  await load()                          // статус сделки мог измениться (→ «КП отправлено»)
  await loadActivity()                  // отправка КП добавляет запись в историю
  proposalsRef.value?.reload()          // обновить список КП
}

function onBackdrop() { if (mode.value === 'view' && !proposalForm.value.open) emit('close') }
function onEsc(e) {
  if (e.key === 'Escape' && mode.value === 'view' && !proposalForm.value.open) emit('close')
  // секретная комбинация: Ctrl+Shift+Backspace — показать кнопку «Удалить»
  if (e.ctrlKey && e.shiftKey && (e.code === 'Backspace' || e.key === 'Backspace')) {
    e.preventDefault(); showDelete.value = true
  }
}
onMounted(() => {
  if (props.create) startNew()
  else { load(); loadActivity() }
  window.addEventListener('keydown', onEsc)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onEsc))
</script>

<template>
  <div class="overlay" @click.self="onBackdrop">
    <div class="modal">
      <div class="modal-head">
        <h2>{{ deal?.client_name || (props.create && !localId ? 'Новая сделка' : 'Сделка') }}</h2>
        <div class="badges">
          <span v-if="deal" class="status">{{ deal.status || '—' }}</span>
          <span v-if="deal && TEMP[deal.temperature]" class="temp" :class="TEMP[deal.temperature].cls">{{ TEMP[deal.temperature].label }}</span>
          <button class="x" @click="emit('close')">×</button>
        </div>
      </div>

      <div class="modal-body">
        <p v-if="loading" class="muted">Загрузка…</p>
        <p v-else-if="error" class="err">Ошибка: {{ error }}</p>

        <!-- ===== ПРОСМОТР ===== -->
        <template v-else-if="mode === 'view'">
          <div class="card">
            <div class="card-title">Клиент</div>
            <div class="field"><span class="lbl">Компания</span>{{ val('company_name') }}</div>
            <div class="field"><span class="lbl">ИНН</span>{{ val('inn') }}</div>
            <div class="field"><span class="lbl">Телефон</span>{{ val('phone') }}</div>
            <div class="field"><span class="lbl">Email</span>{{ val('email') }}</div>
            <div class="field"><span class="lbl">Контакт</span>{{ val('contact_name') }}{{ deal.contact_role ? ` · ${deal.contact_role}` : '' }}</div>
          </div>
          <div class="card">
            <div class="card-title">Сделка</div>
            <div class="field"><span class="lbl">Тип</span>{{ val('type') }}</div>
            <div class="field"><span class="lbl">Точек</span>{{ val('points') }}</div>
            <div class="field"><span class="lbl">Выручка, ₽/мес</span>{{ val('revenue') }}</div>
            <div class="field"><span class="lbl">Текущая система</span>{{ val('current_system') }}</div>
            <div class="field"><span class="lbl">Продавец</span>{{ userName(deal.seller_id) || '—' }}</div>
            <div class="field"><span class="lbl">Потребности</span>{{ parseJsonArray(deal.needs).join(', ') || '—' }}</div>
          </div>
          <div class="card">
            <div class="card-title">Следующий шаг</div>
            <div class="field"><span class="lbl">Шаг</span>{{ val('next_step') }}</div>
            <div class="field"><span class="lbl">Дата</span>{{ fmtDate(deal.next_date) }}</div>
          </div>

          <!-- коммерческие предложения -->
          <ProposalsBlock v-if="localId && localId !== 'null'" ref="proposalsRef" :deal-id="localId" :deal="deal" @open-form="openProposalForm" />

          <!-- история касаний -->
          <div class="card">
            <div class="card-title">История касаний</div>
            <div v-if="activity.length === 0" class="muted">Касаний пока нет.</div>
            <div v-for="a in activity" :key="a.id" class="act">
              <div class="act-line">
                <span class="dot"></span>
                <strong>{{ ACTIVITY_LABEL[a.type] || a.type }}</strong>
                <span class="muted">· {{ fmtDate(a.created_at) }}</span>
                <span v-if="userName(a.seller_id)" class="muted">· {{ userName(a.seller_id) }}</span>
                <span v-if="a.status_after" class="muted">· → {{ a.status_after }}</span>
              </div>
              <div v-if="a.summary" class="act-sum">{{ a.summary }}</div>
            </div>
          </div>
        </template>

        <!-- ===== НОВОЕ КАСАНИЕ ===== -->
        <template v-else-if="mode === 'touch'">
          <div class="banner">Касание добавится в историю, статус и следующий шаг сделки обновятся.</div>
          <div class="card">
            <div class="grid">
              <label>Тип касания<select v-model="touch.type"><option v-for="t in ACTIVITY_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option></select></label>
              <label>Новый статус<select v-model="touch.status"><option v-for="s in ALL_STATUSES" :key="s">{{ s }}</option></select></label>
              <label>Температура<select v-model="touch.temperature"><option value="">—</option><option v-for="t in TEMPS" :key="t.value" :value="t.value">{{ t.label }}</option></select></label>
            </div>
            <label class="block">Резюме (что обсудили, итог)<textarea v-model="touch.summary" rows="2" placeholder="Перезвонил, готов на демо. Просит терминал ВТБ."></textarea></label>
            <label class="block">Новая цитата боли (необязательно — добавится в Pain Quotes)<textarea v-model="touch.pain_quote" rows="2"></textarea></label>
            <div class="grid">
              <label>Следующий шаг — что<input v-model="touch.next_step" /></label>
              <label>Когда<input type="datetime-local" v-model="touch.next_date" /></label>
            </div>
            <div class="quick">
              <button type="button" class="mini" @click="quick(15)">+15 мин</button>
              <button type="button" class="mini" @click="quick(30)">+30 мин</button>
              <button type="button" class="mini" @click="quick(60)">+1 час</button>
              <button type="button" class="mini" @click="quick(120)">+2 часа</button>
              <button type="button" class="mini" @click="quick(0, 1)">Завтра</button>
              <button type="button" class="mini" @click="quick(0, 7)">Через неделю</button>
            </div>
          </div>
        </template>

        <!-- ===== ПРАВКА ===== -->
        <template v-else>
          <div class="card">
            <div class="card-title">Клиент</div>
            <div class="grid">
              <label>Название *<input v-model="form.client_name" /></label>
              <label>Телефон<input v-model="form.phone" /></label>
              <label>Компания<input v-model="form.company_name" /></label>
              <label>ИНН
                <div class="inn-row">
                  <input v-model="form.inn" inputmode="numeric" />
                  <button type="button" class="mini" :disabled="innLoading" @click="fillByInn">{{ innLoading ? '…' : 'Заполнить' }}</button>
                </div>
              </label>
              <label>Email<input v-model="form.email" /></label>
              <label>Контактное лицо<input v-model="form.contact_name" /></label>
              <label>Должность ЛПР<select v-model="form.contact_role"><option value="">—</option><option v-for="r in ROLES" :key="r">{{ r }}</option></select></label>
            </div>
            <div class="sub-head"><span>Дополнительные контакты</span><button type="button" class="mini" @click="addContact">+ Добавить контакт</button></div>
            <div v-for="(c, i) in form.contacts" :key="i" class="contact-row">
              <input v-model="c.name" placeholder="Имя Фамилия" />
              <select v-model="c.role"><option value="">—</option><option v-for="r in ROLES" :key="r">{{ r }}</option></select>
              <input v-model="c.phone" placeholder="Телефон" />
              <input v-model="c.email" placeholder="Email" />
              <label class="dm"><input type="checkbox" v-model="c.is_dm" /> ЛПР</label>
              <button type="button" class="x small" @click="removeContact(i)">×</button>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Сделка</div>
            <div class="grid">
              <label>Тип<select v-model="form.type"><option value="">—</option><option v-for="t in TYPES" :key="t">{{ t }}</option></select></label>
              <label>Количество точек<input type="number" v-model="form.points" /></label>
              <label>Стадия<select v-model="form.stage"><option value="">—</option><option v-for="s in STAGES" :key="s">{{ s }}</option></select></label>
              <label>Дата открытия<input type="date" v-model="form.open_date" /></label>
              <label>Источник<select v-model="form.source"><option value="">—</option><option v-for="s in SOURCES" :key="s">{{ s }}</option></select></label>
              <label>Текущая система<input v-model="form.current_system" list="cur-sys" /><datalist id="cur-sys"><option v-for="c in CURRENT_SYSTEMS" :key="c" :value="c"></option></datalist></label>
              <label>Температура<select v-model="form.temperature"><option value="">—</option><option v-for="t in TEMPS" :key="t.value" :value="t.value">{{ t.label }}</option></select></label>
              <label>Оборот, ₽/мес<input type="number" v-model="form.revenue" /></label>
              <label>Тариф<select v-model="form.plan"><option value="">—</option><option v-for="p in PLANS" :key="p">{{ p }}</option></select></label>
              <label>Оборудование<select v-model="form.hardware"><option value="">—</option><option v-for="h in HARDWARE" :key="h">{{ h }}</option></select></label>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Боль и потребности</div>
            <label class="block">Цитата боли<textarea v-model="form.pain_quote" rows="3"></textarea></label>
            <div class="sub-head"><span>Ключевые потребности</span></div>
            <div class="needs-grid">
              <button type="button" v-for="n in NEEDS" :key="n" class="need-chip" :class="{ on: form.needs.includes(n) }" @click="toggleNeed(n)">{{ n }}</button>
            </div>
            <label class="block">Дополнительно текстом<textarea v-model="form.needs_text" rows="2"></textarea></label>
          </div>
          <div class="card">
            <div class="card-title">Следующий шаг</div>
            <div class="grid">
              <label>Шаг<input v-model="form.next_step" /></label>
              <label>Когда<input type="datetime-local" v-model="form.next_date" />
                <div class="quick">
                  <button type="button" class="mini" @click="quick(15)">+15 мин</button>
                  <button type="button" class="mini" @click="quick(30)">+30 мин</button>
                  <button type="button" class="mini" @click="quick(60)">+1 час</button>
                  <button type="button" class="mini" @click="quick(120)">+2 часа</button>
                  <button type="button" class="mini" @click="quick(0, 1)">Завтра</button>
                  <button type="button" class="mini" @click="quick(0, 7)">Через неделю</button>
                </div>
              </label>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Комментарий</div>
            <label class="block"><textarea v-model="form.comment" rows="3"></textarea></label>
          </div>
          <div class="card">
            <div class="card-title">Заполненность карточки · {{ checklistDone }}/{{ checklist.length }}</div>
            <div class="checklist">
              <div v-for="i in checklist" :key="i.label" class="check-item" :class="{ done: i.done }">
                <span class="icon"></span>{{ i.label }}
              </div>
            </div>
          </div>
        </template>
      </div>

      <div v-if="!loading && !error" class="modal-foot">
        <template v-if="mode === 'view'">
          <button v-if="deal && deal.status === 'Лид'" class="primary" :disabled="saving" @click="acceptLead">🤝 Принять в работу</button>
          <button v-if="deal && deal.status === 'Лид'" @click="startTouch">+ Новое касание</button>
          <button v-else class="primary" @click="startTouch">+ Новое касание</button>
          <button @click="startEdit">Редактировать карточку</button>
          <button v-if="deal && !deal.archived_at" :disabled="saving" @click="archiveDeal">В архив</button>
          <button v-else-if="deal" :disabled="saving" @click="unarchiveDeal">Восстановить из архива</button>
          <span class="foot-spacer"></span>
          <button v-if="showDelete" class="danger" :disabled="saving" @click="deleteDeal">Удалить</button>
        </template>
        <template v-else-if="mode === 'touch'">
          <button class="primary" :disabled="saving" @click="saveTouch">{{ saving ? 'Сохранение…' : 'Сохранить касание' }}</button>
          <button @click="mode = 'view'">Отмена</button>
        </template>
        <template v-else>
          <button class="primary" :disabled="saving" @click="saveEdit">{{ saving ? 'Сохранение…' : (localId ? 'Сохранить' : 'Создать сделку') }}</button>
          <button @click="cancelEdit">Отмена</button>
        </template>
      </div>
    </div>

    <ProposalForm
      v-if="proposalForm.open"
      :deal="deal"
      :proposal-id="proposalForm.id"
      @close="proposalForm.open = false"
      @saved="onProposalSaved"
    />
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 100; overflow-y: auto; }
.modal { background: var(--bg); border-radius: var(--radius-lg); width: 100%; max-width: 880px; display: flex; flex-direction: column; max-height: calc(100vh - 80px); }
.modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 0.5px solid var(--border); }
.modal-head h2 { margin: 0; font-size: 18px; }
.badges { display: flex; gap: 8px; align-items: center; }
.status { font-size: 13px; padding: 2px 10px; border: 0.5px solid var(--border); border-radius: 999px; color: var(--text-secondary); }
.x { border: none; background: none; font-size: 22px; line-height: 1; color: var(--text-tertiary); padding: 0 4px; }
.x:hover { color: var(--text); background: none; }
.x.small { font-size: 18px; }
.modal-body { padding: 16px 20px; overflow-y: auto; }
.modal-foot { display: flex; gap: 8px; padding: 14px 20px; border-top: 0.5px solid var(--border); }
.modal-foot .foot-spacer { flex: 1; }
.modal-foot .danger { color: var(--danger); border-color: var(--danger); }
.modal-foot .danger:hover { background: #fbecea; }
.card { background: var(--bg); border: 0.5px solid var(--border); border-radius: var(--radius); padding: 1rem 1.25rem; margin-bottom: 12px; }
.card-title { font-weight: 600; font-size: 13px; color: var(--text-secondary); margin-bottom: 10px; }
.field { display: flex; gap: 12px; padding: 6px 0; border-bottom: 0.5px solid var(--border); }
.field:last-child { border-bottom: none; }
.lbl { color: var(--text-tertiary); min-width: 160px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.grid label, .block { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-secondary); }
.block { margin-bottom: 10px; }
input, select, textarea { font: inherit; padding: 7px 10px; border: 0.5px solid var(--border); border-radius: var(--radius); background: var(--bg); width: 100%; }
.sub-head { display: flex; align-items: center; justify-content: space-between; margin: 14px 0 8px; font-size: 13px; color: var(--text-secondary); }
.mini { font-size: 12px; padding: 5px 10px; border-radius: var(--radius); }
.contact-row { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.2fr auto auto; gap: 6px; align-items: center; margin-bottom: 6px; }
.contact-row .dm { display: flex; align-items: center; gap: 4px; font-size: 12px; white-space: nowrap; }
.contact-row .dm input { width: auto; }
.needs-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
@media (max-width: 720px) { .needs-grid { grid-template-columns: repeat(2, 1fr); } }
.need-chip { text-align: left; font-size: 12px; padding: 7px 10px; border-radius: 999px; background: var(--bg); border: 0.5px solid var(--border); }
.need-chip.on { background: var(--text); border-color: var(--text); color: var(--bg); font-weight: 500; }
.quick { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.banner { background: var(--cold-bg); color: var(--cold-text); padding: 10px 14px; border-radius: var(--radius); font-size: 13px; margin-bottom: 12px; }
.act { padding: 8px 0; border-bottom: 0.5px solid var(--border); }
.act:last-child { border-bottom: none; }
.act-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text); display: inline-block; }
.act-sum { margin: 4px 0 0 14px; color: var(--text-secondary); font-size: 13px; }
.muted { color: var(--text-tertiary); }
.err { color: var(--danger); }

/* Поле ИНН с кнопкой автозаполнения */
.inn-row { display: flex; gap: 6px; align-items: center; }
.inn-row input { flex: 1; min-width: 0; }
.inn-row .mini { white-space: nowrap; }

/* Кнопки действий в подвале карточки — чёрные, как в старом фронте */
.modal-foot .primary { background: var(--text); color: var(--bg); border-color: var(--text); font-weight: 500; }
.modal-foot .primary:hover { background: #000; border-color: #000; }

/* Чек-лист заполненности */
.checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; font-size: 13px; }
.check-item { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); }
.check-item.done { color: var(--text); }
.check-item .icon { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--text-tertiary, #9a9a93); display: inline-block; flex-shrink: 0; }
.check-item.done .icon { background: var(--success, #1D9E75); border-color: var(--success, #1D9E75); position: relative; }
.check-item.done .icon::after { content: ''; position: absolute; left: 4px; top: 1px; width: 4px; height: 8px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
@media (max-width: 720px) { .checklist { grid-template-columns: 1fr; } }
</style>
