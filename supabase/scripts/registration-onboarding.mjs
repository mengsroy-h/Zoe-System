import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const PROTOCOL = 'zoe-registration-v1';
const TIMEOUT_MS = 12000;
const MAX_RESPONSE_BYTES = 16384;

function target(projectRef) {
    if (typeof projectRef !== 'string' || !/^[a-z]{20}$/.test(projectRef)) throw Error('project-ref មិនត្រឹមត្រូវ');
    return 'https://' + projectRef + '.supabase.co';
}

export function activationSql(projectRef, verifiedAt) {
    target(projectRef);
    if (!Number.isSafeInteger(verifiedAt) || verifiedAt < 0) throw Error('ពេល preflight មិនត្រឹមត្រូវ');
    const expires = new Date(verifiedAt + 5 * 60 * 1000).toISOString();
    return '-- ពិនិត្យ project នៅ SQL Editor មុន Run: https://supabase.com/dashboard/project/' + projectRef + '/sql/new\n'
        + '-- មិនទាន់បើក registration ទេ។ SQL នេះផុតសុពលភាពនៅ ' + expires + '\n'
        + readFileSync(new URL('./activate-new-project-registration.sql', import.meta.url), 'utf8').replace('__PREFLIGHT_EXPIRES__', expires);
}

async function requestJson(fetcher, url, init) {
    try {
        const signal = AbortSignal.timeout(TIMEOUT_MS);
        const response = await fetcher(url, { ...init, redirect: 'error', signal });
        if (!response.ok) throw Error('HTTP');
        const reader = response.body?.getReader();
        if (!reader) throw Error('body');
        let bytes = 0, text = '';
        const decoder = new TextDecoder('utf-8', { fatal: true });
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                bytes += value.byteLength;
                if (bytes > MAX_RESPONSE_BYTES) throw Error('size');
                text += decoder.decode(value, { stream: true });
            }
            text += decoder.decode();
        } finally {
            reader.cancel().catch(() => undefined);
        }
        return { data: JSON.parse(text), cors: response.headers.get('access-control-allow-origin') };
    } catch {
        throw Error('មិនអាចផ្ទៀងចម្លើយពី project បាន។ មិនបង្កើត SQL និងមិនប្ដូរ Database។');
    }
}

export async function prepareActivation(options, fetcher = fetch) {
    const { projectRef, publishableKey, origin, prepareSql = false } = options;
    const url = target(projectRef);
    if (typeof publishableKey !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(publishableKey)) throw Error('ប្រើតែ publishable key');
    let allowedOrigin = false;
    try { const parsed = new URL(origin); allowedOrigin = parsed.protocol === 'https:' && parsed.origin === origin; } catch {}
    if (!allowedOrigin) throw Error('origin ត្រូវជា HTTPS origin ពេញ គ្មាន path, credentials, query ឬ fragment');
    if (prepareSql && (options.confirmProject !== projectRef || options.confirmAuthSettings !== true || options.confirmNoLegacyRequests !== true)) {
        throw Error('មុនត្រៀម SQL ត្រូវបញ្ជាក់ project, Auth settings និងគ្មាន legacy request នៅសល់');
    }
    const headers = { apikey: publishableKey };
    const { data: settings } = await requestJson(fetcher, url + '/auth/v1/settings', { method: 'GET', headers });
    if (!settings || settings.disable_signup !== true) throw Error('Auth signup មិនទាន់បញ្ជាក់ថាបិទ។ កុំបើក registration។');
    const { data, cors } = await requestJson(fetcher, url + '/functions/v1/register', {
        method: 'POST', headers: { ...headers, origin, 'content-type': 'application/json' }, body: JSON.stringify({ registrationProtocol: PROTOCOL })
    });
    if (!data || Array.isArray(data) || data.ok !== true || data.code !== 'registration-protocol' || data.protocol !== PROTOCOL || typeof data.ready !== 'boolean' || cors !== origin) {
        throw Error('register deployment/protocol/CORS មិនត្រឹមត្រូវ។ កុំបើក registration។');
    }
    return { projectRef, ready: data.ready, sql: prepareSql && !data.ready ? activationSql(projectRef, Date.now()) : null };
}

async function main() {
    const { values } = parseArgs({ options: {
        'project-ref': { type: 'string' }, origin: { type: 'string' }, 'prepare-sql': { type: 'boolean' },
        'confirm-project': { type: 'string' }, 'confirm-auth-settings': { type: 'boolean' }, 'confirm-no-legacy-requests': { type: 'boolean' }
    } });
    const result = await prepareActivation({ projectRef: values['project-ref'], origin: values.origin,
        publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY, prepareSql: values['prepare-sql'], confirmProject: values['confirm-project'],
        confirmAuthSettings: values['confirm-auth-settings'], confirmNoLegacyRequests: values['confirm-no-legacy-requests'] });
    if (result.sql) process.stdout.write(result.sql);
    else console.log(result.ready ? 'Database readiness=true។ មិនប្ដូរអ្វីទេ។ ការចុះឈ្មោះពិតនៅត្រូវសាកដោយឡែក។'
        : 'Preflight ឆ្លង ប៉ុន្តែ registration នៅបិទ។ មិនទាន់អនុវត្ត SQL ឬបង្កើតគណនីទេ។');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        console.error(String(error.code || '').startsWith('ERR_PARSE_ARGS') ? 'argument មិនត្រឹមត្រូវ។ សូមមើល supabase/README.md។' : error.message);
        process.exitCode = 1;
    });
}
