<!-- src/components/ProposalsBlock.vue — блок «Коммерческие предложения» в карточке сделки.
     Блок 1: список существующих КП + печать (с тарифами и без).
     Создание/редактирование («+ Новое КП», «Изменить») — следующий блок. -->
<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../api/client'
import {
  proposalStatusLabel, proposalStatusColor, fmtMoney, buildProposalPrintHtml,
} from '../lib/proposals'

const props = defineProps({
  dealId: { required: true },
  deal: { type: Object, default: () => ({}) },   // для имени клиента/ИНН в печати
})
const emit = defineEmits(['open-form'])           // (proposalId|null) — форма следующим блоком

const proposals = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true; error.value = ''
  try {
    proposals.value = await db.list('proposals', {
      filter: `deal_id,eq,${props.dealId}`, order: 'created_at,desc', size: 100,
    })
  } catch (e) { error.value = e.message } finally { loading.value = false }
}

function fmtDateShort(s) { return s ? new Date(s).toLocaleDateString('ru-RU') : '' }

// Печать: открываем окно сразу (иначе блокировка pop-up), затем грузим данные и пишем HTML.
async function printProposal(proposalId, withTariffs) {
  let win = null
  try {
    win = window.open('', '_blank', 'width=900,height=1200')
    if (!win) { error.value = 'Браузер заблокировал всплывающее окно. Разрешите pop-up и повторите.'; return }
    win.document.write(`<title>КП №${proposalId}</title><body style="font-family:sans-serif;padding:2rem">Загрузка КП №${proposalId}…</body>`)

    const [proposal, items] = await Promise.all([
      db.get('proposals', proposalId),
      db.list('proposal_items', { filter: `proposal_id,eq,${proposalId}`, order: 'position,asc', size: 500 }),
    ])

    // Сделка — имя клиента/ИНН. Берём из props, если совпадает, иначе подгружаем.
    let deal = props.deal
    if (Number(deal?.id) !== Number(proposal.deal_id)) {
      try { deal = await db.get('deals', proposal.deal_id) } catch { deal = { client_name: '—' } }
    }

    // Продавец — для шапки/подписи.
    let seller = null
    if (proposal.seller_id) { try { seller = await db.get('users', proposal.seller_id) } catch { seller = null } }

    const html = buildProposalPrintHtml(proposal, items, deal, seller, withTariffs)
    win.document.open(); win.document.write(html); win.document.close()
  } catch (e) {
    if (win && !win.closed) {
      win.document.open()
      win.document.write(`<body style="font-family:sans-serif;padding:2rem;color:#c00">Не удалось загрузить КП №${proposalId}: ${e.message}</body>`)
      win.document.close()
    } else {
      error.value = `Ошибка печати: ${e.message}`
    }
  }
}

defineExpose({ reload: load })
onMounted(load)
</script>

<template>
  <div class="card">
    <div class="sub-head">
      <span class="card-title">Коммерческие предложения</span>
      <button type="button" class="mini" @click="emit('open-form', null)">+ Новое КП</button>
    </div>

    <p v-if="loading" class="muted">Загрузка…</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <p v-else-if="proposals.length === 0" class="muted">КП по этой сделке пока нет</p>

    <div v-else>
      <div v-for="p in proposals" :key="p.id" class="prop-row">
        <div class="prop-main">
          <div class="prop-name">КП №{{ p.id }} · {{ fmtDateShort(p.date) }}</div>
          <div class="prop-meta">{{ p.comment || 'без комментария' }}</div>
        </div>
        <div class="prop-amount">{{ fmtMoney(p.total_amount) }}</div>
        <span class="prop-status" :style="{ color: proposalStatusColor(p.status) }">{{ proposalStatusLabel(p.status) }}</span>
        <div class="prop-actions">
          <button v-if="p.status !== 'cancelled'" type="button" class="mini" @click="emit('open-form', p.id)">Изменить</button>
          <button type="button" class="mini" @click="printProposal(p.id, false)">Печать</button>
          <button type="button" class="mini" @click="printProposal(p.id, true)">Печать + тарифы</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card { background: var(--bg); border: 0.5px solid var(--border); border-radius: var(--radius); padding: 1rem 1.25rem; margin-bottom: 12px; }
.sub-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.card-title { font-weight: 600; font-size: 13px; color: var(--text-secondary); }
.mini { font-size: 12px; padding: 5px 10px; border-radius: var(--radius); }

.prop-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 0.5px solid var(--border); flex-wrap: wrap; }
.prop-row:last-child { border-bottom: none; }
.prop-main { flex: 1; min-width: 160px; }
.prop-name { font-weight: 500; font-size: 14px; }
.prop-meta { font-size: 12px; color: var(--text-tertiary, #9a9a93); margin-top: 2px; }
.prop-amount { font-weight: 600; white-space: nowrap; }
.prop-status { font-size: 12px; text-transform: uppercase; padding: 3px 10px; border-radius: var(--radius); background: var(--bg-secondary); white-space: nowrap; }
.prop-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.muted { color: var(--text-tertiary, #9a9a93); }
.err { color: var(--danger); }
</style>
