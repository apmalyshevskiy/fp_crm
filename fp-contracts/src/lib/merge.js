// src/lib/merge.js
// Чистая логика. ГЛАВНОЕ: buildBlocks() -> массив блоков договора (единый
// источник истины). Из блоков собираются и HTML (blocksToHtml), и DOCX (lib/docx.js).

import { DEVELOPER, templates } from './templates'

const MONTHS = ['января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря']

export function formatDateLong(iso) {
  if (!iso) return '«___» __________ ____ года'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `«${d}» ${MONTHS[+m - 1]} ${y} года`
}
export function formatDateShort(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

const ONES = ['ноль','один','два','три','четыре','пять','шесть','семь','восемь','девять',
  'десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать',
  'шестнадцать','семнадцать','восемнадцать','девятнадцать']
const TENS = ['', '', 'двадцать','тридцать','сорок','пятьдесят','шестьдесят',
  'семьдесят','восемьдесят','девяносто']
export function numToWords(n) {
  n = Number(n)
  if (!Number.isFinite(n) || n < 0 || n > 99) return String(n)
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10), o = n % 10
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t]
}
export function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s }
export function rateText(n) {
  if (n === '' || n == null) return '____'
  return `${n} (${cap(numToWords(n))})`
}
export function shortName(full) {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  const [last, ...rest] = parts
  const initials = rest.map(w => w[0].toUpperCase() + '.').join('')
  return initials ? `${last} ${initials}` : last
}

export function partnerPreamble(e) {
  if (!e) return '____'
  if (e.form === 'ООО') {
    const name = `Общество с ограниченной ответственностью «${e.legal_name}» (ООО «${e.legal_name}»)`
    const role = e.signer_role || 'директора'
    const basis = e.signer_basis || 'Устава'
    return `${name}, именуемое в дальнейшем «Партнер», в лице ${role} ${e.signer_name_gen || e.signer_name || ''}, действующего на основании ${basis}`
  }
  const short = shortName(e.signer_name || e.legal_name)
  const basis = e.signer_basis || 'свидетельства о государственной регистрации'
  const ogrn = e.ogrn
    ? ` ОГРНИП ${e.ogrn}${e.ogrn_date ? ' от ' + formatDateShort(e.ogrn_date) + ' г.' : ''}`
    : ''
  return `Индивидуальный предприниматель ${e.legal_name} (ИП ${short}), именуемый в дальнейшем «Партнер», ` +
    `в лице ${e.signer_name_gen || e.signer_name || e.legal_name}, действующего на основании ${basis}${ogrn}`
}

function partnerRows(e, partner) {
  const ogrnLabel = e.form === 'ИП' ? 'ОГРНИП' : 'ОГРН'
  return [
    e.form === 'ИП' ? `Индивидуальный предприниматель ${e.legal_name}` : `ООО «${e.legal_name}»`,
    `${ogrnLabel} ${e.ogrn || '—'}`,
    `ИНН ${e.inn || '—'}`,
    `КПП ${e.kpp || '—'}`,
    `Юридический адрес: ${e.legal_address || '—'}`,
    `р/с ${e.bank_account || '—'}`,
    `Банк: ${e.bank_name || '—'}`,
    `к/с ${e.corr_account || '—'}`,
    `БИК ${e.bik || '—'}`,
    `Телефон: ${partner?.phone || '—'}`,
    `E-mail: ${partner?.email || '—'}`,
  ]
}

// ===== ЕДИНЫЙ ИСТОЧНИК: данные -> массив блоков =====
// блоки: {t:'title'|'date'|'h'|'p'|'requisites', ...}
export function buildBlocks(type, { partner, entity, vars = {} }) {
  const t = templates[type]
  if (!t) return []

  const map = {
    developer_preamble: DEVELOPER.preamble,
    partner_preamble: partnerPreamble(entity),
    rate_attract: rateText(vars.rate_attract),
    rate_support: rateText(vars.rate_support),
  }
  let body = t.body
  for (const [k, v] of Object.entries(map)) body = body.split(`{{${k}}}`).join(v)

  const blocks = []
  blocks.push({ t: 'title', text: t.title.split('{{number}}').join(vars.number || '____') })
  blocks.push({ t: 'date', city: DEVELOPER.signing_city, date: formatDateLong(vars.date) })

  for (const line of body.split('\n')) {
    const s = line.trim()
    if (!s) continue
    if (/^\d{1,2}\.\s+[А-ЯЁ]/.test(s) && s === s.toUpperCase()) blocks.push({ t: 'h', text: s })
    else blocks.push({ t: 'p', text: s })
  }

  const parRole = entity?.form === 'ООО' ? (entity.signer_role || 'Директор') : 'Индивидуальный предприниматель'
  const parSign = entity ? shortName(entity.signer_name || entity.legal_name) : '____'
  blocks.push({
    t: 'requisites',
    dev: DEVELOPER.rows,
    par: entity ? partnerRows(entity, partner) : [],
    devRole: DEVELOPER.signer_role,
    devSign: DEVELOPER.signer_short,
    parRole, parSign,
  })
  return blocks
}

// ===== блоки -> HTML (для предпросмотра и печати) =====
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
export function blocksToHtml(blocks) {
  let out = ''
  for (const b of blocks || []) {
    if (b.t === 'title') out += `<h2 class="doc-title">${esc(b.text)}</h2>`
    else if (b.t === 'date') out += `<p class="doc-date">${esc(b.city)}<span class="spacer"></span>${esc(b.date)}</p>`
    else if (b.t === 'h') out += `<h3>${esc(b.text)}</h3>`
    else if (b.t === 'p') out += `<p>${esc(b.text)}</p>`
    else if (b.t === 'requisites') {
      const n = Math.max(b.dev.length, b.par.length)
      let rows = ''
      for (let i = 0; i < n; i++) rows += `<tr><td>${esc(b.dev[i] || '')}</td><td>${esc(b.par[i] || '')}</td></tr>`
      out += `<table class="req"><thead><tr><th>Разработчик</th><th>Партнер</th></tr></thead>` +
        `<tbody>${rows}</tbody><tfoot>` +
        `<tr><td>${esc(b.devRole)}</td><td>${esc(b.parRole)}</td></tr>` +
        `<tr class="sign"><td>____________________ /${esc(b.devSign)}/</td>` +
        `<td>____________________ /${esc(b.parSign)}/</td></tr></tfoot></table>`
    }
  }
  return out
}

// обратная совместимость: данные -> сразу HTML
export function renderContract(type, args) {
  return blocksToHtml(buildBlocks(type, args))
}
