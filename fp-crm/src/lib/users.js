// src/lib/users.js
// Кто сейчас залогинен (Basic Auth → /whoami) и словарь пользователей для имён по seller_id.
// Не зависит от client.js (у него свой набор методов), поэтому делаем запрос напрямую.
import { reactive } from 'vue'

const BASE = import.meta.env.DEV ? '/api' : ''
const TOKEN = 'fpos_x7Kj9mNqR3vL2pWdF8sH-GIx9CIHFXjnw'

async function req(path) {
  const r = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json', 'X-API-Key': TOKEN } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

export const userStore = reactive({ currentUser: null, usersById: {}, ready: false })

// имя продавца по seller_id (для карточек, истории, КП)
export function userName(sellerId) {
  if (!sellerId) return ''
  const u = userStore.usersById[sellerId]
  return u ? (u.full_name || u.login) : '—'
}
export function currentUserId() { return userStore.currentUser ? userStore.currentUser.id : null }

let inited = false
export async function initUsers() {
  if (inited) return
  inited = true
  try {
    const resp = await req('/records/users?filter=is_active,eq,1&size=200')
    const users = (resp && resp.records) || []
    const map = {}
    users.forEach(u => { map[u.id] = u })
    userStore.usersById = map
    // кто я: /whoami возвращает Basic-логин; сопоставляем с users
    try {
      const who = await req('/whoami')
      const login = who && who.login
      if (login) userStore.currentUser = users.find(u => u.login === login) || { id: null, login, full_name: login }
    } catch (_) { /* whoami недоступен — имена продавцов по seller_id всё равно работают */ }
  } catch (_) { /* нет таблицы users — не критично */ }
  userStore.ready = true
}
