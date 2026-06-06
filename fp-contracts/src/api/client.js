// src/api/client.js
// Обёртка над PHP-CRUD-API. Путь к API зашит явно, без зависимости от .env:
//   - dev  (npm run dev):  через Vite-прокси -> префикс /api  (прокси срежет его)
//   - prod (npm run build): напрямую на тот же домен -> без префикса
// API отвечает на /records/... (как рабочий crm.html), api.php в пути НЕ нужен.

// import.meta.env.DEV === true только в режиме разработки
const BASE = import.meta.env.DEV ? '/api' : ''

// токен X-API-Key (тот же, что в crm.html)
const TOKEN = 'fpos_x7Kj9mNqR3vL2pWdF8sH-GIx9CIHFXjnw'

function buildHeaders() {
  return { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-API-Key': TOKEN }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: buildHeaders(), ...options })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  const raw = await res.text()
  try { return raw ? JSON.parse(raw) : null } catch { return raw }
}

export const db = {
  async list(table) {
    const data = await request(`/records/${table}`)
    return data?.records ?? []
  },
  async listWhere(table, field, value) {
    const q = `?filter=${field},eq,${encodeURIComponent(value)}`
    const data = await request(`/records/${table}${q}`)
    return data?.records ?? []
  },
  get(table, id) { return request(`/records/${table}/${id}`) },
  create(table, row) { return request(`/records/${table}`, { method: 'POST', body: JSON.stringify(row) }) },
  update(table, id, row) { return request(`/records/${table}/${id}`, { method: 'PUT', body: JSON.stringify(row) }) },
  remove(table, id) { return request(`/records/${table}/${id}`, { method: 'DELETE' }) },
}
