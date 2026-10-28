function lookupSetupSecretName(name) {
    const text = String(name);
    if (/token|secret|password|passwd|passphrase|passcode|credential|signature|apikey|accesskey|privatekey|bearer|authorization/.test(text.toLowerCase())) return true;
    const words = text.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/);
    return words.some((word) => /^(?:key|pin|pass|pwd|otp|sig|auth|jwt|hmac|session|cookie)$/.test(word));
}

function lookupSetupMetadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('bad lookup');
    if ('headerValue' in value || 'code' in value || 'setupCode' in value) throw new Error('plaintext lookup');
    if (typeof value.url !== 'string' || value.url.length > 4096 || !value.url.includes('{barcode}')) throw new Error('bad lookup URL');
    const url = value.url.trim();
    const destination = new URL(url);
    if (destination.protocol !== 'https:' || destination.username || destination.password) throw new Error('bad lookup URL');
    if (Array.from(destination.searchParams.keys()).some((name) => lookupSetupSecretName(name))) throw new Error('secret in lookup URL');
    if (typeof value.enabled !== 'boolean' || typeof value.fastMode !== 'boolean') throw new Error('bad lookup flags');
    const headerName = typeof value.headerName === 'string' ? value.headerName.trim() : '';
    if (headerName.length > 128 || (headerName && !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(headerName))) throw new Error('bad lookup header');
    const fields = {};
    for (const name of ['phoneField', 'codField', 'dodField']) {
        const field = value[name];
        if (typeof field !== 'string' || !field.trim() || field.length > 128) throw new Error('bad lookup field');
        fields[name] = field.trim();
    }
    const metadata: any = { url, enabled: value.enabled, fastMode: value.fastMode, headerName, phoneField: fields['phoneField'], codField: fields['codField'], dodField: fields['dodField'] };
    if ('secretParam' in value) {
        if (value.secretParam !== 'key' || headerName || !/(^|\.)script\.google(usercontent)?\.com$/i.test(destination.hostname)) throw new Error('bad lookup secret');
        metadata.secretParam = 'key';
    }
    if ('shop' in value) {
        if (typeof value.shop !== 'string' || value.shop.length > 512) throw new Error('bad lookup shop');
        const target = new URL(value.shop);
        if (target.protocol !== 'https:' || target.username || target.password || target.search || target.pathname !== '/' ||
            !/^#[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.hash)) throw new Error('bad lookup shop');
        metadata.shop = target.origin + target.hash;
    }
    return metadata;
}

function lookupSetupAad(value) {
    return new TextEncoder().encode('zoe-setup-lookup-v1\n' + JSON.stringify(lookupSetupMetadata(value)));
}

export function normalizeSetupLookup(value) {
    const metadata = lookupSetupMetadata(value);
    const sealed = value.keyEnc;
    if (!sealed || sealed.v !== 1 || sealed.iter !== 300000) throw new Error('bad lookup encryption');
    for (const [name, length] of [['salt', 16], ['iv', 12], ['ct', 0]]) {
        const encoded = sealed[name];
        if (typeof encoded !== 'string' || encoded.length > 5500 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('bad lookup encryption');
        const decoded = atob(encoded);
        if (length ? decoded.length !== length : decoded.length < 16 || decoded.length > 4112) throw new Error('bad lookup encryption');
    }
    return Object.assign(metadata, { keyEnc: { v: sealed.v, salt: sealed.salt, iv: sealed.iv, ct: sealed.ct, iter: sealed.iter } });
}

export async function decryptSetupLookup(value, code) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new Error('bad lookup code');
    const normalized = normalizeSetupLookup(value);
    const bytes = (encoded) => Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const sealed = normalized.keyEnc;
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(sealed.salt), iterations: sealed.iter }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(sealed.iv), additionalData: lookupSetupAad(normalized) }, key, bytes(sealed.ct));
    return new TextDecoder().decode(plaintext);
}

export function lookupUrlWithKey(url, key) {
    const hashAt = url.indexOf('#');
    const head = hashAt === -1 ? url : url.slice(0, hashAt);
    return head + (head.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key) + (hashAt === -1 ? '' : url.slice(hashAt));
}

export function lookupUrlSplitKey(url) {
    const raw = String(url || '');
    const found = /([?&])key=([^&#]*)/.exec(raw);
    if (!found) return { url: raw, secret: '' };
    let secret = found[2];
    try { secret = decodeURIComponent(secret.replace(/\+/g, ' ')); } catch (e) {}
    const after = raw.slice(found.index + found[0].length);
    const rest = found[1] === '?' && after.startsWith('&') ? '?' + after.slice(1) : after;
    return { url: raw.slice(0, found.index) + rest, secret };
}
