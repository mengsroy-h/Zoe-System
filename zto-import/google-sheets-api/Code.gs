var SCRIPT_VERSION = 2;
var CACHE_TTL_SECONDS = 60;
var CACHE_KEY_PREFIX = 'customer_rows_v2_';

function doGet(e) {
  var props = PropertiesService.getScriptProperties();
  var secret = (props.getProperty('API_KEY') || '').trim();
  var params = (e && e.parameter) || {};
  var key = params.key || '';
  var code = (params.code || '').toString().trim().toUpperCase();

  if (!secret) {
    return jsonResponse({ error: 'API_KEY script property is not set - see step 2.3 in README.md' });
  }
  if (key !== secret) {
    return jsonResponse({ error: 'unauthorized' });
  }

  var isList = params.list === '1' || params.list === 'true';
  var wantsFresh = params.fresh === '1' || params.fresh === 'true';

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Customers');
  if (!sheet) {
    return jsonResponse({ error: 'sheet-missing: tab Customers not found' });
  }
  if (!code && !isList) {
    return jsonResponse({ found: false });
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return isList ? jsonResponse({ rows: [] }) : jsonResponse({ found: false });
  }

  var cache = CacheService.getScriptCache();
  var cacheKey = CACHE_KEY_PREFIX + lastRow;
  var cached = wantsFresh ? null : cache.get(cacheKey);
  var rows;
  if (cached) {
    try {
      rows = JSON.parse(cached);
      if (!Array.isArray(rows)) rows = null;
    } catch (e) {
      rows = null;
      try {
        cache.remove(cacheKey);
      } catch (ignore) {
      }
    }
  }
  if (!rows) {
    rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    var serializedRows = JSON.stringify(rows);
    var serializedBytes = Utilities.newBlob(serializedRows).getBytes().length;
    if (serializedBytes <= 90000) {
      try {
        cache.put(cacheKey, serializedRows, CACHE_TTL_SECONDS);
      } catch (e) {
      }
    }
  }

  if (isList) {
    var list = [];
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j];
      if (!r[0]) continue;
      list.push({
        barcode: r[0],
        dod: toMoney(r[1]),
        cod: toMoney(r[2]),
        phone: phoneText(r[3])
      });
    }
    return jsonResponse({ rows: list });
  }

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var barcode = row[0] ? row[0].toString().trim().toUpperCase() : '';
    if (barcode === code) {
      return jsonResponse({
        found: true,
        barcode: row[0],
        dod: toMoney(row[1]),
        cod: toMoney(row[2]),
        phone: phoneText(row[3])
      });
    }
  }

  return jsonResponse({ found: false });
}

function toMoney(value) {
  if (value === null || value === undefined || value === '') return 0;
  var n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function phoneText(value) {
  var text = value === null || value === undefined ? '' : value.toString().trim();
  return /\d/.test(text) ? text : '';
}

function jsonResponse(obj) {
  var payload = obj || {};
  payload.scriptVersion = SCRIPT_VERSION;
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
