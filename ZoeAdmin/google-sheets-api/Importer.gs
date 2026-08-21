var IMPORT_TARGET_SHEET = 'Customers';
var IMPORT_RAW_SHEET = 'Raw';
var IMPORT_CACHE_KEY = 'customer_rows';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ZTO Import')
    .addItem('នាំចូល ZTO (Raw ➜ Customers)', 'importZtoExport')
    .addItem('នាំចូល ZTO (ជំនួសទាំងអស់)', 'importZtoExportReplace')
    .addToUi();
}

function importZtoExport() {
  runZtoImport(false);
}

function importZtoExportReplace() {
  runZtoImport(true);
}

function runZtoImport(replaceAll) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var raw = ss.getSheetByName(IMPORT_RAW_SHEET);
  if (!raw) {
    var active = ss.getActiveSheet();
    if (active && active.getName() !== IMPORT_TARGET_SHEET) {
      raw = active;
    }
  }
  if (!raw) {
    ui.alert('រកមិនឃើញ sheet "Raw" ទេ។ សូម File ➜ Import file export ZTO ចូល sheet ឈ្មោះ "Raw" ជាមុនសិន។');
    return;
  }

  var values = raw.getDataRange().getValues();
  if (values.length < 2) {
    ui.alert('sheet "' + raw.getName() + '" គ្មានទិន្នន័យទេ។');
    return;
  }

  var headerInfo = findHeaderRow_(values);
  var headerRow = headerInfo.row;
  var dataRows = values.slice(headerInfo.index + 1);

  var cols = detectColumns_(headerRow, dataRows);
  if (cols.barcode < 0 || cols.phone < 0) {
    ui.alert(
      'មិនអាចរកជួរ Barcode និង/ឬ Phone ដោយប្រាកដទេ។\n' +
      'រកឃើញ: barcode=' + describeCol_(headerRow, cols.barcode) +
      ', phone=' + describeCol_(headerRow, cols.phone) +
      ', cod=' + describeCol_(headerRow, cols.cod) +
      ', dod=' + describeCol_(headerRow, cols.dod) +
      '\nសូមពិនិត្យ header ក្នុង sheet "' + raw.getName() + '" ម្តងទៀត។'
    );
    return;
  }

  var upserts = {};
  var order = [];
  var skipped = 0;
  for (var i = 0; i < dataRows.length; i++) {
    var r = dataRows[i];
    var barcode = cleanBarcode_(r[cols.barcode]);
    if (!barcode) { skipped++; continue; }
    var rec = {
      barcode: barcode,
      dod: cols.dod >= 0 ? parseMoney_(r[cols.dod]) : 0,
      cod: cols.cod >= 0 ? parseMoney_(r[cols.cod]) : 0,
      phone: normalizePhone_(r[cols.phone])
    };
    if (!(barcode in upserts)) order.push(barcode);
    upserts[barcode] = rec;
  }

  var target = ss.getSheetByName(IMPORT_TARGET_SHEET);
  if (!target) target = ss.insertSheet(IMPORT_TARGET_SHEET);

  var existing = {};
  var existingOrder = [];
  if (!replaceAll && target.getLastRow() >= 2) {
    var cur = target.getRange(2, 1, target.getLastRow() - 1, 4).getValues();
    for (var j = 0; j < cur.length; j++) {
      var b = cur[j][0] ? cur[j][0].toString().trim() : '';
      if (!b) continue;
      existing[b] = { barcode: b, dod: Number(cur[j][1]) || 0, cod: Number(cur[j][2]) || 0, phone: cur[j][3] ? cur[j][3].toString().trim() : '' };
      existingOrder.push(b);
    }
  }

  var added = 0, updated = 0;
  for (var k = 0; k < order.length; k++) {
    var bc = order[k];
    if (bc in existing) { updated++; } else { existingOrder.push(bc); added++; }
    existing[bc] = upserts[bc];
  }

  var out = [];
  for (var m = 0; m < existingOrder.length; m++) {
    var e = existing[existingOrder[m]];
    out.push([e.barcode, e.dod, e.cod, e.phone]);
  }

  target.clearContents();
  target.getRange(1, 1, 1, 4).setValues([['Barcode', 'DOD($)', 'COD($)', 'Phone']]);
  target.getRange('A:A').setNumberFormat('@');
  target.getRange('D:D').setNumberFormat('@');
  if (out.length > 0) {
    target.getRange(2, 1, out.length, 4).setValues(out);
  }

  CacheService.getScriptCache().remove(IMPORT_CACHE_KEY);

  ui.alert(
    'នាំចូលរួចរាល់!\n' +
    'ថ្មី: ' + added + ' ជួរ\n' +
    'ធ្វើបច្ចុប្បន្នភាព: ' + updated + ' ជួរ\n' +
    'រំលង (គ្មាន barcode): ' + skipped + ' ជួរ\n' +
    'សរុបក្នុង Customers: ' + out.length + ' ជួរ\n' +
    (replaceAll ? '(របៀប: ជំនួសទាំងអស់)' : '(របៀប: បញ្ចូល/ធ្វើបច្ចុប្បន្នភាព)')
  );
}

