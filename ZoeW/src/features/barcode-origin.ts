import { dataState, firebaseState, ztoState } from '../core/state';
import { itemHasRestoreMarkers } from '../domain/barcode';
import { barcodeRegistryKey } from '../domain/registry';
import { dbOp, dbOpStalled } from '../services/network';

export const ORIGIN_TEXT_MAX = 64;

const ORIGIN_CONTROL_RE = /[\u0000-\u001F\u007F]/g;

export function originText(raw) {
    if (typeof raw !== 'string') return '';
    return raw.replace(ORIGIN_CONTROL_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, ORIGIN_TEXT_MAX).trim();
}

export const ORIGIN_COUNTRIES = [
    { site: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ', flag: '🇨🇳', name: 'ចិន' },
    { site: 'Shopee SHPE', flag: '🇻🇳', name: 'វៀតណាម' }
];

export function originLabel(raw) {
    const text = originText(raw);
    if (!text) return { icon: '', name: '', short: '', full: '' };
    const key = text.toLowerCase();
    const country = ORIGIN_COUNTRIES.find((c) => c.site.toLowerCase() === key);
    if (!country) return { icon: '📍', name: text, short: '📍 ' + text, full: '📍 ' + text };
    const short = country.flag + ' ' + country.name;
    return { icon: country.flag, name: country.name, short: short, full: short + ' · ' + text };
}

export function itemOriginOf(item, code) {
    if (!item || !item.origins || typeof item.origins !== 'object' || Array.isArray(item.origins)) return '';
    const key = barcodeRegistryKey(code);
    return key ? originText(item.origins[key]) : '';
}

export function itemOriginSummary(item) {
    const counts = new Map();
    const barcodes = item && Array.isArray(item.barcodes) ? item.barcodes : [];
    for (let i = 0; i < barcodes.length; i++) {
        const b = barcodes[i];
        if (!b || b.isDeducted) continue;
        const text = itemOriginOf(item, b.code);
        if (text) counts.set(text, (counts.get(text) || 0) + 1);
    }
    if (!counts.size) return { icon: '', text: '', full: '', more: 0 };
    let best = '';
    let bestCount = 0;
    counts.forEach((n, text) => {
        if (n > bestCount) { best = text; bestCount = n; }
    });
    const label = originLabel(best);
    return { icon: label.icon, text: label.name, full: label.full, more: counts.size - 1 };
}

function historyItemOwning(code) {
    const key = barcodeRegistryKey(code);
    if (!key) return null;
    const list = dataState.scanHistory || [];
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || !item.id || !Array.isArray(item.barcodes)) continue;
        if (item.barcodes.some((b) => b && barcodeRegistryKey(b.code) === key)) return item;
    }
    return null;
}

export function barcodeOriginWrites(entries) {
    const writes = [];
    const seen = new Set();
    const list = Array.isArray(entries) ? entries : [];
    for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        const text = originText(entry && entry.from);
        const key = barcodeRegistryKey(entry && entry.code);
        if (!text || !key || seen.has(key)) continue;
        const item = historyItemOwning(entry.code);
        if (!item || !/^[a-zA-Z0-9_-]+$/.test(item.id)) continue;
        if (itemOriginOf(item, entry.code) === text) continue;
        seen.add(key);
        writes.push({ itemId: item.id, key: key, text: text });
    }
    return writes;
}

export function applyBarcodeOrigins(current, wanted) {
    if (!current || typeof current !== 'object' || !Array.isArray(current.barcodes) || !current.barcodes.length) return undefined;
    if (itemHasRestoreMarkers(current) || current.clearClaim) return undefined;
    const present = new Set(current.barcodes.filter(Boolean).map((b) => barcodeRegistryKey(b.code)));
    const origins = current.origins && typeof current.origins === 'object' && !Array.isArray(current.origins) ? { ...current.origins } : {};
    let changed = false;
    Object.keys(wanted || {}).forEach((key) => {
        if (!present.has(key) || origins[key] === wanted[key]) return;
        origins[key] = wanted[key];
        changed = true;
    });
    if (!changed) return undefined;
    current.origins = origins;
    return current;
}

export async function saveBarcodeOrigins(entries) {
    const api = firebaseState.fb;
    const targetDb = firebaseState.db;
    if (!api || !targetDb || typeof api.runTransaction !== 'function' || typeof api.ref !== 'function') return 0;
    if (ztoState.ztoOriginRefusedDb && ztoState.ztoOriginRefusedDb === targetDb) return 0;
    const sessionAtStart = firebaseState.authGeneration;
    const writes = barcodeOriginWrites(entries);
    if (!writes.length) return 0;
    const current = () => firebaseState.db === targetDb && firebaseState.authGeneration === sessionAtStart;
    const byItem = new Map();
    writes.forEach((w) => {
        if (!byItem.has(w.itemId)) byItem.set(w.itemId, {});
        byItem.get(w.itemId)[w.key] = w.text;
    });
    let written = 0;
    let refused = 0;
    let tried = 0;
    for (const [itemId, wanted] of byItem) {
        if (!current()) return written;
        tried++;
        let result = null;
        try {
            result = await dbOp(api.runTransaction(api.ref(targetDb, 'zoew_scan_history_cod_dod/' + itemId),
                (snapshotItem) => applyBarcodeOrigins(snapshotItem, wanted)), 'Origin write stalled');
        } catch (e) {
            if (!current()) return written;
            if (dbOpStalled(e)) return written;
            if (/permission/i.test(String((e && (e.code || e.message)) || e))) refused++;
            continue;
        }
        if (!current()) return written;
        if (result && result.committed) written += Object.keys(wanted).length;
    }
    if (!written && refused && refused === tried && current()) ztoState.ztoOriginRefusedDb = targetDb;
    return written;
}
