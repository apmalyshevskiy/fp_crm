/**
 * FUSIONPOS Mini-CRM — Google Apps Script backend (JSONP v4, оптимизированный)
 *
 * Что изменилось vs v3:
 *  - Новый action `bootstrap` возвращает {deals, quotes} одним запросом.
 *  - `save` возвращает полный обновлённый deal (фронт не делает loadAll после сохранения).
 *  - Headers кешируются в памяти скрипта (один доступ к листу за вызов handleRequest).
 *  - findRowById использует TextFinder (быстрее на больших листах).
 *  - removeActivityByDeal / removeQuotesByDeal группируют непрерывные диапазоны
 *    и удаляют их одним deleteRows вместо цикла deleteRow.
 *  - appendRow заменён на setValues(lastRow+1) — меньше overhead.
 */

const SECRET_TOKEN = 'CHANGE_ME_TO_RANDOM_STRING_AT_LEAST_20_CHARS';

const SHEET_DEALS = 'Deals';
const SHEET_ACTIVITY = 'Activity';
const SHEET_QUOTES = 'Pain_Quotes';

const DEAL_COLUMNS = [
  'id', 'created_at', 'updated_at', 'seller',
  'client_name', 'phone', 'type', 'points', 'stage', 'open_date',
  'current_system', 'pain_quote', 'needs', 'needs_text', 'temperature', 'dm',
  'dm_is_speaker', 'revenue', 'plan', 'hardware', 'status',
  'fp_client_id', 'fp_domain', 'fp_version',
  'next_step', 'next_date',
  'rejection_category', 'rejection_reason', 'rejection_reason_other',
  'rejection_quote', 'can_reanimate', 'reanimate_after_date',
  'archived_at'
];

const ACTIVITY_COLUMNS = [
  'id', 'deal_id', 'created_at', 'seller', 'type',
  'summary', 'status_after', 'temperature_after', 'next_step', 'next_date'
];

const QUOTE_COLUMNS = [
  'id', 'deal_id', 'activity_id', 'client_name', 'venue_type',
  'current_system', 'quote', 'created_at'
];

// =========================================================================
// Per-request cache — живёт только во время одного handleRequest
// =========================================================================
let _ssCache = null;
let _sheetCache = {};
let _headersCache = {};

function ss_() {
  if (!_ssCache) _ssCache = SpreadsheetApp.getActiveSpreadsheet();
  return _ssCache;
}
function sheet_(name) {
  if (!_sheetCache[name]) _sheetCache[name] = ss_().getSheetByName(name);
  return _sheetCache[name];
}
function headers_(name) {
  if (_headersCache[name]) return _headersCache[name];
  const sh = sheet_(name);
  const lastCol = sh.getLastColumn();
  if (lastCol === 0) return (_headersCache[name] = []);
  _headersCache[name] = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  return _headersCache[name];
}
function resetCache_() {
  _ssCache = null;
  _sheetCache = {};
  _headersCache = {};
}

// =========================================================================
// Entry points
// =========================================================================

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  resetCache_();
  const params = e.parameter || {};
  const callback = params.callback || 'callback';
  const action = params.action;
  const token = params.token;

  try {
    if (token !== SECRET_TOKEN) {
      return jsonpResponse(callback, { error: 'unauthorized' });
    }

    let body = {};
    if (params.data) {
      try { body = JSON.parse(params.data); } catch (err) { body = {}; }
    } else if (e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
    }

    ensureSheets();

    let result;
    switch (action) {
      case 'bootstrap':    result = { deals: listDeals(), quotes: listQuotes() }; break;
      case 'list':         result = { deals: listDeals() }; break;
      case 'save':         result = saveCallOutcome(body); break;
      case 'archive':      result = archiveDeal(body.id, body.archive !== false); break;
      case 'delete':       result = { ok: deleteDeal(body.id) }; break;
      case 'quotes':       result = { quotes: listQuotes() }; break;
      case 'activity':     result = { activity: listActivityForDeal(body.deal_id) }; break;
      case 'add_activity': result = { ok: addActivity(body) }; break;
      case 'rejection_stats': result = rejectionStats(); break;
      case 'ping':         result = { ok: true, ts: new Date().toISOString() }; break;
      default:             result = { error: 'unknown_action', action: action };
    }

    return jsonpResponse(callback, result);
  } catch (err) {
    return jsonpResponse(callback, { error: 'server_error', message: String(err) });
  }
}