function findHeaderRow_(values) {
  var scan = Math.min(values.length, 5);
  for (var i = 0; i < scan; i++) {
    var row = values[i];
    var joined = row.map(function (c) { return (c === null || c === undefined) ? '' : c.toString().toLowerCase(); }).join(' ');
    if (/barcode|单号|运单|mailno|waybill|tracking|面单/.test(joined) &&
        /phone|电话|手机|tel|mobile|contact|លេខ/.test(joined)) {
      return { row: row, index: i };
    }
  }
  return { row: values[0], index: 0 };
}

function detectColumns_(headerRow, dataRows) {
  var n = headerRow.length;
  var cols = { barcode: -1, phone: -1, cod: -1, dod: -1 };

  for (var c = 0; c < n; c++) {
    var h = (headerRow[c] === null || headerRow[c] === undefined) ? '' : headerRow[c].toString().toLowerCase().trim();
    if (cols.barcode < 0 && /barcode|单号|运单|mailno|waybill|tracking|面单|bill/.test(h)) cols.barcode = c;
    if (cols.phone < 0 && /phone|电话|手机|tel|mobile|contact|លេខ/.test(h)) cols.phone = c;
  }

  for (var d = 0; d < n; d++) {
    if (d === cols.barcode || d === cols.phone) continue;
    var hd = (headerRow[d] === null || headerRow[d] === undefined) ? '' : headerRow[d].toString().toLowerCase().trim();
    if (cols.dod < 0 && /dod|到付/.test(hd)) cols.dod = d;
    else if (cols.cod < 0 && /cod|代收/.test(hd)) cols.cod = d;
  }

  if (cols.barcode < 0 || cols.phone < 0) {
    var scores = [];
    for (var col = 0; col < n; col++) scores.push(scoreColumn_(dataRows, col));
    if (cols.barcode < 0) cols.barcode = bestCol_(scores, 'barcode', [cols.phone, cols.cod, cols.dod]);
    if (cols.phone < 0) cols.phone = bestCol_(scores, 'phone', [cols.barcode, cols.cod, cols.dod]);
  }
  return cols;
}

function scoreColumn_(dataRows, col) {
  var phoneHits = 0, barcodeHits = 0, total = 0;
  var limit = Math.min(dataRows.length, 40);
  for (var i = 0; i < limit; i++) {
    var v = dataRows[i][col];
    if (v === null || v === undefined || v.toString().trim() === '') continue;
    total++;
    var d = v.toString().replace(/\D/g, '');
    if (!d) continue;
    if (d.length >= 12 && d.length <= 16) barcodeHits++;
    var pd = d;
    if (pd.indexOf('855') === 0) pd = pd.substring(3);
    if (pd.length >= 8 && pd.length <= 10) phoneHits++;
  }
  return { phone: total ? phoneHits / total : 0, barcode: total ? barcodeHits / total : 0 };
}

function bestCol_(scores, kind, exclude) {
  var best = -1, bestVal = 0.5;
  for (var c = 0; c < scores.length; c++) {
    if (exclude.indexOf(c) >= 0) continue;
    if (scores[c][kind] > bestVal) { bestVal = scores[c][kind]; best = c; }
  }
  return best;
}

function describeCol_(headerRow, idx) {
  if (idx < 0) return '(រកមិនឃើញ)';
  var h = headerRow[idx];
  return '#' + (idx + 1) + ' "' + (h === null || h === undefined ? '' : h) + '"';
}

function cleanBarcode_(v) {
  if (v === null || v === undefined) return '';
  return v.toString().replace(/\s+/g, '').trim();
}

function normalizePhone_(v) {
  if (v === null || v === undefined) return '';
  var d = v.toString().replace(/\D/g, '');
  if (!d) return '';
  if (d.indexOf('855') === 0) d = d.substring(3);
  if (d.charAt(0) !== '0') d = '0' + d;
  return d;
}

function parseMoney_(v) {
  if (v === null || v === undefined || v === '') return 0;
  var num = parseFloat(v.toString().replace(/[^0-9.\-]/g, ''));
  return isNaN(num) ? 0 : num;
}
