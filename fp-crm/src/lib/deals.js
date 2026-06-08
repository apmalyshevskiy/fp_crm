// src/lib/deals.js
// Чистые помощники по сделкам (перенесено из fp_crm.html). Без Vue.

export const FUNNEL_STATUSES = [
  'Первичный контакт', 'Не дозвон', 'Демо назначено', 'Демо проведено',
  'КП отправлено', 'Счёт выставлен', 'Оплачено',
]
export const SIDE_STATUSES = ['Отказ', 'Не сейчас']
export const LEAD_STATUS = 'Лид'

export function isArchived(d) { return !!d.archived_at }
export function isLead(d) { return d.status === LEAD_STATUS }
export function isDeal(d) { return !isArchived(d) && !isLead(d) }

export function isOverdue(d) {
  return !!d.next_date &&
    new Date(d.next_date) < new Date() &&
    d.status !== 'Оплачено' && d.status !== 'Отказ'
}

const MONTHS = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек']
export function fmtDate(s) {
  if (!s) return '—'
  const dt = new Date(String(s).replace(' ', 'T'))
  if (isNaN(dt)) return '—'
  let out = `${dt.getDate()} ${MONTHS[dt.getMonth()]}`
  if (/\d{2}:\d{2}/.test(String(s))) out += ` ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
  return out
}
export function fmtDateShort(s) {
  if (!s) return ''
  const dt = new Date(String(s).replace(' ', 'T'))
  if (isNaN(dt)) return ''
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`
}

export const TEMP = {
  hot:  { label: '🔥 Горячий', cls: 'hot' },
  warm: { label: 'Тёплый',     cls: 'warm' },
  cold: { label: 'Холодный',   cls: 'cold' },
}

// поиск по сделке (как в старой CRM)
function digits(s) { return String(s || '').replace(/\D/g, '') }
export function dealMatches(d, q) {
  if (!q) return true
  const ql = q.toLowerCase()
  const hay = [d.client_name, d.company_name, d.inn, d.contact_name, d.email, d.current_system, d.phone, d.comment]
    .map(x => String(x || '').toLowerCase()).join(' \u0001 ')
  if (hay.includes(ql)) return true
  const qd = digits(q)
  if (qd.length >= 3 && digits(d.phone).includes(qd)) return true
  return false
}

// ===== справочники для форм (перенесено из fp_crm.html) =====
export const TYPES = [
  'Кофейня','Пекарня','Кондитерская','Кафе','Ресторан','Пиццерия','Суши / роллы','Бар','Спортбар',
  'Караоке / ночной клуб','Кальянная','Столовая','Фаст-фуд','Доставка еды','Фудтрак','Гостиница / отель',
  'Магазин (продуктовый)','Фрукты / овощи','Пивной магазин','Винотека','Табачный магазин','Аптека',
  'Цветочный магазин','Услуги','Другое',
]
export const STAGES = ['Открывается','Работает','Только думает открывать']
export const SOURCES = ['Регистрация','Сайт','Выставка','Рекомендация','Холодный звонок','Реклама','Другое']
export const ROLES = ['Владелец','Управляющий','Бухгалтер','Администратор','IT','Другое']
export const PLANS = ['Всё включено (0,5%)','Стандарт (2 190 ₽)','Не обсуждали']
export const HARDWARE = ['Не нужно (есть своё)','Комплект «Старт» (~70К)','Комплект «Профи» (~150К)','Под уточнение']
export const CURRENT_SYSTEMS = [
  'С нуля','Эвотор / Атол / касса от банка','МойСклад','Контур Маркет','СБИС Presto (Saby Presto)','1С',
  'iiko','R-Keeper','Quick Resto','Tillypad','Restik','Мой кассир','YUMA','Не знают (бухгалтер)','Другое',
]
export const TEMPS = [
  { value: 'hot', label: 'Горячий' }, { value: 'warm', label: 'Тёплый' }, { value: 'cold', label: 'Холодный' },
]

// чипы потребностей (значения хранятся в поле needs как JSON-массив строк)
export const NEEDS = [
  'Касса/ФЗ-54','Склад','Доставка','Аналитика','ЕГАИС','Честный знак','Лояльность','Экраны кухни',
  'План зала','1С','Приложение руководителя','Приложение официанта','КСО','Свой сайт','Яндекс Еда',
  'Управленческий учёт','Бронирование','Предоплата','Telegram-бот','Чаевые','Финансовый модуль',
]

// JSON-массив из строки/массива (для needs и contacts)
export function parseJsonArray(raw) {
  if (Array.isArray(raw)) return raw
  if (!raw) return []
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : [] }
  catch { return String(raw).split(',').map(s => s.trim()).filter(Boolean) }
}

// все статусы для смены через касание (лид + воронка + боковые)
export const ALL_STATUSES = [LEAD_STATUS, ...FUNNEL_STATUSES, ...SIDE_STATUSES]

// типы касаний (activity.type)
export const ACTIVITY_TYPES = [
  { value: 'call', label: 'Звонок' }, { value: 'meeting', label: 'Встреча' },
  { value: 'demo', label: 'Демо' }, { value: 'proposal', label: 'Отправка КП' },
  { value: 'invoice', label: 'Выставлен счёт' }, { value: 'note', label: 'Заметка' },
]
export const ACTIVITY_LABEL = Object.fromEntries(ACTIVITY_TYPES.map(t => [t.value, t.label]))

// дней с последнего касания (по updated_at, иначе created_at)
export function daysSinceTouch(d) {
  const t = d.updated_at || d.created_at
  if (!t) return null
  const ms = Date.now() - new Date(String(t).replace(' ', 'T')).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}
// лид без касаний: created_at ≈ updated_at (никто не трогал)
export function isFreshLead(d) {
  if (!d.created_at || !d.updated_at) return true
  return Math.abs(new Date(String(d.updated_at).replace(' ','T')) - new Date(String(d.created_at).replace(' ','T'))) < 60000
}
