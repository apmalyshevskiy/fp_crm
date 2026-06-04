<!-- src/views/PartnersView.vue -->
<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../api/client'

const partners = ref([])
const loading = ref(true)
const error = ref('')

// --- форма ---
const showForm = ref(false)
const saving = ref(false)
const blank = () => ({ name: '', contact: '', phone: '', email: '', city: '', comment: '' })
const form = ref(blank())

async function load() {
  loading.value = true
  error.value = ''
  try {
    partners.value = await db.list('partners')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!form.value.name.trim()) return
  saving.value = true
  error.value = ''
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    // id НЕ передаём — база назначит сама (AUTO_INCREMENT)
    await db.create('partners', {
      ...form.value,
      created_at: now,
      updated_at: now,
    })
    form.value = blank()
    showForm.value = false
    await load()
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

function cancel() {
  form.value = blank()
  showForm.value = false
}

onMounted(load)
</script>

<template>
  <section>
    <div class="head">
      <h2>Партнёры</h2>
      <button class="primary" @click="showForm ? cancel() : (showForm = true)">
        {{ showForm ? 'Отмена' : '+ Добавить партнёра' }}
      </button>
    </div>

    <div v-if="showForm" class="form">
      <input v-model="form.name"    placeholder="Название партнёра *" @keyup.enter="save" />
      <input v-model="form.contact" placeholder="Контактное лицо" />
      <input v-model="form.phone"   placeholder="Телефон" />
      <input v-model="form.email"   placeholder="Email" />
      <input v-model="form.city"    placeholder="Город" />
      <textarea v-model="form.comment" placeholder="Комментарий" rows="2"></textarea>
      <button class="primary" :disabled="saving" @click="save">
        {{ saving ? 'Сохранение…' : 'Сохранить' }}
      </button>
    </div>

    <p v-if="loading" class="muted">Загрузка…</p>
    <p v-else-if="error" class="err">Ошибка: {{ error }}</p>
    <p v-else-if="partners.length === 0" class="muted">Партнёров пока нет.</p>

    <ul v-else class="list">
      <li v-for="p in partners" :key="p.id">
        <strong>{{ p.name || '(без названия)' }}</strong>
        <span class="muted">· {{ p.city || '—' }} · {{ p.contact || '—' }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; }
.form {
  display: flex; flex-direction: column; gap: 8px;
  margin: 16px 0; padding: 16px;
  border: 1px solid var(--border); border-radius: 8px;
}
.muted { color: var(--text-tertiary); }
.err { color: var(--danger); }
.list { list-style: none; padding: 0; }
.list li { padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; }
</style>
