// ⛔ ថ្នាក់កំហុស ៖ **Service Worker មិនបញ្ជូនសញ្ញា abort បន្ត** ➜ ការ
// ចាកចេញពីទំព័រ (back · PTR reload · ការចុចតំណថ្មីលឿន) បន្សល់សំណើបណ្តាញ
// ដែលនៅរស់រហូតដល់ពិដាន ២០ វិ. ➜ លើបណ្តាញខ្សោយ វាស៊ីកូតាការតភ្ជាប់ដែល
// សំណើចាំបាច់ត្រូវការ ហើយ `respondWith` កាន់ promise ព្យួរ។
//
// 🔴 **ចន្លោះដែលជំនាន់មុនមិនឃើញ (វាស់បាន 2.37.3)** ៖ ជំនាន់មុនហៅ
// `timedFetch(request)` **ដោយផ្ទាល់** ➜ វាចាក់សោ *helper* ប៉ុណ្ណោះ។ តែ
// ការសម្រេចថា «អ្វីត្រូវបញ្ជូនចូល `timedFetch`» ឋិតនៅក្នុង **handler
// `fetch` ពិត** ៖
//     const networkTarget  = request.mode === 'navigate' ? cacheKey : request;
//     const networkOptions = request.mode === 'navigate' ? { signal: request.signal } : undefined;
// លើផ្លូវ navigate គោលដៅជា **ខ្សែអក្សរ** (`'./index.html'`) ➜ ខ្សែអក្សរ
// គ្មាន `.signal` ➜ **ផ្លូវតែមួយ** ដែល abort របស់អ្នកប្រើឡើងដល់បណ្តាញគឺ
// `networkOptions`។ ការដក `{ signal: request.signal }` ចេញ ធ្វើឲ្យ
// ថ្នាក់នេះវិលមកតាម **ទ្វារថ្មី** ដោយស្ងាត់ — វាស់បាន ៖ mutation នោះ
// **រស់រានលើ checker ១៧២ ទាំងអស់** រួមទាំងឯកសារនេះខ្លួនឯង។
//
// ⛔ ដូច្នេះការវាស់ត្រូវ **បើក handler ពិត** មិនមែនត្រឹម helper ៖ ចុះឈ្មោះ
// `fetch` event · បាញ់ `respondWith` · រួច abort ➜ signal ដែល `fetch()`
// ទទួល ត្រូវតែជា signal ដែល **abort រួច**។
// ⛔ ហើយវាត្រូវមាន **ទិសផ្ទុយ** ៖ សំណើដែល *មិន* ត្រូវ abort មិនត្រូវ
// រាយថា abort (បើអត់ អ្នកយាមបៃតងដោយការរាយ `true` ជានិច្ច)។
process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.SWABORT_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

let pass = 0;
let fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + String(detail).slice(0, 300) : '')); }
}

