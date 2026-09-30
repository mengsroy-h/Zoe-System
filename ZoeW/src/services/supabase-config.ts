export const SB_LOGIN_DOMAIN_DEFAULT = 'users.zoew.invalid';

export const SB_CONFIG_KEYS = ['supabaseUrl', 'supabaseKey', 'loginDomain'];

export function isSupabaseConfig(cfg) {
    return !!cfg && typeof cfg === 'object' && typeof cfg.supabaseUrl === 'string' && cfg.supabaseUrl.length > 0;
}

export function looksLikeSupabaseConfig(parsed) {
    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed) && ('supabaseUrl' in parsed || 'supabaseKey' in parsed);
}

function jwtRole(key) {
    const parts = String(key).split('.');
    if (parts.length !== 3) return '';
    try {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((parts[1].length + 3) % 4);
        const claims = JSON.parse(atob(b64));
        return claims && typeof claims.role === 'string' ? claims.role : '';
    } catch (e) {
        return '';
    }
}

export function supabaseKeyIsSecret(key) {
    const text = String(key || '').trim();
    return /^sb_secret_/i.test(text) || jwtRole(text) === 'service_role';
}

export function supabaseUrlIsAllowed(url) {
    let parsed;
    try { parsed = new URL(String(url || '')); } catch (e) { return false; }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return false;
    if (parsed.pathname !== '/' && parsed.pathname !== '') return false;
    if (parsed.protocol === 'https:') return true;
    return parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
}

export function normalizeSupabaseConfig(parsed) {
    const config: any = {};
    const extras = [];
    Object.keys(parsed).forEach((key) => {
        const value = parsed[key];
        if (SB_CONFIG_KEYS.indexOf(key) === -1) {
            extras.push(key);
            return;
        }
        if (value === null || value === undefined || value === '') return;
        config[key] = String(value).trim();
    });
    const missing = [];
    if (!config.supabaseUrl) missing.push('supabaseUrl');
    if (!config.supabaseKey) missing.push('supabaseKey');
    if (missing.length) {
        const err: any = new Error('MISSING');
        err.missing = missing;
        throw err;
    }
    if (supabaseKeyIsSecret(config.supabaseKey)) throw new Error('SB_SECRET_KEY');
    if (!supabaseUrlIsAllowed(config.supabaseUrl)) throw new Error('SB_BAD_URL');
    config.supabaseUrl = config.supabaseUrl.replace(/\/+$/, '');
    if (config.loginDomain !== undefined) {
        config.loginDomain = config.loginDomain.toLowerCase();
        if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(config.loginDomain) || !config.loginDomain.endsWith('.invalid')) throw new Error('SB_BAD_DOMAIN');
    }
    return { config, extras };
}

export function supabaseConfigErrorMessage(code) {
    if (code === 'SB_SECRET_KEY') return 'ហាមដាក់ Secret key (sb_secret_… ឬ service_role) ក្នុង App ដាច់ខាត! សូមប្រើ Publishable key (sb_publishable_…) ពី Supabase ➜ Project Settings ➜ API Keys ហើយ Rotate Secret key ដែលលេចនោះភ្លាម។';
    if (code === 'SB_BAD_URL') return 'supabaseUrl ត្រូវជា https://<project>.supabase.co (គ្មាន path ឬ ?query)!';
    if (code === 'SB_BAD_DOMAIN') return 'loginDomain មិនត្រឹមត្រូវទេ — ត្រូវបញ្ចប់ដោយ .invalid ហើយដូច ZOE_LOGIN_DOMAIN របស់ Edge Function (ឧ. users.zoew.invalid)!';
    return '';
}
