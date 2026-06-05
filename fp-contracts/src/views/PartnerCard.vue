<!-- src/views/PartnerCard.vue — карточка партнёра + юрлица (с правкой и удалением) -->
<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '../api/client'

const route = useRoute()
const router = useRouter()
const id = route.params.id

const partner = ref(null)
const loading = ref(true)
const error = ref('')

function now() { return new Date().toISOString().slice(0, 19).replace('T', ' ') }

// ============ ПАРТНЁР: правка / удаление ============
const showPartnerForm = ref(false)
const pSaving = ref(false)
const pForm = ref({})

function editPartner() {
  pForm.value = {
    name: partner.value.name || '', contact: partner.value.contact || '',
    phone: partner.value.phone || '', email: partner.value.email || '',
    city: partner.value.city || '', comment: partner.value.comment || '',
  }
  showPartnerForm.value = true
}

async function savePartner() {
  if (!pForm.value.name.trim()) return
  pSaving.value = true; error.value = ''
  try {
    await db.update('partners', id, { ...pForm.value, updated_at: now() })
    showPartnerForm.value = false
    partner.value = await db.get('partners', id)
  } catch (e) { error.value = e.message } finally { pSaving.value = false }
}

async function deletePartner() {
  if (!confirm('Удалить партнёра вместе со всеми его юрлицами из вида? Юрлица останутся в базе, но осиротеют.')) return
  try {
    await db.remove('partners', id)
    router.push('/partners')
  } catch (e) { error.value = e.message }
}

// ============ ЮРЛИЦА: список / создание / правка / удаление ============
const entities = ref([])
const showEntForm = ref(false)
const entSaving = ref(false)
const entEditingId = ref(null)   // null = создаём; id = редактируем это юрлицо
const entBlank = () => ({
  legal_name: '', form: 'ИП',
  inn: '', kpp: '', ogrn: '', ogrn_date: '', legal_address: '',
  signer_name: '', signer_name_gen: '', signer_role: '', signer_basis: '',
  bank_name: '', bank_account: '', corr_account: '', bik: '',
})
const entForm = ref(entBlank())

async function loadEntities() {
  entities.value = await db.listWhere('entities', 'partner_id', id)
}

function addEntity() {
  entForm.value = entBlank()
  entEditingId.value = null
  showEntForm.value = true
}

function editEntity(e) {
  // копируем поля в форму; дату приводим к YYYY-MM-DD для <input type=date>
  entForm.value = { ...entBlank(), ...e, ogrn_date: (e.ogrn_date || '').slice(0, 10) }
  entEditingId.value = e.id
  showEntForm.value = true
}

async function saveEntity() {
  if (!entForm.value.legal_name.trim()) return
  entSaving.value = true; error.value = ''
  try {
    const payload = {
      ...entForm.value,
      partner_id: id,
      ogrn_date: entForm.value.ogrn_date || null,
      updated_at: now(),
    }
    if (entEditingId.value) {
      await db.update('entities', entEditingId.value, payload)   // правка
    } else {
      await db.create('entities', { ...payload, created_at: now() })   // создание
    }
    cancelEntity()
    await loadEntities()
  } catch (e) { error.value = e.message } finally { entSaving.value = false }
}

async function deleteEntity(e) {
  if (!confirm(`Удалить юрлицо «${e.legal_name}»?`)) return
  try {
    await db.remove('entities', e.id)
    await loadEntities()
  } catch (err) { error.value = err.message }
}

function cancelEntity() {
  entForm.value = entBlank()
  entEditingId.value = null
  showEntForm.value = false
}

function fullName(e) {
  if (e.form === 'ООО') return `ООО «${e.legal_name}»`
  if (e.form === 'ИП') return `ИП ${e.legal_name}`
  return e.legal_name
}