function jsonpResponse(callback, obj) {
  const safeCallback = String(callback).replace(/[^a-zA-Z0-9_$.]/g, '');
  const body = safeCallback + '(' + JSON.stringify(obj) + ');';
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// =========================================================================
// Sheet bootstrap
// =========================================================================

function ensureSheets() {
  const ss = ss_();
  ensureSheet(ss, SHEET_DEALS, DEAL_COLUMNS);
  ensureSheet(ss, SHEET_ACTIVITY, ACTIVITY_COLUMNS);
  ensureSheet(ss, SHEET_QUOTES, QUOTE_COLUMNS);
}

function ensureSheet(ss, name, columns) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold');
    _sheetCache[name] = sheet;
    _headersCache[name] = columns.slice();
    return;
  }
  _sheetCache[name] = sheet;
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold');
    _headersCache[name] = columns.slice();
    return;
  }
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const missing = columns.filter(c => existing.indexOf(c) === -1);
  if (missing.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, 1, 1, lastCol + missing.length).setFontWeight('bold');
    _headersCache[name] = existing.concat(missing);
  } else {
    _headersCache[name] = existing;
  }
}

// =========================================================================
// Deals
// =========================================================================

function listDeals() {
  const sheet = sheet_(SHEET_DEALS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const headers = headers_(SHEET_DEALS);
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(row => rowToObj(row, headers, ['needs']));
}

/**
 * Find row by id using TextFinder — на больших листах в разы быстрее,
 * чем читать весь столбец A через getValues.
 */
function findRowById(sheet, id) {
  if (!id) return -1;
  const idRange = sheet.getRange('A:A');
  const finder = idRange.createTextFinder(String(id))
    .matchEntireCell(true)
    .matchCase(true);
  const found = finder.findNext();
  return found ? found.getRow() : -1;
}

/**
 * Save call outcome:
 *   - Upsert Deal
 *   - Append Activity
 *   - Append Pain_Quote (если есть текст)
 * Возвращает полный обновлённый deal — фронт мерджит локально без loadAll.
 */
function saveCallOutcome(deal) {
  const dealsSheet = sheet_(SHEET_DEALS);
  const now = new Date().toISOString();

  const isNew = !deal.id;
  if (isNew) {
    deal.id = generateId('d');
    deal.created_at = now;
  }
  deal.updated_at = now;

  const targetRow = isNew ? -1 : findRowById(dealsSheet, deal.id);
  if (targetRow < 0 && !deal.created_at) deal.created_at = now;

  const headers = headers_(SHEET_DEALS);

  // Подтягиваем существующие значения для полей, которых нет в форме
  // (например, archived_at — оно ставится только через action 'archive').
  if (targetRow > 0) {
    const existingRow = dealsSheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
    const preserveFields = ['archived_at', 'created_at'];
    headers.forEach((col, i) => {
      if (preserveFields.indexOf(col) !== -1 && (deal[col] === undefined || deal[col] === '')) {
        deal[col] = existingRow[i];
      }
    });
  }

  const row = headers.map(col => {
    let v = deal[col];
    if (col === 'needs' && Array.isArray(v)) v = JSON.stringify(v);
    if (v === undefined || v === null) v = '';
    return v;
  });

  if (targetRow > 0) {
    dealsSheet.getRange(targetRow, 1, 1, headers.length).setValues([row]);
  } else {
    const newRow = dealsSheet.getLastRow() + 1;
    dealsSheet.getRange(newRow, 1, 1, headers.length).setValues([row]);
  }

  const activityId = generateId('a');
  addActivity({
    id: activityId,
    deal_id: deal.id,
    seller: deal.seller || '',
    type: deal.activity_type || 'call',
    summary: deal.activity_summary || '',
    status_after: deal.status || '',
    temperature_after: deal.temperature || '',
    next_step: deal.next_step || '',
    next_date: deal.next_date || ''
  });

  if (deal.pain_quote && String(deal.pain_quote).trim().length > 5) {
    appendQuote(deal, activityId);
  }

  // Возвращаем deal в том же виде, в каком его отдаёт listDeals
  // (фронт мерджит этот объект в локальный массив).
  const dealForClient = {};
  headers.forEach((col, i) => {
    let v = row[i];
    if (col === 'needs' && typeof v === 'string' && v.length > 0) {
      try { v = JSON.parse(v); } catch (e) { v = v.split(',').map(s => s.trim()); }
    } else if (col === 'needs') {
      v = [];
    }
    dealForClient[col] = v;
  });

  return { deal: dealForClient, activity_id: activityId };
}

function deleteDeal(id) {
  if (!id) return false;
  const dealsSheet = sheet_(SHEET_DEALS);
  const row = findRowById(dealsSheet, id);
  if (row < 0) return false;
  dealsSheet.deleteRow(row);
  removeRowsByDealId_(sheet_(SHEET_ACTIVITY), id, 2);  // deal_id в колонке B
  removeRowsByDealId_(sheet_(SHEET_QUOTES), id, 2);
  return true;
}

/**
 * Soft delete: помечаем колонку archived_at (или очищаем при восстановлении).
 * Возвращает обновлённый deal, чтобы фронт мог смерджить локально.
 */
function archiveDeal(id, archive) {
  if (!id) return { error: 'no_id' };
  const dealsSheet = sheet_(SHEET_DEALS);
  const row = findRowById(dealsSheet, id);
  if (row < 0) return { error: 'not_found' };
  const headers = headers_(SHEET_DEALS);
  const archiveIdx = headers.indexOf('archived_at');
  if (archiveIdx < 0) return { error: 'no_archived_column' };
  const value = archive ? new Date().toISOString() : '';
  // Точечная запись — один setValue на одну ячейку
  dealsSheet.getRange(row, archiveIdx + 1).setValue(value);
  // updated_at тоже обновим
  const updatedIdx = headers.indexOf('updated_at');
  if (updatedIdx >= 0) dealsSheet.getRange(row, updatedIdx + 1).setValue(new Date().toISOString());
  // Перечитаем строку для ответа
  const rowValues = dealsSheet.getRange(row, 1, 1, headers.length).getValues()[0];
  const deal = rowToObj(rowValues, headers, ['needs']);
  return { deal: deal };
}

// =========================================================================
// Rejection analytics — агрегированная сводка по отказам и реанимациям
// =========================================================================

/**
 * Возвращает три блока:
 *   - by_category:   [{category, count}]                 — частота категорий
 *   - by_reason:     [{category, reason, count, quotes}] — частота конкретных причин с цитатами
 *   - by_competitor: [{competitor, count}]               — выбранные конкуренты (категория "Уже выбрали конкурента")
 *   - reanimation:   [{id, client_name, ...}]            — отказы с can_reanimate=true (сортированы по reanimate_after_date)
 *
 * Считается на сервере, чтобы фронт не лопатил весь список deals на больших данных.
 */
function rejectionStats() {
  const sheet = sheet_(SHEET_DEALS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { by_category: [], by_reason: [], by_competitor: [], reanimation: [] };

  const headers = headers_(SHEET_DEALS);
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  // Индексы колонок (один раз)
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  const byCategory = {};
  const byReason = {};
  const byCompetitor = {};
  const reanimation = [];

  values.forEach(row => {
    const status = row[idx.status];
    if (status !== 'Отказ') return;

    const cat = row[idx.rejection_category] || 'Не указано';
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    const reason = row[idx.rejection_reason] || '';
    if (reason) {
      const key = cat + ' / ' + reason;
      if (!byReason[key]) byReason[key] = { category: cat, reason: reason, count: 0, quotes: [] };
      byReason[key].count++;
      const q = row[idx.rejection_quote];
      if (q && byReason[key].quotes.length < 5) byReason[key].quotes.push(String(q));
    }

    // Отдельный срез по конкурентам — там подпричина и есть имя конкурента
    if (cat === 'Уже выбрали конкурента' && reason) {
      byCompetitor[reason] = (byCompetitor[reason] || 0) + 1;
    }

    if (row[idx.can_reanimate]) {
      reanimation.push({
        id: row[idx.id],
        client_name: row[idx.client_name],
        type: row[idx.type],
        phone: row[idx.phone],
        rejection_category: cat,
        rejection_reason: reason,
        rejection_reason_other: row[idx.rejection_reason_other],
        rejection_quote: row[idx.rejection_quote],
        reanimate_after_date: row[idx.reanimate_after_date] instanceof Date
          ? row[idx.reanimate_after_date].toISOString()
          : row[idx.reanimate_after_date]
      });
    }
  });

  const byCategoryList = Object.keys(byCategory)
    .map(k => ({ category: k, count: byCategory[k] }))
    .sort((a, b) => b.count - a.count);

  const byReasonList = Object.keys(byReason)
    .map(k => byReason[k])
    .sort((a, b) => b.count - a.count);

  const byCompetitorList = Object.keys(byCompetitor)
    .map(k => ({ competitor: k, count: byCompetitor[k] }))
    .sort((a, b) => b.count - a.count);

  reanimation.sort((a, b) => {
    const ad = a.reanimate_after_date ? new Date(a.reanimate_after_date) : new Date(8.64e15);
    const bd = b.reanimate_after_date ? new Date(b.reanimate_after_date) : new Date(8.64e15);
    return ad - bd;
  });

  return {
    by_category: byCategoryList,
    by_reason: byReasonList,
    by_competitor: byCompetitorList,
    reanimation: reanimation
  };
}

// =========================================================================
// Activity
// =========================================================================

function addActivity(entry) {
  const sheet = sheet_(SHEET_ACTIVITY);
  const headers = headers_(SHEET_ACTIVITY);
  const data = {
    id: entry.id || generateId('a'),
    deal_id: entry.deal_id || '',
    created_at: new Date().toISOString(),
    seller: entry.seller || '',
    type: entry.type || 'call',
    summary: entry.summary || '',
    status_after: entry.status_after || '',
    temperature_after: entry.temperature_after || '',
    next_step: entry.next_step || '',
    next_date: entry.next_date || ''
  };
  const row = headers.map(col => data[col] !== undefined ? data[col] : '');
  const newRow = sheet.getLastRow() + 1;
  sheet.getRange(newRow, 1, 1, headers.length).setValues([row]);
  return true;
}

function listActivityForDeal(dealId) {
  if (!dealId) return [];
  const sheet = sheet_(SHEET_ACTIVITY);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const headers = headers_(SHEET_ACTIVITY);
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const dealIdx = headers.indexOf('deal_id');
  return values
    .filter(row => row[dealIdx] === dealId)
    .map(row => rowToObj(row, headers, []));
}

/**
 * Удаление всех строк, у которых значение в колонке dealIdColNumber == dealId.
 * Объединяет соседние строки в непрерывные диапазоны и удаляет их одним deleteRows.
 */
function removeRowsByDealId_(sheet, dealId, dealIdColNumber) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const colValues = sheet.getRange(2, dealIdColNumber, lastRow - 1, 1).getValues();

  // Собираем индексы строк (в координатах листа) для удаления, по убыванию
  const rowsToDelete = [];
  for (let i = colValues.length - 1; i >= 0; i--) {
    if (colValues[i][0] === dealId) rowsToDelete.push(i + 2);
  }
  if (rowsToDelete.length === 0) return;

  // Группируем непрерывные диапазоны (rowsToDelete отсортирован по убыванию,
  // поэтому соседние = разница ровно 1).
  let i = 0;
  while (i < rowsToDelete.length) {
    let end = rowsToDelete[i];   // нижняя граница (большая)
    let start = end;             // верхняя граница (меньшая) — будем уменьшать
    let j = i + 1;
    while (j < rowsToDelete.length && rowsToDelete[j] === start - 1) {
      start = rowsToDelete[j];
      j++;
    }
    sheet.deleteRows(start, end - start + 1);
    i = j;
  }
}

// =========================================================================
// Pain quotes
// =========================================================================

function appendQuote(deal, activityId) {
  const sheet = sheet_(SHEET_QUOTES);
  const headers = headers_(SHEET_QUOTES);
  const data = {
    id: generateId('q'),
    deal_id: deal.id,
    activity_id: activityId || '',
    client_name: deal.client_name || '',
    venue_type: deal.type || '',
    current_system: deal.current_system || '',
    quote: deal.pain_quote || '',
    created_at: new Date().toISOString()
  };
  const row = headers.map(col => data[col] !== undefined ? data[col] : '');
  const newRow = sheet.getLastRow() + 1;
  sheet.getRange(newRow, 1, 1, headers.length).setValues([row]);
}

function listQuotes() {
  const sheet = sheet_(SHEET_QUOTES);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const headers = headers_(SHEET_QUOTES);
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(row => rowToObj(row, headers, []));
}

// =========================================================================
// Utils
// =========================================================================

function rowToObj(row, headers, jsonFields) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const col = headers[i];
    let v = row[i];
    if (jsonFields.indexOf(col) !== -1 && typeof v === 'string' && v.length > 0) {
      try { v = JSON.parse(v); } catch (e) { v = v.split(',').map(s => s.trim()); }
    } else if (jsonFields.indexOf(col) !== -1) {
      v = [];
    }
    if (v instanceof Date) v = v.toISOString();
    obj[col] = v;
  }
  return obj;
}

function generateId(prefix) {
  return (prefix || 'x') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}
