export function sheetImportMoneyShape(value): any {
    if (typeof value !== 'string') return null;
    let text = value.trim().replace(/[០-៩]/g, function (digit) { return String(digit.charCodeAt(0) - 0x17e0); });
    if (!text) return { text: '0', mark: '', negative: false };
    let excelText = /^="([^"]*)"$/.exec(text);
    if (excelText) text = excelText[1].trim();
    let currencyPrefix = /^(-?)(?:USD|\$)\s*/i.exec(text);
    text = currencyPrefix ? currencyPrefix[1] + text.slice(currencyPrefix[0].length) : text.replace(/\s*(?:USD|\$)$/i, '');
    text = text.trim();
    if (/[ \u00a0\u202f]/.test(text)) {
        if (!/^-?[0-9]{1,3}(?:[ \u00a0\u202f][0-9]{3})+(?:[.,][0-9]+)?$/.test(text)) return null;
        text = text.replace(/[ \u00a0\u202f]/g, '');
    }
    if (!/^-?(?:[0-9]+(?:[.,][0-9]*)*|[.,][0-9]+)$/.test(text)) return null;
    let negative = text.charAt(0) === '-';
    let body = negative ? text.slice(1) : text;
    if (!/[0-9]/.test(body)) return null;
    if (body.indexOf('-') !== -1) return null;
    let commas = body.split(',').length - 1;
    let dots = body.split('.').length - 1;
    let shape = null;
    if (!commas && !dots) {
        shape = { text: body, mark: '' };
    } else if (!commas || !dots) {
        let sep = commas ? ',' : '.';
        let parts = body.split(sep);
        if (parts.length === 2) {
            let whole = parts[0];
            let fraction = parts[1];
            if (/^[0-9]{1,3}$/.test(whole) && /^[0-9]{3}$/.test(fraction)) {
                shape = sep === '.'
                    ? { dot: whole + '.' + fraction, comma: whole + fraction }
                    : { dot: whole + fraction, comma: whole + '.' + fraction };
            } else {
                shape = { text: (whole || '0') + '.' + (fraction || '0'), mark: fraction ? sep : '' };
            }
        } else if (/^[0-9]{1,3}$/.test(parts[0]) && parts.slice(1).every(function (part) { return /^[0-9]{3}$/.test(part); })) {
            shape = { text: parts.join(''), mark: sep === '.' ? ',' : '.' };
        }
    } else {
        let decimal = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',';
        let groups = body.slice(0, body.lastIndexOf(decimal)).split(decimal === '.' ? ',' : '.');
        let tail = body.slice(body.lastIndexOf(decimal) + 1);
        if (/^[0-9]{1,3}$/.test(groups[0]) && groups.slice(1).every(function (part) { return /^[0-9]{3}$/.test(part); }) && /^[0-9]*$/.test(tail)) {
            shape = { text: groups.join('') + '.' + (tail || '0'), mark: decimal };
        }
    }
    if (shape) shape.negative = negative;
    return shape;
}
export function sheetImportStrictMoney(value, decimalMark) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isSafeInteger(Math.round(value * 100)) ? Math.round(value * 100) / 100 : null;
    let shape = sheetImportMoneyShape(value);
    if (!shape) return null;
    let text = shape.text;
    if (text === undefined) text = decimalMark === '.' ? shape.dot : decimalMark === ',' ? shape.comma : undefined;
    if (text === undefined) return null;
    let n = parseFloat(text);
    let cents = Math.round((shape.negative ? -n : n) * 100);
    return Number.isSafeInteger(cents) ? cents / 100 : null;
}
export function sheetImportMoneyDecimalMark(values) {
    let seen = '';
    for (let i = 0; i < values.length; i++) {
        if (typeof values[i] !== 'string' || values[i] === '') continue;
        let shape = sheetImportMoneyShape(values[i]);
        let mark = shape ? shape.mark : '';
        if (!mark) continue;
        if (seen && seen !== mark) return '';
        seen = mark;
    }
    return seen;
}
function detectDelimitedTextSeparator(text) {
    let sample = String(text).slice(0, 1024), candidates = [',', '\t', ';', '|'];
    let counts = [0, 0, 0, 0], quoted = false;
    for (let i = 0; i < sample.length; i++) {
        let ch = sample.charAt(i);
        if (ch === '"') quoted = !quoted;
        else if (!quoted) {
            let at = candidates.indexOf(ch);
            if (at >= 0) counts[at]++;
        }
    }
    let best = 0;
    for (let j = 1; j < candidates.length; j++) if (counts[j] > counts[best]) best = j;
    return candidates[best];
}

export function validateDelimitedTextQuotes(text, delimiterHint) {
    let body = String(text).replace(/^\uFEFF/, '');
    let hint = /^sep=([^\r\n])(\r\n|\r|\n)/i.exec(body);
    let delimiter = hint ? hint[1] : delimiterHint;
    if (hint) body = body.slice(hint[0].length);
    if (!delimiter) delimiter = detectDelimitedTextSeparator(body);
    let quoted = false, fieldStart = true;
    for (let i = 0; i < body.length; i++) {
        let ch = body.charAt(i);
        if (quoted) {
            if (ch === '"' && body.charAt(i + 1) === '"') i++;
            else if (ch === '"') quoted = false;
        } else if (ch === '"' && fieldStart) {
            quoted = true;
            fieldStart = false;
        } else if (ch === delimiter || ch === '\r' || ch === '\n') fieldStart = true;
        else fieldStart = false;
    }
    if (quoted) throw new Error('CSV មានសញ្ញាដកស្រង់បើកដែលមិនទាន់បិទ — មិនទាន់សរសេរអ្វីទេ');
    return delimiter;
}

export function validateSheetImportDelimitedBytes(bytes: Uint8Array, filename: string): string | undefined {
    const container = (bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0);
    if (container) return;
    const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
    const text = new TextDecoder(encoding).decode(bytes);
    if (!/^\s*</.test(text)) return validateDelimitedTextQuotes(text, /\.tsv$/i.test(filename || '') ? '\t' : '');
}
