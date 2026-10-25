'use strict';
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const HOSTS = new Set(['zto-haiwai2025.oss-cn-hongkong.aliyuncs.com', 'zt-haiwai.oss-cn-hongkong.aliyuncs.com']);
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REFS = 4;
const TIMEOUT_MS = 8000;
let active = 0;
const unknown = reason => ({ verified: false, reason });

function safeUrl(ref, barcode) {
    if (!ref || !['web', 'palm'].includes(ref.source) || ref.barcode !== barcode || ref.kind !== 'receipt' || ref.picType !== 1 || typeof ref.url !== 'string' || ref.url.length > 8192) return null;
    const match = /^(https?):\/\/([^/?#]+)(\/[^?#]*)(\?[^#]*)?$/.exec(ref.url);
    if (!match || /[\s\\\x00-\x1f\x7f]/.test(ref.url) || !HOSTS.has(match[2])) return null;
    const path = new RegExp('^/track/shortterm/bill/1/[0-9]{4}(?:0[1-9]|1[0-2])/' + barcode + '_[0-9]+\\.jpg$');
    if (!path.test(match[3])) return null;
    const url = 'https://' + match[2] + match[3] + (match[4] || '');
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.hash || parsed.href !== url) return null;
        return url;
    } catch { return null; }
}

function jpegStructure(bytes) {
    if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return false;
    let pos = 2, frame = false, scan = false;
    while (pos < bytes.length) {
        if (bytes[pos++] !== 255) return false;
        while (bytes[pos] === 255) pos++;
        const marker = bytes[pos++];
        if (marker === 217) return frame && scan && pos === bytes.length;
        if (!marker || marker === 216 || (marker >= 208 && marker <= 215)) return false;
        if (pos + 2 > bytes.length) return false;
        const length = bytes.readUInt16BE(pos);
        if (length < 2 || pos + length > bytes.length) return false;
        if ([192, 193, 194].includes(marker)) {
            if (length < 11 || !bytes.readUInt16BE(pos + 3) || !bytes.readUInt16BE(pos + 5) || length !== 8 + 3 * bytes[pos + 7]) return false;
            frame = true;
        }
        if (marker === 218) {
            if (!frame || length < 8 || length !== 6 + 2 * bytes[pos + 2]) return false;
            scan = true;
            pos += length;
            while (pos < bytes.length) {
                if (bytes[pos] !== 255) { pos++; continue; }
                if (bytes[pos + 1] === 0 || (bytes[pos + 1] >= 208 && bytes[pos + 1] <= 215)) { pos += 2; continue; }
                break;
            }
        } else pos += length;
    }
    return false;
}

async function verifyReceiptPhoto(input, fetchImpl = globalThis.fetch) {
    if (!input || input.authenticated !== true || typeof input.barcode !== 'string' || !/^[A-Z0-9]{4,40}$/.test(input.barcode) || typeof input.expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.expectedSha256) || !Array.isArray(input.receiptRefs) || !input.receiptRefs.length || input.receiptRefs.length > MAX_REFS) return unknown('invalid_input');
    const refs = Array.from(input.receiptRefs, (ref, index) => ({ url: safeUrl(ref, input.barcode), index }));
    if (refs.some(ref => !ref.url)) return unknown('invalid_reference');
    if (active >= 2) return unknown('busy');
    if (typeof fetchImpl !== 'function') return unknown('unavailable');
    const expectedSha256 = input.expectedSha256;
    active++;
    const controller = new AbortController();
    const deadline = performance.now() + TIMEOUT_MS;
    const expired = () => { if (performance.now() >= deadline) controller.abort(); return controller.signal.aborted; };
    let reader = null;
    const cleanups = new Map();
    const cancel = (target = reader) => {
        if (!target) return Promise.resolve();
        if (!cleanups.has(target)) cleanups.set(target, Promise.resolve().then(() => target.cancel()).catch(() => {}));
        return cleanups.get(target);
    };
    let timer;
    const timeout = new Promise(resolve => { timer = setTimeout(() => { controller.abort(); cancel(); resolve(unknown('timeout')); }, TIMEOUT_MS); });
    const work = async () => {
        const seen = new Set();
        const failures = new Set();
        for (const ref of refs) {
            if (expired()) return unknown('timeout');
            if (seen.has(ref.url)) continue;
            seen.add(ref.url);
            try {
                const response = await fetchImpl(ref.url, { method: 'GET', headers: {}, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store', signal: controller.signal });
                if (expired()) { await cancel(response?.body); return unknown('timeout'); }
                if (!response || response.status !== 200 || response.redirected || (response.url && response.url !== ref.url) || !response.body) { failures.add('not_verified'); await cancel(response?.body); continue; }
                const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
                const length = response.headers.get('content-length');
                const declared = length === null ? null : (/^[0-9]+$/.test(length) ? Number(length) : NaN);
                if (!['image/jpeg', 'application/octet-stream'].includes(type)) { failures.add('unsupported_content_type'); await cancel(response.body); continue; }
                if (declared !== null && (!Number.isSafeInteger(declared) || declared < 1 || declared > MAX_BYTES)) { failures.add('not_verified'); await cancel(response.body); continue; }
                reader = response.body.getReader();
                const chunks = [];
                let size = 0;
                while (!expired()) {
                    const chunk = await reader.read();
                    if (expired()) return unknown('timeout');
                    if (chunk.done) break;
                    if (!(chunk.value instanceof Uint8Array) || !chunk.value.byteLength || size + chunk.value.byteLength > MAX_BYTES || chunks.length >= 4096) { controller.abort(); cancel(); return unknown('body_limit'); }
                    size += chunk.value.byteLength;
                    chunks.push(Buffer.from(chunk.value));
                }
                if (expired()) return unknown('timeout');
                reader = null;
                if (!size || (declared !== null && size !== declared)) { failures.add('not_verified'); continue; }
                const bytes = Buffer.concat(chunks, size);
                if (!jpegStructure(bytes)) { failures.add('invalid_image'); continue; }
                if (expired()) return unknown('timeout');
                const actualSha256 = createHash('sha256').update(bytes).digest('hex');
                if (expired()) return unknown('timeout');
                if (actualSha256 === expectedSha256) return { verified: true, reason: 'exact_match', matchedRefIndex: ref.index };
                failures.add('hash_mismatch');
            } catch { failures.add('not_verified'); await cancel(); reader = null; }
        }
        return unknown(['not_verified', 'hash_mismatch', 'invalid_image', 'unsupported_content_type'].find(reason => failures.has(reason)) || 'not_verified');
    };
    const pending = work().finally(async () => { cancel(); await Promise.all(cleanups.values()); active--; });
    try {
        const result = await Promise.race([pending, timeout]);
        return result.verified && expired() ? unknown('timeout') : result;
    }
    finally { clearTimeout(timer); controller.abort(); cancel(); }
}
module.exports = { verifyReceiptPhoto };
