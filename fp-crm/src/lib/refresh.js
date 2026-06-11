// src/lib/refresh.js — лёгкий сигнал «данные сделок изменились» для обновления списков.
import { reactive } from 'vue'
export const refreshStore = reactive({ deals: 0 })
export function notifyDealsChanged() { refreshStore.deals++ }
