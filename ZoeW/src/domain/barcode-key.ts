export function canonicalBarcodeRegistryKey(code) {
    const normalized = String(code || '').trim().toUpperCase();
    return normalized.replace(/[%.#$\[\]\/\x00-\x1F\x7F]/g, (character) => '%' + character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
}
