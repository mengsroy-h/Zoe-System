function doGet(e) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('API_KEY');
  var params = (e && e.parameter) || {};
  var key = params.key || '';
  var code = (params.code || '').toString().trim().toUpperCase();

  if (secret && key !== secret) {
    return jsonResponse({ error: 'unauthorized' });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Customers');
  if (!sheet || !code) {
    return jsonResponse({ found: false });
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ found: false });
  }

  var cache = CacheService.getScriptCache();
  var cacheKey = 'customer_rows';
  var cached = cache.get(cacheKey);
  var rows;
  if (cached) {
    rows = JSON.parse(cached);
  } else {
    rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    cache.put(cacheKey, JSON.stringify(rows), 30);
  }

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var barcode = row[0] ? row[0].toString().trim().toUpperCase() : '';
    if (barcode === code) {
      return jsonResponse({
        found: true,
        barcode: row[0],
        dod: Number(row[1]) || 0,
        cod: Number(row[2]) || 0,
        phone: row[3] ? row[3].toString().trim() : ''
      });
    }
  }

  return jsonResponse({ found: false });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
