export interface HealthAdvice { level: string; title: string; steps: string[]; healed: string[] }

export const HEALTH_ADVICE_MAX_STEPS = 3;

export const HEALTH_ADVICE_LABELS = {
    network: 'អ៊ីនធឺណិត',
    clock: 'នាឡិកា Server',
    storage: 'ការផ្ទុកក្នុងឧបករណ៍',
    offline: 'របៀបក្រៅបណ្ដាញ',
    table: 'តារាងអតិថិជន',
    script: 'កំណែ Apps Script (Lookup)',
    license: 'អាជ្ញាប័ណ្ណ',
    shop: 'ហាង (Supabase)',
    lookup: 'Lookup អតិថិជន',
    backend: 'Server (Firebase · Supabase)'
};

export const HEALTH_NO_BACKEND_TEXT = 'មិនទាន់កំណត់ Config — App ភ្ជាប់បាន Server ២ ប្រភេទ ៖ Firebase ឬ Supabase (តាមអ្វីដែលអ្នកលក់ផ្តល់)';

function rowKind(row) {
    const label = String(row && row.label || '');
    if (label === HEALTH_ADVICE_LABELS.network) return 'network';
    if (label === HEALTH_ADVICE_LABELS.clock) return 'clock';
    if (label === HEALTH_ADVICE_LABELS.storage) return 'storage';
    if (label === HEALTH_ADVICE_LABELS.offline) return 'offline';
    if (label === HEALTH_ADVICE_LABELS.table) return 'table';
    if (label === HEALTH_ADVICE_LABELS.script) return 'script';
    if (label === HEALTH_ADVICE_LABELS.license || label === HEALTH_ADVICE_LABELS.shop) return 'license';
    if (label.indexOf(HEALTH_ADVICE_LABELS.lookup) === 0) return 'lookup';
    if (label === 'Firebase' || label === 'Supabase' || label === HEALTH_ADVICE_LABELS.backend) return 'database';
    return '';
}

function detailHas(row, text) {
    return String(row && row.detail || '').indexOf(text) !== -1;
}

function databaseStep(row) {
    if (detailHas(row, HEALTH_NO_BACKEND_TEXT)) return 'បើក ☰ ➜ Config / Reconfig ៖ 📷 ស្កេន QR ឬបិទភ្ជាប់ Setup Link ពីអ្នកលក់ (App ស្គាល់ Firebase ឬ Supabase ដោយខ្លួនឯង) · ឬ «✍️ បំពេញ Config ដោយដៃ» ➜ Firebase ៖ Config ពី Firebase Console + Activation Key · Supabase ៖ Project URL + Publishable key រួចចូលគណនីហាង ឬចុះឈ្មោះដោយលេខកូដអញ្ជើញ';
    if (detailHas(row, 'មិនទាន់ភ្ជាប់ម្តងណាទេ')) return 'បើក Config (☰ ➜ Config / Reconfig) ហើយផ្ទៀងផ្ទាត់ Setup Link ឬ QR របស់អ្នកលក់ — App មិនដែលភ្ជាប់ ' + row.label + ' ម្តងណាទេ';
    if (detailHas(row, 'ងាប់ស្ងាត់')) return 'ការតភ្ជាប់ ' + row.label + ' ងាប់ស្ងាត់ — App កំពុងភ្ជាប់ឡើងវិញដោយខ្លួនឯង · បើយូរជាង ១ នាទី សូមទាញចុះ Refresh ម្តង';
    if (detailHas(row, 'មិនទាន់ផ្ទៀងផ្ទាត់')) return 'មានការសរសេរដែលផ្ទៀងផ្ទាត់មិនបាន — សូមទាញចុះ Refresh ដើម្បីឲ្យ App ផ្ទៀងផ្ទាត់ម្តងទៀត · នៅជាប់ដដែល ➜ ផ្ទៀងផ្ទាត់លេខក្នុងតារាង រួច ☰ ឧបករណ៍ ➜ «លុបការសរសេររង់ចាំ» (PIN)';
    if (detailHas(row, 'កំពុងដំណើរការ')) return 'មានការសរសេរកំពុងដំណើរការ — សូមរង់ចាំ ១ ភ្លែត រួចចុច «ពិនិត្យម្តងទៀត» មុនបិទ App';
    if (detailHas(row, 'មិនទាន់មកដល់')) return 'ទិន្នន័យខ្លះមិនទាន់មកដល់ — លេខដែលឃើញអាចមិនទាន់សម័យ · សូមរង់ចាំ ១ ភ្លែត ឬទាញចុះ Refresh';
    return 'ដាច់ការតភ្ជាប់ ' + row.label + ' — App កំពុងភ្ជាប់ឡើងវិញ · សូមរង់ចាំ ឬទាញចុះ Refresh ម្តង';
}

