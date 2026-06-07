// src/lib/inn/index.js
// Реестр провайдеров данных по ИНН. Чтобы сменить сервис:
//   1) добавить файл-провайдер с интерфейсом { id, name, async lookup(inn) }
//   2) импортировать и положить в providers
//   3) поменять ACTIVE
// Компоненты зовут только lookupByInn() — про конкретный сервис они не знают.

import { egrul } from './egrul'
// import { dadata } from './dadata'   // пример будущего провайдера

const providers = {
  egrul,
  // dadata,
}

const ACTIVE = 'egrul'   // <- единственное место выбора сервиса

export function activeProvider() {
  return providers[ACTIVE]
}

// ИНН -> { provider, data }, где data — поля для формы юрлица
export async function lookupByInn(inn) {
  const p = activeProvider()
  if (!p) throw new Error('Провайдер по ИНН не настроен')
  const data = await p.lookup(String(inn).trim())
  return { provider: p.name, data }
}