function loadWorker(app) {
    const source = fs.readFileSync(path.join(ROOT, app, 'sw.js'), 'utf8');
    const calls = [];
    let fetchHandler = null;
    const self = {
        location: { href: 'https://example.test/', origin: 'https://example.test' },
        addEventListener: (type, handler) => { if (type === 'fetch') fetchHandler = handler; },
        skipWaiting: () => Promise.resolve(),
        clients: { claim: () => Promise.resolve() }
    };
    const context = vm.createContext({
        self,
        URL,
        Set,
        Map,
        Promise,
        Error,
        AbortController,
        navigator: { onLine: true },
        caches: {
            open: () => Promise.resolve({
                addAll: () => Promise.resolve(),
                add: () => Promise.resolve(),
                // ⛔ cache miss ដោយចេតនា ➜ ផ្លូវត្រូវទៅដល់បណ្តាញ (បើ cache hit
                // នោះការវាស់មិនដែលប៉ះ `fetch` សោះ ➜ ការអះអាងពិតដោយចៃដន្យ)។
                match: () => Promise.resolve(undefined),
                put: () => Promise.resolve()
            }),
            keys: () => Promise.resolve([]),
            delete: () => Promise.resolve(true)
        },
        Response: { error: () => ({ ok: false, type: 'error' }) },
        setTimeout,
        clearTimeout,
        fetch: (target, options) => {
            const signal = (options && options.signal) || null;
            const record = { target, signal, aborted: false };
            calls.push(record);
            return new Promise((resolve, reject) => {
                if (!signal) return;
                const abort = () => {
                    record.aborted = true;
                    const error = new Error('aborted');
                    error.name = 'AbortError';
                    reject(error);
                };
                if (signal.aborted) abort();
                else signal.addEventListener('abort', abort, { once: true });
            });
        }
    });
    vm.runInContext(source, context, { filename: app + '/sw.js' });
    return { context, calls, fetchHandler: () => fetchHandler };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ១. helper ៖ `timedFetch` ត្រូវភ្ជាប់ signal របស់អ្នកហៅ (ការវាស់ដើម)
async function helperLinksSignal(app, worker) {
    const caller = new AbortController();
    const request = { url: 'https://example.test/.netlify/functions/zto-order-detail', signal: caller.signal };
    const pending = worker.context.timedFetch(request).then(() => 'resolved', (error) => error && error.name);
    caller.abort();
    const result = await Promise.race([pending, wait(80).then(() => 'still-pending')]);
    const call = worker.calls[worker.calls.length - 1];
    ok(app + ' ៖ `timedFetch()` ភ្ជាប់ signal របស់អ្នកហៅ',
        !!(call && call.signal && call.signal.aborted === true && result === 'AbortError'),
        JSON.stringify({ result: result, sawSignal: !!(call && call.signal) }));
}

// ២. handler ពិត ៖ សំណើ navigate ដែលអ្នកប្រើបោះបង់ ត្រូវឈានដល់បណ្តាញ
//    ជា signal ដែល abort រួច។ ⛔ នេះជាផ្លូវដែល `networkOptions` តែម្នាក់
//    ឯងអាចបញ្ជូន signal បាន (គោលដៅជាខ្សែអក្សរ គ្មាន `.signal`)។
async function handlerForwardsAbort(app, worker, mode, urlPath, label) {
    const handler = worker.fetchHandler();
    if (!handler) { ok(app + ' ៖ ចុះឈ្មោះ handler `fetch` បាន (' + label + ')', false, 'រក handler មិនឃើញ'); return; }
    const before = worker.calls.length;
    const caller = new AbortController();
    const request = {
        url: 'https://example.test' + urlPath,
        mode: mode,
        method: 'GET',
        signal: caller.signal
    };
    let responded = null;
    handler({ request: request, respondWith: (value) => { responded = value; }, waitUntil: () => {} });
    ok(app + ' ៖ handler ឆ្លើយតាម `respondWith()` (' + label + ')', !!responded && typeof responded.then === 'function');
    await wait(20);
    caller.abort();
    await wait(40);
    const made = worker.calls.slice(before);
    ok(app + ' ៖ handler ពិតបានហៅបណ្តាញ (' + label + ')', made.length > 0, 'ការហៅ ' + made.length);
    ok(app + ' ៖ ⛔ signal របស់អ្នកប្រើឡើងដល់បណ្តាញ ហើយ abort បាន (' + label + ')',
        made.some((call) => call.signal && call.signal.aborted === true),
        JSON.stringify(made.map((call) => ({ target: String(call.target).slice(0, 40), hasSignal: !!call.signal }))));
    if (responded && typeof responded.catch === 'function') responded.catch(() => {});
}

// ៣. ⛔ ទិសផ្ទុយ ៖ សំណើដែល **មិន** ត្រូវ abort មិនត្រូវរាយថា abort។
async function handlerKeepsLiveRequest(app, worker) {
    const handler = worker.fetchHandler();
    if (!handler) { ok(app + ' ៖ ⛔ ទិសផ្ទុយ ៖ ចុះឈ្មោះ handler បាន', false, 'រក handler មិនឃើញ'); return; }
    const before = worker.calls.length;
    const caller = new AbortController();
    const request = { url: 'https://example.test/', mode: 'navigate', method: 'GET', signal: caller.signal };
    let responded = null;
    handler({ request: request, respondWith: (value) => { responded = value; }, waitUntil: () => {} });
    await wait(40);
    const made = worker.calls.slice(before);
    ok(app + ' ៖ ⛔ ទិសផ្ទុយ ៖ សំណើដែលមិន abort នៅរស់ (មិនរាយ abort ក្លែងក្លាយ)',
        made.length > 0 && made.every((call) => call.aborted === false),
        JSON.stringify(made.map((call) => call.aborted)));
    caller.abort();
    if (responded && typeof responded.catch === 'function') responded.catch(() => {});
}

(async () => {
    console.log('=== sw-abort-propagation — handler ពិត ត្រូវបញ្ជូន abort បន្ត ===');
    for (const app of APPS) {
        console.log('\n--- ' + app + ' ---');
        const worker = loadWorker(app);
        await helperLinksSignal(app, worker);
        await handlerForwardsAbort(app, worker, 'navigate', '/', 'navigate');
        await handlerForwardsAbort(app, worker, 'no-cors', '/app.js', 'asset');
        await handlerKeepsLiveRequest(app, worker);
    }
    // ⛔ ជាន់អប្បបរមា ៖ ការអះអាងដែលមិនដែលរត់ ក៏ចេញ exit 0 ដែរ
    ok('⛔ ជាន់អប្បបរមា ៖ រត់ការអះអាងលើ App ទាំង ២ យ៉ាងតិច ១២', pass + fail >= 12, 'រត់ ' + (pass + fail));
    console.log('');
    if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' / ok ' + pass); process.exitCode = 1; }
    else if (!pass) { console.log('❌ គ្មានការអះអាងណារត់សោះ'); process.exitCode = 1; }
    else { console.log('✅ ជោគជ័យ ' + pass); process.exitCode = 0; }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
