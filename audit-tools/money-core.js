// ⛔ ផលិតដោយ `node audit-tools/money-reality-check.js --emit-core ZoeW/dist-audit/ZoeW/app.js audit-tools/money-core.js`
//    (`npm --prefix ZoeW run money:core`) ពីកូដលុយពិតរបស់ ZoeW React — កុំកែដោយដៃ។ `money-reality-test` ធ្លាក់ពេលវាចាស់ជាងកូដ។
const APP_TIME_ZONE = 'Asia/Phnom_Penh';

const APP_TIME_ZONE_OFFSET_MINUTES = 420;

function ledgerNumber(value) {
        const n = parseFloat(value);
        return isFinite(n) ? n : 0;
    }

function statsMonthOf(dateKey) {
        const key = String(dateKey === undefined || dateKey === null ? '' : dateKey);
        return PICKUP_DATE_KEY_PATTERN.test(key) ? key.substring(0, 7) : '';
    }

function statsPositive(value) {
        const n = ledgerNumber(value);
        return n > 0 ? n : 0;
    }

function statsMoney(value) {
        return Math.round(statsPositive(value) * 100) / 100;
    }

function statsCount(value) {
        return Math.round(statsPositive(value));
    }

function countPickedUpCustomers(record) {
        return record && record.pickedUpPhones ? Object.keys(record.pickedUpPhones).length : 0;
    }

function uncollectedBarcodeValue(entry) {
        if (!entry || typeof entry !== 'object') return null;
        return { cod: statsMoney(entry.cod), dod: statsMoney(entry.dod) };
    }

function uncollectedItemValue(item) {
        const out = { cod: 0, dod: 0 };
        if (!item || typeof item !== 'object') return out;
        const add = (source) => {
            const value = uncollectedBarcodeValue(source);
            if (!value) return;
            out.cod += value.cod;
            out.dod += value.dod;
        };
        const entries = (item.barcodes && Array.isArray(item.barcodes)) ? item.barcodes : null;
        if (entries) {
            entries.forEach((b) => { if (b && !b.isClosed && !b.isDeducted) add(b); });
            return out;
        }
        if (!item.isClosed && !item.isDeducted) add(item);
        return out;
    }

function uncollectedValueByDate() {
        const out = {};
        [scanHistory, deletedItems].forEach((list) => {
            if (!Array.isArray(list)) return;
            list.forEach((item) => {
                if (!item || typeof item !== 'object') return;
                const date = String(item.scanDate === undefined || item.scanDate === null ? '' : item.scanDate);
                if (!PICKUP_DATE_KEY_PATTERN.test(date)) return;
                const value = uncollectedItemValue(item);
                if (!value.cod && !value.dod) return;
                const bucket = out[date] || (out[date] = { cod: 0, dod: 0 });
                bucket.cod += value.cod;
                bucket.dod += value.dod;
            });
        });
        return out;
    }

function collectedValueOf(ledgerCod, ledgerDod, uncollected) {
        const open = (uncollected && typeof uncollected === 'object') ? uncollected : {};
        const cod = Math.round(Math.max(0, statsMoney(ledgerCod) - statsMoney(open.cod)) * 100) / 100;
        const dod = Math.round(Math.max(0, statsMoney(ledgerDod) - statsMoney(open.dod)) * 100) / 100;
        return { cod: cod, dod: dod, total: Math.round((cod + dod) * 100) / 100 };
    }

function collectedSetFromRecord(record) {
        const out = {};
        if (!record || typeof record !== 'object') return out;
        Object.keys(record).forEach((key) => {
            const entry = record[key];
            if (!entry || typeof entry !== 'object') return;
            out[key] = { c: statsMoney(entry.c), d: statsMoney(entry.d) };
        });
        return out;
    }

function collectedTotalsOfDay(record) {
        const set = collectedSetFromRecord(record);
        const keys = Object.keys(set);
        let cod = 0;
        let dod = 0;
        keys.forEach((key) => { cod += set[key].c; dod += set[key].d; });
        cod = Math.round(cod * 100) / 100;
        dod = Math.round(dod * 100) / 100;
        return { cod: cod, dod: dod, total: Math.round((cod + dod) * 100) / 100, count: keys.length };
    }

function recalcItemMoneyFromBarcodes(target) {
        target.cod = Math.round(target.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
        target.dod = Math.round(target.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
        target.price = Math.round((target.cod + target.dod) * 100) / 100;
    }

function barcodeRegistryKey(code) {
        const normalized = String(code || '').trim().toUpperCase();
        return normalized.replace(/[.#$\[\]\/\x00-\x1F\x7F]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
    }

function rawSnapshotToItemList(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data.filter(item => item !== null);
        return Object.keys(data).map(key => { const v = data[key]; if (v && !v.id) v.id = key; return v; });
    }

function pickupBarcodeKey(code) {
        const raw = String(code === undefined || code === null ? '' : code).trim();
        return raw ? barcodeRegistryKey(raw) : '';
    }

function collectedMarkValueOf(barcode) {
        return { c: statsMoney(barcode && barcode.cod), d: statsMoney(barcode && barcode.dod) };
    }

function appZoneParts(ms) {
        const at = typeof ms === 'number' ? ms : Number(ms);
        try {
            const parts = {};
            new Intl.DateTimeFormat('en-GB', {
                timeZone: APP_TIME_ZONE, hour12: false,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }).formatToParts(at).forEach((p) => { if (p.type !== 'literal') parts[p.type] = p.value; });
            if (parts.year && parts.month && parts.day) {
                if (parts.hour === '24') parts.hour = '00';
                return parts;
            }
        } catch (e) {}
        const shifted = new Date(at + APP_TIME_ZONE_OFFSET_MINUTES * 60000);
        return {
            year: String(shifted.getUTCFullYear()),
            month: String(shifted.getUTCMonth() + 1).padStart(2, '0'),
            day: String(shifted.getUTCDate()).padStart(2, '0'),
            hour: String(shifted.getUTCHours()).padStart(2, '0'),
            minute: String(shifted.getUTCMinutes()).padStart(2, '0'),
            second: String(shifted.getUTCSeconds()).padStart(2, '0')
        };
    }

function getZoneDateKey(ms, dayOffset) {
        const parts = appZoneParts(ms);
        const base = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
        const shifted = new Date(base + (dayOffset || 0) * 86400000);
        return shifted.getUTCFullYear() + '-'
            + String(shifted.getUTCMonth() + 1).padStart(2, '0') + '-'
            + String(shifted.getUTCDate()).padStart(2, '0');
    }