async function load() {
  loading.value = true; error.value = ''
  try {
    partner.value = await db.get('partners', id)
    await loadEntities()
  } catch (e) { error.value = e.message } finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <section>
    <router-link to="/partners" class="back">← К списку партнёров</router-link>

    <p v-if="loading" class="muted">Загрузка…</p>
    <p v-else-if="error" class="err">Ошибка: {{ error }}</p>

    <template v-else-if="partner">
      <div class="ent-head">
        <h2>{{ partner.name || '(без названия)' }}</h2>
        <div class="actions">
          <button @click="editPartner">Редактировать</button>
          <button class="danger" @click="deletePartner">Удалить</button>
        </div>
      </div>

      <!-- форма правки партнёра -->
      <div v-if="showPartnerForm" class="ent-form">
        <div class="grid">
          <label class="wide">Название *<input v-model="pForm.name" /></label>
          <label>Контактное лицо<input v-model="pForm.contact" /></label>
          <label>Телефон<input v-model="pForm.phone" /></label>
          <label>Email<input v-model="pForm.email" /></label>
          <label>Город<input v-model="pForm.city" /></label>
          <label class="wide">Комментарий<input v-model="pForm.comment" /></label>
        </div>
        <div class="row-btns">
          <button class="primary" :disabled="pSaving" @click="savePartner">
            {{ pSaving ? 'Сохранение…' : 'Сохранить' }}
          </button>
          <button @click="showPartnerForm = false">Отмена</button>
        </div>
      </div>

      <div v-else class="card">
        <div class="field"><span class="lbl">Контактное лицо</span>{{ partner.contact || '—' }}</div>
        <div class="field"><span class="lbl">Телефон</span>{{ partner.phone || '—' }}</div>
        <div class="field"><span class="lbl">Email</span>{{ partner.email || '—' }}</div>
        <div class="field"><span class="lbl">Город</span>{{ partner.city || '—' }}</div>
        <div class="field"><span class="lbl">Комментарий</span>{{ partner.comment || '—' }}</div>
      </div>

      <!-- ЮРЛИЦА -->
      <div class="ent-head">
        <h3>Юрлица</h3>
        <button class="primary" @click="showEntForm ? cancelEntity() : addEntity()">
          {{ showEntForm ? 'Отмена' : '+ Добавить юрлицо' }}
        </button>
      </div>

      <div v-if="showEntForm" class="ent-form">
        <div class="group">{{ entEditingId ? 'Редактирование юрлица' : 'Новое юрлицо' }} · Основное</div>
        <div class="grid">
          <label>Наименование (без ИП/ООО) *
            <input v-model="entForm.legal_name" placeholder="Басенко Максим Дмитриевич / ФЬЮЖН СОФТ" />
          </label>
          <label>Форма
            <select v-model="entForm.form">
              <option value="ИП">ИП</option>
              <option value="ООО">ООО</option>
            </select>
          </label>
        </div>

        <div class="group">Реквизиты</div>
        <div class="grid">
          <label>ИНН<input v-model="entForm.inn" /></label>
          <label>КПП (у ИП нет)<input v-model="entForm.kpp" /></label>
          <label>ОГРН / ОГРНИП<input v-model="entForm.ogrn" /></label>
          <label>Дата регистрации<input type="date" v-model="entForm.ogrn_date" /></label>
          <label class="wide">Юридический адрес<input v-model="entForm.legal_address" /></label>
        </div>

        <div class="group">Подписант</div>
        <div class="grid">
          <label>ФИО (именительный)<input v-model="entForm.signer_name" placeholder="Басенко Максим Дмитриевич" /></label>
          <label>ФИО (родительный, «в лице…»)<input v-model="entForm.signer_name_gen" placeholder="Басенко Максима Дмитриевича" /></label>
          <label>Должность (для ООО)<input v-model="entForm.signer_role" placeholder="Генеральный директор" /></label>
          <label>Действует на основании
            <select v-model="entForm.signer_basis">
              <option value="">—</option>
              <option value="Устава">Устава</option>
              <option value="свидетельства о государственной регистрации">свидетельства о гос. регистрации</option>
            </select>
          </label>
        </div>

        <div class="group">Банк</div>
        <div class="grid">
          <label class="wide">Банк<input v-model="entForm.bank_name" placeholder="ООО «Банк Точка»" /></label>
          <label>Расчётный счёт<input v-model="entForm.bank_account" /></label>
          <label>Корр. счёт<input v-model="entForm.corr_account" /></label>
          <label>БИК<input v-model="entForm.bik" /></label>
        </div>

        <button class="primary save" :disabled="entSaving" @click="saveEntity">
          {{ entSaving ? 'Сохранение…' : (entEditingId ? 'Сохранить изменения' : 'Сохранить юрлицо') }}
        </button>
      </div>

      <p v-if="entities.length === 0 && !showEntForm" class="muted">Юрлиц пока нет.</p>

      <ul class="ent-list">
        <li v-for="e in entities" :key="e.id">
          <div class="ent-top">
            <strong>{{ fullName(e) }}</strong>
            <div class="actions">
              <button @click="editEntity(e)">Изменить</button>
              <button class="danger" @click="deleteEntity(e)">Удалить</button>
            </div>
          </div>
          <div class="ent-req muted">
            ИНН {{ e.inn || '—' }} · ОГРН {{ e.ogrn || '—' }} · {{ e.bank_name || 'банк —' }} · р/с {{ e.bank_account || '—' }}
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.back { display: inline-block; margin-bottom: 16px; color: var(--text-secondary); text-decoration: none; }
.back:hover { color: var(--text-primary); }
.card { border: 1px solid var(--border); border-radius: 8px; padding: 4px 16px; }
.field { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.field:last-child { border-bottom: none; }
.lbl { color: var(--text-tertiary); min-width: 140px; }

.ent-head { display: flex; align-items: center; justify-content: space-between; margin-top: 28px; }
.ent-head:first-of-type { margin-top: 0; }
.actions { display: flex; gap: 8px; }
.row-btns { display: flex; gap: 8px; margin-top: 14px; }
button.danger { color: var(--danger); border-color: var(--danger); background: var(--bg); }
button.danger:hover { background: #fbecea; }

.ent-form { border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin: 12px 0; }
.group { font-weight: 600; font-size: 13px; color: var(--text-secondary); margin: 14px 0 6px; }
.group:first-child { margin-top: 0; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.grid label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-secondary); }
.grid label.wide { grid-column: 1 / -1; }
.save { margin-top: 16px; }

.ent-list { list-style: none; padding: 0; margin-top: 8px; }
.ent-list li { padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; }
.ent-top { display: flex; align-items: center; justify-content: space-between; }
.ent-req { margin-top: 4px; font-size: 13px; }
.muted { color: var(--text-tertiary); }
.err { color: var(--danger); }
</style>
