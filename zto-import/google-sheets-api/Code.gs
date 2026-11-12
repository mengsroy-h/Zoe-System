var SCRIPT_VERSION = 3;
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
      var listDod = toMoney(r[1]);
      var listCod = toMoney(r[2]);
      if (listDod === null || listCod === null) return jsonResponse({ error: 'invalid-money' });
      list.push({
        barcode: r[0],
        dod: listDod,
        cod: listCod,
        phone: phoneText(r[3])
      });
    }
    return jsonResponse({ rows: list });
  }

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var barcode = row[0] ? row[0].toString().trim().toUpperCase() : '';
    if (barcode === code) {
      var dod = toMoney(row[1]);
      var cod = toMoney(row[2]);
      if (dod === null || cod === null) return jsonResponse({ error: 'invalid-money' });
      return jsonResponse({
        found: true,
        barcode: row[0],
        dod: dod,
        cod: cod,
        phone: phoneText(row[3])
      });
    }
  }

  return jsonResponse({ found: false });
}

function toMoney(value) {
  if (value === null || value === undefined || value === '') return 0;
  var n;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    var text = value.trim().replace(/^(?:USD|KHR|\$|៛)\s*/i, '').replace(/\s*(?:USD|KHR|\$|៛)$/i, '').trim();
    if (!text) return value.trim() === '' ? 0 : null;
    if (!/^-?(?:[0-9]+(?:[.,][0-9]*)*|[.,][0-9]+)$/.test(text)) return null;
    var negative = text.charAt(0) === '-';
    var body = negative ? text.slice(1) : text;
    var commas = body.split(',').length - 1;
    var dots = body.split('.').length - 1;
    if (commas && dots) {
      var decimal = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',';
      var groups = body.slice(0, body.lastIndexOf(decimal)).split(decimal === '.' ? ',' : '.');
      var fraction = body.slice(body.lastIndexOf(decimal) + 1);
      if (!/^[0-9]{1,3}$/.test(groups[0]) || !groups.slice(1).every(function (part) { return /^[0-9]{3}$/.test(part); }) || !/^[0-9]+$/.test(fraction)) return null;
      body = groups.join('') + '.' + fraction;
    } else if (commas || dots) {
      var parts = body.split(commas ? ',' : '.');
      if (parts.length === 2) {
        if (/^[0-9]{1,3}$/.test(parts[0]) && /^[0-9]{3}$/.test(parts[1])) return null;
        body = (parts[0] || '0') + '.' + (parts[1] || '0');
      } else {
        if (!/^[0-9]{1,3}$/.test(parts[0]) || !parts.slice(1).every(function (part) { return /^[0-9]{3}$/.test(part); })) return null;
        body = parts.join('');
      }
    }
    n = Number(body) * (negative ? -1 : 1);
  } else {
    return null;
  }
  if (!isFinite(n) || !isFinite(n * 100)) return null;
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
