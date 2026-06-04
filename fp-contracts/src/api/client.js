// src/api/client.js
// Тонкая обёртка над PHP-CRUD-API (tqdev). Вся работа с сетью — здесь.
// В компонентах мы НЕ пишем fetch руками, а зовём db.list('partners') и т.п.
//
// Логику авторизации скопируй из crm.html — у тебя там уже работает токен.
// Здесь по умолчанию токен уходит заголовком X-API-Key; если в CRM иначе
// (например ?key=... в URL) — поправь функцию buildHeaders / url ниже.

const BASE = import.meta.env.VITE_API_URL    // напр. https://crm.example.com/api.php

const USER = import.meta.env.VITE_API_USER
const PASS = import.meta.env.VITE_API_PASS

const TOKEN = import.meta.env.VITE_API_TOKEN

function buildHeaders() {
  const h = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  if (TOKEN) h['X-API-Key'] = TOKEN
  return h
}

/*
function buildHeaders() {
  const h = { 'Content-Type': 'application/json' }
  if (USER) h['Authorization'] = 'Basic ' + btoa(`${USER}:${PASS}`)
  return h
}*/
/*
function buildHeaders() {
  const h = { 'Content-Type': 'application/json' }
  if (TOKEN) h['X-API-Key'] = TOKEN          // ← подгони под свой бэкенд
  return h
}
*/

// низкоуровневый запрос: кидает понятную ошибку, парсит JSON
async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: buildHeaders(),
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  // DELETE/POST у tqdev иногда отдают число/строку, а не JSON — подстрахуемся
  const raw = await res.text()
  try { return raw ? JSON.parse(raw) : null } catch { return raw }
}

// генератор строкового id в твоём стиле: p_, e_, c_
export function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

// CRUD-методы. table — 'partners' | 'entities' | 'contracts'
export const db = {
  // список всех записей таблицы -> массив
  async list(table) {
    const data = await request(`/records/${table}`)
    return data?.records ?? []
  },

  // список с фильтром по полю: listWhere('entities', 'partner_id', 'p_123')
  async listWhere(table, field, value) {
    const q = `?filter=${field},eq,${encodeURIComponent(value)}`
    const data = await request(`/records/${table}${q}`)
    return data?.records ?? []
  },

  // одна запись по id
  get(table, id) {
    return request(`/records/${table}/${id}`)
  },

  // создать. row должен содержать id (см. makeId)
  create(table, row) {
    return request(`/records/${table}`, {
      method: 'POST',
      body: JSON.stringify(row),
    })
  },

  // обновить
  update(table, id, row) {
    return request(`/records/${table}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(row),
    })
  },

  // удалить
  remove(table, id) {
    return request(`/records/${table}/${id}`, { method: 'DELETE' })
  },
}
