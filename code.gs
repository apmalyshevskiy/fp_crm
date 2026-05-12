/**
 * FUSIONPOS Mini-CRM — Google Apps Script backend (JSONP v3, с историей касаний)
 *
 * Хранит данные в трёх листах:
 *   Deals       — карточки сделок (по одной на клиента)
 *   Activity    — лента касаний (звонки, демо, КП — N записей на сделку)
 *   Pain_Quotes — выгрузка дословных цитат боли
 *
 * Каждое сохранение в форме «Итог звонка»:
 *   1) Обновляет/создаёт строку в Deals
 *   2) Добавляет НОВУЮ запись в Activity (история не затирается)
 *   3) Если есть pain_quote — добавляет НОВУЮ запись в Pain_Quotes
 *
 * ВАЖНО: замените SECRET_TOKEN на свой случайный токен.
 */

const SECRET_TOKEN = 'CHANGE_ME_TO_RANDOM_STRING_AT_LEAST_20_CHARS';

const SHEET_DEALS = 'Deals';
const SHEET_ACTIVITY = 'Activity';
const SHEET_QUOTES = 'Pain_Quotes';

const DEAL_COLUMNS = [
  'id', 'created_at', 'updated_at', 'seller',
  'client_name', 'phone', 'type', 'points', 'stage', 'open_date',
  'current_system', 'pain_quote', 'needs', 'temperature', 'dm',
  'dm_is_speaker', 'revenue', 'plan', 'hardware', 'status',
  'next_step', 'next_date'
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
// Entry points
// =========================================================================

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
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
      case 'list':         result = { deals: listDeals() }; break;
      case 'save':         result = saveCallOutcome(body); break;
      case 'delete':       result = { ok: deleteDeal(body.id) }; break;
      case 'quotes':       result = { quotes: listQuotes() }; break;
      case 'activity':     result = { activity: listActivityForDeal(body.deal_id) }; break;
      case 'add_activity': result = { ok: addActivity(body) }; break;
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
    return;
  }
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold');
    return;
  }
  // Add missing columns at the end (so old sheets get new fields automatically)
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const missing = columns.filter(c => existing.indexOf(c) === -1);
  if (missing.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, 1, 1, lastCol + missing.length).setFontWeight('bold');
  }
}

// =========================================================================
// Deals
// =========================================================================

function listDeals() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEALS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.map(row => rowToObj(row, headers, ['needs']));
}

function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return -1;
}

/**
 * Save call outcome:
 *   - Upsert Deal (one card per client)
 *   - Append new Activity row (history of touches)
 *   - Append new Pain_Quote if pain text provided
 */
function saveCallOutcome(deal) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dealsSheet = ss.getSheetByName(SHEET_DEALS);
  const now = new Date().toISOString();

  // Upsert deal
  if (!deal.id) {
    deal.id = generateId('d');
    deal.created_at = now;
  }
  deal.updated_at = now;

  const targetRow = findRowById(dealsSheet, deal.id);
  if (targetRow < 0 && !deal.created_at) deal.created_at = now;

  const headers = dealsSheet.getRange(1, 1, 1, dealsSheet.getLastColumn()).getValues()[0].map(String);
  const row = headers.map(col => {
    let v = deal[col];
    if (col === 'needs' && Array.isArray(v)) v = JSON.stringify(v);
    if (v === undefined || v === null) v = '';
    return v;
  });

  if (targetRow > 0) {
    dealsSheet.getRange(targetRow, 1, 1, headers.length).setValues([row]);
  } else {
    dealsSheet.appendRow(row);
  }

  // Append activity (one row per call/touch)
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

  // Append pain quote (NEW row each time, не затирает прежние)
  if (deal.pain_quote && String(deal.pain_quote).trim().length > 5) {
    appendQuote(deal, activityId);
  }

  return { deal: deal, activity_id: activityId };
}

function deleteDeal(id) {
  if (!id) return false;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dealsSheet = ss.getSheetByName(SHEET_DEALS);
  const row = findRowById(dealsSheet, id);
  if (row < 0) return false;
  dealsSheet.deleteRow(row);
  removeActivityByDeal(id);
  removeQuotesByDeal(id);
  return true;
}

// =========================================================================
// Activity
// =========================================================================

function addActivity(entry) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ACTIVITY);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
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
  sheet.appendRow(row);
  return true;
}

function listActivityForDeal(dealId) {
  if (!dealId) return [];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ACTIVITY);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const dealIdx = headers.indexOf('deal_id');
  return values
    .filter(row => row[dealIdx] === dealId)
    .map(row => rowToObj(row, headers, []));
}

function removeActivityByDeal(dealId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ACTIVITY);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const dealIds = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (let i = dealIds.length - 1; i >= 0; i--) {
    if (dealIds[i][0] === dealId) {
      sheet.deleteRow(i + 2);
    }
  }
}

// =========================================================================
// Pain quotes — append-only, накопительная история
// =========================================================================

function appendQuote(deal, activityId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUOTES);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
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
  sheet.appendRow(row);
}

function removeQuotesByDeal(dealId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUOTES);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const dealIds = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (let i = dealIds.length - 1; i >= 0; i--) {
    if (dealIds[i][0] === dealId) {
      sheet.deleteRow(i + 2);
    }
  }
}

function listQuotes() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUOTES);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.map(row => rowToObj(row, headers, []));
}

// =========================================================================
// Utils
// =========================================================================

function rowToObj(row, headers, jsonFields) {
  const obj = {};
  headers.forEach((col, i) => {
    let v = row[i];
    if (jsonFields.indexOf(col) !== -1 && typeof v === 'string' && v.length > 0) {
      try { v = JSON.parse(v); } catch (e) { v = v.split(',').map(s => s.trim()); }
    } else if (jsonFields.indexOf(col) !== -1) {
      v = [];
    }
    if (v instanceof Date) v = v.toISOString();
    obj[col] = v;
  });
  return obj;
}

function generateId(prefix) {
  return (prefix || 'x') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}
