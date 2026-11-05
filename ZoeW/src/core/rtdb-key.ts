export const INVALID_KEY_RE = /[[\].#$/\u0000-\u001F\u007F]/;
const INTEGER_REGEXP = /^-?(0*)\d{1,10}$/;
const MAX_KEY_BYTES = 768;

export function utf8Length(text) {
    let n = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c < 0x80) n += 1;
        else if (c < 0x800) n += 2;
        else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
        else n += 3;
    }
    return n;
}

export function isValidKey(key) {
    return typeof key === 'string' && key.length > 0 && !INVALID_KEY_RE.test(key) && utf8Length(key) <= MAX_KEY_BYTES;
}

export function tryParseInt(str) {
    if (INTEGER_REGEXP.test(str)) {
        const n = Number(str);
        if (n >= -2147483648 && n <= 2147483647) return n;
    }
    return null;
}

export function nameCompare(a, b) {
    if (a === b) return 0;
    const ai = tryParseInt(a);
    const bi = tryParseInt(b);
    if (ai !== null) {
        if (bi !== null) return ai - bi === 0 ? a.length - b.length : ai - bi;
        return -1;
    }
    if (bi !== null) return 1;
    return a < b ? -1 : 1;
}