function licenseStep(row) {
    if (row.label === HEALTH_ADVICE_LABELS.shop) {
        return row.state === 'bad'
            ? 'ហាង Supabase ត្រូវបានបិទ ឬផុតកំណត់ — សូមទាក់ទងអ្នកលក់ដើម្បីពន្យារ ឬបើកហាងវិញ (ទិន្នន័យកញ្ចប់មិនត្រូវលុបទេ)'
            : 'មិនទាន់ដឹងស្ថានភាពហាង — សូមចូលប្រព័ន្ធ ហើយភ្ជាប់អ៊ីនធឺណិត រួចពិនិត្យម្តងទៀត';
    }
    if (detailHas(row, 'ជិតផុតកំណត់')) return 'Activation Key ជិតផុតកំណត់ — សូមទាក់ទងអ្នកលក់ដើម្បីពន្យារមុនថ្ងៃផុត (Extend មិនត្រូវការ Activate ឡើងវិញទេ)';
    if (detailHas(row, 'មិនទាន់មាន Activation Key')) return 'ឧបករណ៍នេះគ្មាន Activation Key — សូមសុំ Key ពីអ្នកលក់ រួច Activate (iPhone ៖ ដំឡើង App ទៅ Home Screen មុន Activate)';
    if (row.state === 'bad') return 'អាជ្ញាប័ណ្ណ ៖ ' + String(row.detail || '') + ' — សូមទាក់ទងអ្នកលក់';
    return 'ផ្ទៀងផ្ទាត់ Key មិនបាន (មិនមែន Key ខុសទេ) — សូមភ្ជាប់អ៊ីនធឺណិត រួចពិនិត្យម្តងទៀត';
}

function lookupStep(row) {
    if (detailHas(row, 'បដិសេធ Cookie')) return 'ZTO បដិសេធ Cookie — ចូល Argus លើ Windows រួចរត់ sync-zto-cookie ដើម្បី Sync Cookie ថ្មី · ការស្កេននៅដំណើរការ តែត្រូវវាយលេខទូរស័ព្ទដោយដៃ';
    if (detailHas(row, 'គ្មាន Cookie')) return 'Netlify គ្មាន Cookie ZTO — រត់ sync-zto-cookie លើ Windows ម្តង';
    if (detailHas(row, 'ភ្ជាប់ទៅ Server មិនបាន')) return 'ភ្ជាប់ Server Lookup មិនបាន — ពិនិត្យអ៊ីនធឺណិត · បើបណ្ដាញល្អ សូមប្រាប់អ្នកគ្រប់គ្រង Netlify';
    if (detailHas(row, 'HTTP ')) return 'Server Lookup ឆ្លើយកំហុស — សូមប្រាប់អ្នកគ្រប់គ្រង Netlify ពីលេខ HTTP ក្នុងជួរ Lookup';
    if (detailHas(row, 'វាយ PIN')) return 'វាយ PIN ម្តង (ស្កេនកញ្ចប់ ១ ឬបើកការកំណត់) រួចចុច «ពិនិត្យម្តងទៀត» — Lookup ចាក់សោរហូតដល់ពេលនោះ';
    if (detailHas(row, 'មិនទាន់ដែលប្រើវា')) return 'Cookie មានតែមិនទាន់ផ្ទៀងផ្ទាត់ — ស្កេនកញ្ចប់ ១ រួចពិនិត្យម្តងទៀត';
    if (detailHas(row, 'ចុះហត្ថលេខា')) return 'បញ្ជី «ចុះហត្ថលេខា» ZTO ផ្ញើអត្ថបទខុសពីការកំណត់ Server — ប្រាប់អ្នកគ្រប់គ្រង Netlify ឲ្យកែ ZTO_LIST_SIGNED_SCAN_DESC (ការបិទស្វ័យប្រវត្តិរង់ចាំរហូតដល់ពេលនោះ)';
    if (detailHas(row, 'ស្រាយសោមិនបាន')) return 'ស្រាយសោ Header Lookup មិនបាន — កំណត់ Header ម្តងទៀតក្នុង API ស្វែងរកអតិថិជន';
    if (detailHas(row, 'ZTO នៅ Netlify')) return 'Server ខ្វះការកំណត់ ZTO — ប្រាប់អ្នកគ្រប់គ្រង Netlify ឲ្យដាក់ ZTO_PALM_SESSION_SECRET · ZTO_PALM_SIGN_KEY · ZTO_PALM_PASSWORD_KEY ហើយ redeploy';
    return 'Lookup ៖ ' + String(row.detail || '');
}

