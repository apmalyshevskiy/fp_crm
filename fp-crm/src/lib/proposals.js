// src/lib/proposals.js
// Чистые помощники для КП + построение печатной формы (перенесено из старой CRM).
// Без обращений к API — оркестрация (fetch/окно) живёт в компоненте ProposalsBlock.vue.

export function proposalStatusLabel(s) {
  return { draft: 'черновик', sent: 'отправлено', cancelled: 'отменено' }[s] || s
}
export function proposalStatusColor(s) {
  if (s === 'sent') return 'var(--success, #1D9E75)'
  if (s === 'cancelled') return 'var(--text-tertiary, #9a9a93)'
  return 'var(--gold)' // draft
}
export function fmtMoney(n) {
  return Number(n || 0).toLocaleString('ru-RU') + ' \u20bd'
}
// деньги с 2 знаками: «1 234,00 ₽»
export function fmtMoney2(n) {
  return Number(n || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20bd'
}

// Ставки НДС в форме (как в старой CRM): без НДС и 5%.
export const VAT_RATES = [
  { value: 'no_vat', label: 'Без НДС' },
  { value: '5', label: '5%' },
]

// НДС считается «изнутри» цены: для ставки r% НДС = сумма × r / (100 + r).
export function calcRow(item) {
  const qty = Number(item.quantity) || 0
  const price = Number(item.price) || 0
  const amount = qty * price
  let vat_amount = 0
  if (item.vat_rate && item.vat_rate !== 'no_vat') {
    const rate = Number(item.vat_rate)
    if (rate > 0) vat_amount = amount * rate / (100 + rate)
  }
  return { amount, vat_amount }
}
export function calcTotals(items) {
  let total = 0, total_vat = 0, total_no_vat = 0
  for (const it of items) {
    const r = calcRow(it)
    total += r.amount
    total_vat += r.vat_amount
    if (!it.vat_rate || it.vat_rate === 'no_vat') total_no_vat += r.amount
  }
  return { total, total_vat, total_no_vat }
}
export function round2(n) { return Math.round((Number(n) || 0) * 100) / 100 }

// Статусы, из которых КП-отправка НЕ откатывает сделку в «КП отправлено».
export const ADVANCE_BLOCKED_STATUSES = [
  'КП отправлено', 'Счёт выставлен', 'Оплачено', 'Отказ', 'Не сейчас',
]
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

// Печатная форма КП. Возвращает строку HTML для записи в новое окно.
export function buildProposalPrintHtml(proposal, items, deal, seller, withTariffs) {
    const propNum = proposal.id;
    const dateStr = proposal.date ? new Date(proposal.date).toLocaleDateString('ru-RU') : '—';
    const validStr = proposal.valid_until ? new Date(proposal.valid_until).toLocaleDateString('ru-RU') : '';
    const clientName = (deal && (deal.company_name || deal.client_name)) ? (deal.company_name || deal.client_name) : '—';
    const clientInn = (deal && deal.inn) ? String(deal.inn).trim() : '';
    const sellerName = seller ? (seller.full_name || seller.login) : '—';
    const sellerPhone = seller && seller.phone ? seller.phone : '';
    const sellerEmail = seller && seller.email ? seller.email : '';

    const total = Number(proposal.total_amount || 0);
    const totalVat = Number(proposal.total_vat || 0);

    const fmtNum = n => Number(n || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmt = n => fmtNum(n) + ' ₽';

    const rowsHtml = items.map((it, i) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      const amount = Number(it.amount) || 0;
      const vat = Number(it.vat_amount) || 0;
      const isNoVat = !it.vat_rate || it.vat_rate === 'no_vat';
      const vatLabel = isNoVat ? 'Без НДС' : (it.vat_rate + '%');
      const vatCell = isNoVat ? '—' : fmtNum(vat);
      return `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td>${escapeHtml(it.name)}</td>
          <td style="text-align:center">${escapeHtml(it.unit || '')}</td>
          <td style="text-align:right">${qty.toLocaleString('ru-RU')}</td>
          <td style="text-align:right">${fmtNum(price)}</td>
          <td style="text-align:center">${vatLabel}</td>
          <td style="text-align:right">${vatCell}</td>
          <td style="text-align:right;font-weight:600">${fmtNum(amount)}</td>
        </tr>
      `;
    }).join('');

    // Блок тарифов — вставляется после «Кому:» только в режиме «Печать + тарифы»
    const tariffsHtml = withTariffs ? `
<div class="tariffs">
  <h3>Тарифы FUSIONPOS</h3>
  <div class="cards">
    <div class="tcard accent">
      <div class="tlabel">Всё включено</div>
      <div class="tprice">0,5% <span>с оборота</span></div>
      <div class="tnote">Не больше 10 000 ₽/мес за точку · бесплатно, пока нет выручки</div>
      <div class="tsum">
        <div class="tsum-line"><b>✓</b> Весь основной функционал</div>
        <div class="tsum-line"><b>✓</b> Все опции — без доплат</div>
      </div>
      <ul class="opts">
        <li><span>Столы (план зала)</span><b>Включено</b></li>
        <li><span>Экраны кухни</span><b>Включено</b></li>
        <li><span>Мобильный официант</span><b>Включено</b></li>
        <li><span>Касса самообслуживания</span><b>Включено</b></li>
        <li><span>Несколько терминалов</span><b>Включено</b></li>
        <li><span>API (1С, сайты, боты)</span><b>Включено</b></li>
      </ul>
    </div>
    <div class="tcard">
      <div class="tlabel">Стандарт</div>
      <div class="tprice">2 190 ₽ <span>/мес за точку</span></div>
      <div class="tnote">14 дней бесплатно · опции подключаются по необходимости</div>
      <div class="tsum">
        <div class="tsum-line"><b>✓</b> Весь основной функционал</div>
        <div class="tsum-line"><em>+</em> Опции — за отдельную плату</div>
      </div>
      <ul class="opts">
        <li><span>Столы (план зала)</span><em>+ 990 ₽</em></li>
        <li><span>Экраны кухни</span><em>+ 990 ₽</em></li>
        <li><span>Мобильный официант</span><em>+ 1 290 ₽</em></li>
        <li><span>Касса самообслуживания</span><em>+ 1 290 ₽</em></li>
        <li><span>Несколько терминалов</span><em>+ 1 290 ₽</em></li>
        <li><span>API (1С, сайты, боты)</span><em>+ 990 ₽</em></li>
      </ul>
    </div>
  </div>
  <div class="tfoot">Основной функционал (касса, склад, меню, лояльность, онлайн-кассы 54-ФЗ, Честный знак, аналитика, облачная панель) входит в оба тарифа. Для сети — все точки в одной панели. Тариф можно сменить в любой момент.</div>
</div>
` : '';

    // Простой, чистый HTML с inline-стилями — независим от crm.html
    return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>КП №${propNum} — ${escapeHtml(clientName)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #222; max-width: 800px; margin: 0 auto; padding: 24px; font-size: 14px; line-height: 1.5; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 24px; }
  .head .brand { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
  .head .brand .brand-logo { height: 30px; width: auto; display: block; }
  body.compact .head .brand .brand-logo { height: 26px; }
  .head .seller { text-align: right; font-size: 13px; color: #555; }
  .title { text-align: center; margin: 28px 0 8px; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .subtitle { text-align: center; color: #555; margin-bottom: 24px; font-size: 13px; }
  .meta { background: #f7f7f7; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; }
  .meta .row { display: flex; gap: 12px; margin-bottom: 4px; }
  .meta .row:last-child { margin-bottom: 0; }
  .meta .lbl { color: #666; min-width: 130px; }
  table.items { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
  table.items th, table.items td { border: 1px solid #ddd; padding: 8px 10px; vertical-align: top; }
  table.items th { background: #f0f0f0; font-weight: 600; text-align: left; }
  table.items th:nth-child(1), table.items td:nth-child(1) { width: 36px; text-align: center; }
  .totals { margin: 24px 0 32px; display: flex; justify-content: flex-end; }
  .totals table { border-collapse: collapse; font-size: 14px; }
  .totals td { padding: 4px 12px; }
  .totals td:first-child { color: #666; text-align: right; }
  .totals td:last-child { text-align: right; font-weight: 500; min-width: 120px; }
  .totals tr.main td { font-weight: 700; font-size: 16px; padding-top: 8px; border-top: 1px solid #222; }
  .comment { padding: 12px 16px; background: #fffaf0; border-left: 3px solid #f4b400; margin: 16px 0; font-size: 13px; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 13px; }
  .footer .signature { border-top: 1px solid #999; padding-top: 6px; min-width: 220px; text-align: center; color: #555; }
  .notes { font-size: 12px; color: #777; margin-top: 24px; line-height: 1.5; }

  /* Блок тарифов FUSIONPOS */
  .tariffs { margin: 18px 0 4px; }
  .tariffs h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #222; margin: 0 0 10px; }
  .tariffs .cards { display: flex; gap: 12px; }
  .tariffs .tcard { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 14px 16px; }
  .tariffs .tcard.accent { border-color: #009CF3; }
  .tariffs .tlabel { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #666; margin-bottom: 6px; }
  .tariffs .tprice { font-size: 26px; font-weight: 800; line-height: 1; color: #111; }
  .tariffs .tprice span { font-size: 13px; font-weight: 400; color: #555; }
  .tariffs .tnote { font-size: 12px; color: #555; margin: 4px 0 10px; }
  .tariffs .tsum { background: #f4f6f8; border-radius: 6px; padding: 7px 10px; margin-bottom: 8px; }
  .tcard.accent .tsum { background: #e8f5fe; }
  .tariffs .tsum-line { font-size: 12px; font-weight: 600; color: #222; display: flex; align-items: baseline; gap: 6px; padding: 1px 0; }
  .tariffs .tsum-line b { color: #1D9E75; font-weight: 700; }
  .tariffs .tsum-line em { color: #009CF3; font-style: normal; font-weight: 700; }
  .tariffs ul { list-style: none; margin: 0; padding: 0; font-size: 12px; }
  .tariffs ul li { padding: 2px 0; color: #333; }
  .tariffs ul li b { color: #009CF3; }
  .tariffs ul.opts li { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; border-top: 1px solid #eee; padding: 3px 0; }
  .tariffs ul.opts li:first-child { border-top: 0; }
  .tariffs ul.opts li span { color: #333; }
  .tariffs ul.opts li b { color: #1D9E75; font-weight: 600; white-space: nowrap; }
  .tariffs ul.opts li em { color: #555; font-style: normal; white-space: nowrap; }
  .tariffs .tfoot { font-size: 11px; color: #777; margin-top: 10px; line-height: 1.4; }

  /* Печать */
  @media print {
    body { padding: 0; max-width: none; }
    @page { size: A4; margin: 18mm 16mm; }
    .tariffs .tcard { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  /* Компактный режим, когда добавлен блок тарифов — чтобы 7 строк + тарифы влезли на 1 лист */
  body.compact { font-size: 12px; }
  body.compact .head { padding-bottom: 7px; margin-bottom: 10px; }
  body.compact .brand { font-size: 19px; }
  body.compact .title { margin: 8px 0 3px; font-size: 15px; }
  body.compact .subtitle { margin-bottom: 9px; font-size: 12px; }
  body.compact .meta { margin-bottom: 8px; padding: 6px 13px; }
  body.compact .tariffs { margin: 9px 0 4px; }
  body.compact .tariffs h3 { margin-bottom: 7px; }
  body.compact .tariffs .tcard { padding: 9px 13px; }
  body.compact .tariffs .tprice { font-size: 20px; }
  body.compact .tariffs .tnote { margin: 3px 0 6px; font-size: 11px; }
  body.compact .tariffs .tsum { padding: 5px 9px; margin-bottom: 6px; }
  body.compact .tariffs .tsum-line { font-size: 11px; }
  body.compact .tariffs ul { font-size: 10.5px; }
  body.compact .tariffs ul li { padding: 1px 0; }
  body.compact .tariffs ul.opts li { padding: 1.5px 0; }
  body.compact .tariffs .tfoot { margin-top: 6px; }
  body.compact .comment { margin: 8px 0; padding: 7px 13px; }
  body.compact table.items { margin: 8px 0; font-size: 12px; }
  body.compact table.items th, body.compact table.items td { padding: 3px 8px; }
  body.compact .totals { margin: 9px 0 10px; }
  body.compact .footer { margin-top: 14px; }
  body.compact .notes { margin-top: 12px; }
</style>
</head>
<body class="${withTariffs ? 'compact' : ''}">

<div class="head">
  <div class="brand"><svg class="brand-logo" viewBox="0 0 160 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 3.87879V28.1212C0 30.2634 1.73659 32 3.87879 32H28.1212C30.2634 32 32 30.2634 32 28.1212V8.07619C32 6.56135 30.772 5.33333 29.2571 5.33333H29.181C27.7082 5.33333 26.5143 4.13943 26.5143 2.66667C26.5143 1.19391 25.3204 0 23.8476 0H3.87879C1.73659 0 0 1.73659 0 3.87879Z" fill="#009CF3"/><path fill-rule="evenodd" clip-rule="evenodd" d="M22.4494 10.7154C22.8832 10.7154 23.2349 10.3637 23.2349 9.92988V7.57335C23.2349 7.13953 22.8832 6.78784 22.4494 6.78784H14.5943H11.4523C11.0185 6.78784 10.6668 7.13952 10.6668 7.57334L10.6667 10.7154L10.6668 12.5419C10.6668 12.9757 11.0185 13.3274 11.4523 13.3274H13.8088C14.2426 13.3274 14.5943 12.9757 14.5943 12.5419V11.5009C14.5943 11.0671 14.946 10.7154 15.3798 10.7154L22.4494 10.7154ZM18.1293 19.356C18.5631 19.356 18.9148 19.0043 18.9148 18.5705V16.2139C18.9148 15.7801 18.5631 15.4284 18.1293 15.4284H14.5943H11.4524C11.0186 15.4284 10.6669 15.7801 10.6669 16.2139L10.6668 24.4618C10.6668 24.8956 11.0185 25.2473 11.4523 25.2473H13.8088C14.2426 25.2473 14.5943 24.8956 14.5943 24.4618V20.1415C14.5943 19.7077 14.946 19.356 15.3798 19.356L18.1293 19.356Z" fill="white"/><rect x="28.1212" width="3.87879" height="3.87879" rx="1.93939" fill="#009CF3"/><path d="M50.2024 7.96469C50.8589 7.96469 51.0707 8.17645 51.0707 8.83292V10.2517C51.0707 10.887 50.8589 11.0988 50.2024 11.0988H44.273V14.127H49.1436C49.8001 14.127 50.0118 14.3388 50.0118 14.9953V16.4141C50.0118 17.0494 49.8001 17.2612 49.1436 17.2612H44.273V22.1318C44.273 22.7882 44.0401 23 43.4048 23H41.6895C41.0542 23 40.8212 22.7882 40.8212 22.1318V8.83292C40.8212 8.17645 41.0542 7.96469 41.6895 7.96469H50.2024ZM56.6467 17.7906C56.6467 19.3153 57.5573 20.1835 59.3361 20.1835C61.1361 20.1835 62.0255 19.3153 62.0255 17.7906V8.83292C62.0255 8.17645 62.2373 7.96469 62.8938 7.96469H64.6091C65.2444 7.96469 65.4773 8.17645 65.4773 8.83292V17.7059C65.4773 21.1153 63.3597 23.3176 59.3361 23.3176C55.3338 23.3176 53.2161 21.1153 53.2161 17.7059V8.83292C53.2161 8.17645 53.4279 7.96469 54.0844 7.96469H55.7996C56.4349 7.96469 56.6467 8.17645 56.6467 8.83292V17.7906ZM67.8577 12.3906C67.8577 9.65881 69.933 7.64704 73.893 7.64704C76.9847 7.64704 78.5942 8.68469 79.5683 10.76C79.8647 11.3529 79.6953 11.6494 79.1024 11.9035L77.493 12.6023C76.9424 12.8565 76.7095 12.7506 76.3918 12.1788C75.9471 11.2894 75.2271 10.7812 73.893 10.7812C72.1565 10.7812 71.3942 11.2259 71.3942 12.2423C71.3942 13.3859 72.8553 13.6188 74.5706 13.8094C77.0483 14.1059 80.0553 14.7412 80.0553 18.4682C80.0553 21.3694 77.6624 23.3176 73.7659 23.3176C70.4624 23.3176 68.6412 22.1106 67.8153 19.8871C67.6036 19.2729 67.773 18.9976 68.3659 18.7859L69.9118 18.2353C70.5259 18.0023 70.7589 18.1082 71.0342 18.7435C71.4577 19.6541 72.4106 20.2047 73.7659 20.2047C75.5659 20.2047 76.5824 19.7388 76.5824 18.5318C76.5824 17.4729 75.2906 17.1765 73.7236 17.0071C71.1824 16.7106 67.8577 16.2871 67.8577 12.3906ZM82.3354 8.81175C82.3354 8.17645 82.5472 7.96469 83.1825 7.96469H84.9402C85.5755 7.96469 85.7872 8.17645 85.7872 8.81175V22.1529C85.7872 22.7882 85.5755 23 84.9402 23H83.1825C82.5472 23 82.3354 22.7882 82.3354 22.1529V8.81175ZM88.3952 13.3435C88.3952 9.82822 90.6399 7.64704 94.6423 7.64704C98.6658 7.64704 100.911 9.82822 100.911 13.3435V17.6212C100.911 21.1365 98.6658 23.3176 94.6423 23.3176C90.6399 23.3176 88.3952 21.1365 88.3952 17.6212V13.3435ZM97.4588 13.28C97.4588 11.6282 96.4423 10.8023 94.6423 10.8023C92.8635 10.8023 91.847 11.6282 91.847 13.28V17.6847C91.847 19.3365 92.8635 20.1623 94.6423 20.1623C96.4423 20.1623 97.4588 19.3365 97.4588 17.6847V13.28ZM114.862 7.96469C115.497 7.96469 115.709 8.17645 115.709 8.83292V22.1318C115.709 22.7882 115.497 23 114.862 23H113.146C112.723 23 112.49 22.8941 112.299 22.5976L108.149 16.2871C107.111 14.72 106.539 12.8988 106.37 12.327H106.222C106.349 12.9412 106.815 14.8259 106.815 17.0706V22.1318C106.815 22.7882 106.582 23 105.946 23H104.379C103.744 23 103.511 22.7882 103.511 22.1318V8.83292C103.511 8.17645 103.744 7.96469 104.379 7.96469H106.137C106.582 7.96469 106.772 8.09175 106.963 8.36704L111.198 14.7835C112.299 16.4353 112.744 18.0871 112.935 18.5741H113.104C112.892 17.9176 112.426 16.16 112.426 13.8941V8.83292C112.426 8.17645 112.638 7.96469 113.295 7.96469H114.862Z" fill="#009CF3"/><path d="M125.285 7.96469C128.44 7.96469 130.473 9.87057 130.473 13.047C130.473 16.2235 128.483 18.1082 125.285 18.1082H122.193V22.1318C122.193 22.7882 121.96 23 121.325 23H119.61C118.975 23 118.742 22.7882 118.742 22.1318V8.83292C118.742 8.17645 118.975 7.96469 119.61 7.96469H125.285ZM124.925 14.9529C126.153 14.9529 126.895 14.2541 126.895 13.047C126.895 11.84 126.175 11.0988 124.925 11.0988H122.193V14.9529H124.925ZM132.288 13.3435C132.288 9.82822 134.532 7.64704 138.535 7.64704C142.558 7.64704 144.803 9.82822 144.803 13.3435V17.6212C144.803 21.1365 142.558 23.3176 138.535 23.3176C134.532 23.3176 132.288 21.1365 132.288 17.6212V13.3435ZM141.351 13.28C141.351 11.6282 140.335 10.8023 138.535 10.8023C136.756 10.8023 135.739 11.6282 135.739 13.28V17.6847C135.739 19.3365 136.756 20.1623 138.535 20.1623C140.335 20.1623 141.351 19.3365 141.351 17.6847V13.28ZM146.874 12.3906C146.874 9.65881 148.949 7.64704 152.909 7.64704C156.001 7.64704 157.611 8.68469 158.585 10.76C158.881 11.3529 158.712 11.6494 158.119 11.9035L156.509 12.6023C155.959 12.8565 155.726 12.7506 155.408 12.1788C154.964 11.2894 154.244 10.7812 152.909 10.7812C151.173 10.7812 150.411 11.2259 150.411 12.2423C150.411 13.3859 151.872 13.6188 153.587 13.8094C156.065 14.1059 159.072 14.7412 159.072 18.4682C159.072 21.3694 156.679 23.3176 152.782 23.3176C149.479 23.3176 147.658 22.1106 146.832 19.8871C146.62 19.2729 146.789 18.9976 147.382 18.7859L148.928 18.2353C149.542 18.0023 149.775 18.1082 150.051 18.7435C150.474 19.6541 151.427 20.2047 152.782 20.2047C154.582 20.2047 155.599 19.7388 155.599 18.5318C155.599 17.4729 154.307 17.1765 152.74 17.0071C150.199 16.7106 146.874 16.2871 146.874 12.3906Z" fill="#1a1a1a"/></svg></div>
  <div class="seller">
    <div><strong>${escapeHtml(sellerName)}</strong></div>
    ${(sellerPhone || sellerEmail) ? '<div>' + [sellerPhone ? 'Тел.: ' + escapeHtml(sellerPhone) : '', sellerEmail ? escapeHtml(sellerEmail) : ''].filter(Boolean).join(' &nbsp;·&nbsp; ') + '</div>' : ''}
  </div>
</div>

<div class="title">Коммерческое предложение №${propNum}</div>
<div class="subtitle">от ${dateStr}${validStr ? ' &nbsp;·&nbsp; Действительно до ' + validStr : ''}</div>

<div class="meta">
  <div class="row"><span class="lbl">Кому:</span><span><strong>${escapeHtml(clientName)}</strong></span></div>
  ${clientInn ? '<div class="row"><span class="lbl">ИНН:</span><span>' + escapeHtml(clientInn) + '</span></div>' : ''}
</div>

${tariffsHtml}

${proposal.comment ? '<div class="comment">' + escapeHtml(proposal.comment) + '</div>' : ''}

<table class="items">
  <thead>
    <tr>
      <th>№</th>
      <th>Наименование</th>
      <th style="text-align:center">Ед.</th>
      <th style="text-align:right">Кол-во</th>
      <th style="text-align:right">Цена, ₽</th>
      <th style="text-align:center">Ставка НДС</th>
      <th style="text-align:right">Сумма НДС, ₽</th>
      <th style="text-align:right">Всего, ₽</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>

<div class="totals">
  <table>
    <tr class="main"><td>Всего к оплате:</td><td>${fmt(total)}</td></tr>
    <tr><td>В т.ч. НДС:</td><td>${fmt(totalVat)}</td></tr>
  </table>
</div>

<div class="footer">
  <div>
    <div style="margin-bottom: 4px"><strong>С уважением,</strong></div>
    <div>${escapeHtml(sellerName)}</div>
    <div style="color:#666;font-size:12px;margin-top: 2px">FUSIONPOS</div>
  </div>
  <div class="signature">подпись / печать</div>
</div>

${(validStr && !withTariffs) ? `<div class="notes">Условия КП действуют до ${validStr}.</div>` : ''}

</body>
</html>`;
  }
