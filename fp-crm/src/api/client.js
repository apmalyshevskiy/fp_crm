// src/api/client.js
// Обёртка над PHP-CRUD-API (тот же сервер, что у договоров и старой CRM).
//   dev  (npm run dev):  через прокси -> /api  (Vite срежет префикс)
//   prod (npm run build): напрямую на тот же домен
// API отвечает на /records/... (как fp_crm.html); авторизация — X-API-Key.

const BASE = import.meta.env.DEV ? '/api' : ''
const TOKEN = 'fpos_x7Kj9mNqR3vL2pWdF8sH-GIx9CIHFXjnw'

function headers() {
  return { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-API-Key': TOKEN }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), ...options })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${t || res.statusText}`)
  }
  const raw = await res.text()
  try { return raw ? JSON.parse(raw) : null } catch { return raw }
}

export const db = {
  // list('deals', { size: 1000, order: 'updated_at,desc', filter: 'status,eq,Лид' })
  async list(table, params = {}) {
    const q = new URLSearchParams()
    if (params.size) q.set('size', params.size)
    if (params.order) q.set('order', params.order)
    if (params.filter) q.set('filter', params.filter)
    const qs = q.toString() ? `?${q.toString()}` : ''
    const data = await request(`/records/${table}${qs}`)
    return data?.records ?? []
  },
  get(table, id) { return request(`/records/${table}/${id}`) },
  create(table, row) { return request(`/records/${table}`, { method: 'POST', body: JSON.stringify(row) }) },
  update(table, id, row) { return request(`/records/${table}/${id}`, { method: 'PATCH', body: JSON.stringify(row) }) },
  // PUT — полная замена записи. Для deals используем его вместо PATCH:
  // PHP-CRUD-API падает на PATCH с малым числом полей ("Invalid parameter number" -> PDOException 500).
  replace(table, id, row) { return request(`/records/${table}/${id}`, { method: 'PUT', body: JSON.stringify(row) }) },
  remove(table, id) { return request(`/records/${table}/${id}`, { method: 'DELETE' }) },
}
