// src/lib/inn/egrul.js
// Провайдер данных по ИНН на базе egrul.org.
// Контракт: { id, name, async lookup(inn) -> нормализованные поля юрлица }.
// Банковские реквизиты ЕГРЮЛ не содержит — их вводят руками.

const BASE = import.meta.env.DEV ? '/egrul' : 'https://egrul.org'

function titleCase(s) {
  return String(s || '').toLowerCase().replace(/(^|[\s-])([а-яёa-z])/g, (_, p, c) => p + c.toUpperCase())
}
function sentenceCase(s) {
  const t = String(s || '').toLowerCase().trim()
  return t ? t[0].toUpperCase() + t.slice(1) : t
}
function attrs(o) { return o?.['@attributes'] || {} }
function clean(o) {
  const r = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') r[k] = v
  return r
}

// адрес: сначала из АдресРФ, иначе из ФИАС-блока
function buildAddress(get) {
  const ar = get('АдресРФ')
  if (ar) {
    const a = attrs(ar)
    return [
      a.Индекс,
      attrs(ar.Регион).НаимРегион,
      [attrs(ar.Город).ТипГород, attrs(ar.Город).НаимГород].filter(Boolean).join(' '),
      [attrs(ar.Улица).ТипУлица, attrs(ar.Улица).НаимУлица].filter(Boolean).join(' '),
      a.Дом, a.Кварт,
    ].filter(Boolean).join(', ')
  }
  const fa = get('СвАдресЮЛ')?.СвАдрЮЛФИАС
  if (fa) {
    const a = attrs(fa)
    return [
      a.Индекс,
      fa.НаимРегион,
      [attrs(fa.НаселенПункт).Вид, attrs(fa.НаселенПункт).Наим].filter(Boolean).join(' '),
      [attrs(fa.ЭлУлДорСети).Тип, attrs(fa.ЭлУлДорСети).Наим].filter(Boolean).join(' '),
      [attrs(fa.Здание).Тип, attrs(fa.Здание).Номер].filter(Boolean).join(' '),
      [attrs(fa.ПомещЗдания).Тип, attrs(fa.ПомещЗдания).Номер].filter(Boolean).join(' '),
    ].filter(Boolean).join(', ')
  }
  return ''
}

function map(raw) {
  // --- Юридическое лицо ---
  const yul = raw?.СвЮЛ
  if (yul) {
    // блок может лежать и внутри СвЮЛ, и на верхнем уровне — ищем в обоих
    const get = (k) => yul[k] ?? raw[k]
    const a = attrs(yul)
    const short = attrs(get('СвНаимЮЛ')?.СвНаимЮЛСокр).НаимСокр || ''
    const m = short.match(/"([^"]+)"/)
    const legal_name = m ? m[1] : short
    const dir = attrs(get('СведДолжнФЛ')?.СвФЛ)
    const post = attrs(get('СведДолжнФЛ')?.СвДолжн).НаимДолжн || ''
    const fio = [dir.Фамилия, dir.Имя, dir.Отчество].filter(Boolean).map(titleCase).join(' ')

    return clean({
      form: 'ООО',
      legal_name,
      inn: a.ИНН,
      kpp: a.КПП,
      ogrn: a.ОГРН,
      ogrn_date: a.ДатаОГРН,
      legal_address: buildAddress(get),
      signer_name: fio,
      signer_role: sentenceCase(post),
      signer_basis: 'Устава',
    })
  }

  // --- Индивидуальный предприниматель (ЕГРИП) ---
  const ip = raw?.СвИП
  if (ip) {
    const get = (k) => ip[k] ?? raw[k]
    const a = attrs(ip)
    const f = attrs(get('СвФЛ')?.ФИОРус)          // ФИО в СвФЛ.ФИОРус.@attributes
    const fio = [f.Фамилия, f.Имя, f.Отчество].filter(Boolean).map(titleCase).join(' ')
    return clean({
      form: 'ИП',
      legal_name: fio,
      inn: a.ИННФЛ || a.ИНН,
      ogrn: a.ОГРНИП,
      ogrn_date: a.ДатаОГРНИП,
      legal_address: buildAddress(get),           // в ответе по ИП адреса обычно нет — останется пустым
      signer_name: fio,
      signer_basis: 'свидетельства о государственной регистрации',
    })
  }

  throw new Error('В ответе нет данных ЮЛ или ИП')
}

export const egrul = {
  id: 'egrul',
  name: 'egrul.org',
  async lookup(inn) {
    const res = await fetch(`${BASE}/${inn}.json`)
    if (!res.ok) throw new Error(`egrul.org вернул ${res.status}`)
    const raw = await res.json()
    return map(raw)
  },
}