function stepFor(row) {
    switch (rowKind(row)) {
        case 'network': return 'ភ្ជាប់ WiFi ឬទិន្នន័យចល័តសិន — ការស្កេនចូលជួររង់ចាំ ហើយ Lookup · ការសរសេរនឹងបន្តដោយខ្លួនឯងពេលបណ្ដាញមកវិញ';
        case 'storage': return 'ពិនិត្យទំហំទំនេរ និងសិទ្ធិ Site data របស់ Browser — បើក App ក្នុងផ្ទាំងធម្មតា ប្រសិនបើរបៀប Private រារាំងការផ្ទុក រួចពិនិត្យម្តងទៀត';
        case 'database': return databaseStep(row);
        case 'license': return licenseStep(row);
        case 'lookup': return lookupStep(row);
        case 'clock': return detailHas(row, 'មិនទាន់ sync')
            ? 'នាឡិកា Server មិនទាន់ sync — ការសម្អាតស្វ័យប្រវត្តិ (២ ម៉ោង · ៨ ថ្ងៃ) ផ្អាកដោយចេតនា · នឹងដើរវិញពេលភ្ជាប់ Server'
            : 'ការសម្អាតស្វ័យប្រវត្តិផ្អាកព្រោះការតភ្ជាប់មិនរស់ — នឹងដើរវិញពេលភ្ជាប់ Server';
        case 'offline': return detailHas(row, 'មិនគាំទ្រ')
            ? 'Browser នេះមិនគាំទ្រ Service Worker — បើកបណ្ដាញដាច់ App នឹងបើកមិនបាន · សូមប្រើ Safari/Chrome ហើយដំឡើង App ទៅ Home Screen'
            : 'សំបក App មិនទាន់ cache — ទាញចុះ Refresh ១ ដងទៀតខណៈមានបណ្ដាញ ដើម្បីឲ្យបើកបានពេលបណ្ដាញដាច់';
        case 'table': return 'តារាងអតិថិជនមិនពេញលេញ — បើក ☰ ➜ តារាងអតិថិជន ដើម្បីទាញមកឡើងវិញ (Lookup តាមបណ្ដាញនៅដើរធម្មតា)';
        case 'script': return detailHas(row, 'ថ្មីជាង')
            ? 'Apps Script ថ្មីជាង App — ទាញ App ចុះឡើងវិញ (Refresh) ដើម្បីទទួលកំណែថ្មី'
            : 'Apps Script ចាស់ជាង App — copy Code.gs ថ្មីចូល script.google.com រួច Deploy ជាកំណែថ្មី';
        default: return '';
    }
}

function healedByNetwork(row, kind) {
    if (kind === 'clock') return true;
    if (kind === 'database') return detailHas(row, 'ដាច់ការតភ្ជាប់ — កំពុងព្យាយាមភ្ជាប់ឡើងវិញ');
    if (kind === 'lookup') return detailHas(row, 'ពិនិត្យមិនបានខណៈក្រៅបណ្ដាញ');
    return false;
}

const HEALED_BY_DATABASE = ['clock'];

export function buildHealthAdvice(rows) {
    const list = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object' && row.state !== 'ok' && row.state !== 'info') : [];
    const kinds = list.map(rowKind);
    const healed = [];
    const suppressed = new Set();
    const networkDown = kinds.indexOf('network') !== -1 && list[kinds.indexOf('network')].state === 'bad';
    const databaseDown = kinds.indexOf('database') !== -1 && list[kinds.indexOf('database')].state === 'bad';
    list.forEach((row, i) => {
        const kind = kinds[i];
        if (networkDown && healedByNetwork(row, kind)) suppressed.add(i);
        else if (databaseDown && kind !== 'database' && HEALED_BY_DATABASE.indexOf(kind) !== -1) suppressed.add(i);
        if (suppressed.has(i)) healed.push(row.label);
    });
    const ranked = list.map((row, i) => ({ row, i, kind: kinds[i], weight: (row.state === 'bad' ? 0 : 10) + (kinds[i] === 'network' ? 0 : kinds[i] === 'storage' ? 1 : kinds[i] === 'database' ? 2 : 3) }))
        .filter((entry) => !suppressed.has(entry.i))
        .sort((a, b) => a.weight - b.weight || a.i - b.i);
    const steps = [];
    for (let k = 0; k < ranked.length && steps.length < HEALTH_ADVICE_MAX_STEPS; k++) {
        const text = stepFor(ranked[k].row);
        if (text && steps.indexOf(text) === -1) steps.push(text);
    }
    const bad = ranked.filter((entry) => entry.row.state === 'bad').length;
    const level = bad ? 'bad' : (ranked.length ? 'warn' : 'ok');
    const title = level === 'ok'
        ? 'ផ្នែកដែលបានវាស់ដំណើរការធម្មតា — សូមមើលព័ត៌មានបន្ថែមក្នុងជួរនីមួយៗ'
        : level === 'bad'
            ? 'មូលហេតុចម្បង ៖ ' + String(ranked[0].row.label) + (ranked.length > 1 ? ' · ធ្វើតាមលំដាប់ខាងក្រោម' : '')
            : 'មាន ' + ranked.length + ' ចំណុចគួរពិនិត្យ — ធ្វើតាមលំដាប់ខាងក្រោម';
    return { level, title, steps, healed };
}
