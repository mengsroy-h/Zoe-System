// ថ្នាក់៖ **ដំណឹងពី ZoeKeyGen ទៅ ZoeW (ផ្ទាំង 🔔)** — ផ្លូវផ្ញើ · បញ្ជី · លុប ក្នុង ZoeKeyGen
//
//   node audit-tools/keygen-notice-test.js
//
// វាស់ ៣ ជាន់ ៖
//   ១. ស្នាមភ្ជាប់ ៖ ប្រភេទ · ព្រំដែនប្រវែង · ទម្រង់ id ក្នុង `ZoeKeyGen/app.js` ត្រូវស៊ីនឹង
//      `ZoeKeyGen/index.html` (option · maxlength) និង `ZoeKeyGen/firebase-database.rules.json`
//      ➜ ការកែម្ខាងភ្លេចម្ខាង = ZoeKeyGen ផ្ញើអ្វីដែល rules បដិសេធ (ឬផ្ទុយមកវិញ)។
//   ២. ឥរិយាបថ ៖ `sendNotice()` · `deleteNotice()` ពិត ក្នុង `vm` ជាមួយ SDK ក្លែងក្នុង
//      **របៀបបរាជ័យ ៤** (ជោគជ័យ · បដិសេធ · ព្យួរហើយ commit យឺត · ការអានធ្លាក់)។
//      ⛔ toast ✅ លេចតែក្រោយ `fb.update` ដោះ (durable commit) · ⛔ session ប្តូរ ➜ គ្មាន toast/ការសម្អាត។
//   ៣. XSS ៖ `renderNoticeList()` ត្រូវ escape ចំណងជើង/ខ្លឹមសារ/id។
// ⛔ rules ពិតលើ emulator ពិត ៖ `emu/license-seat-rules-test.js` ផ្នែក ១២។
'use strict';

process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appRoot = process.env.KEYGEN_APP_DIR ? path.resolve(process.env.KEYGEN_APP_DIR) : root;

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail === undefined ? '' : '  got: ' + JSON.stringify(detail))); fail++; }
}

function readOr(rel) {
    try { return fs.readFileSync(path.join(appRoot, rel), 'utf8'); } catch (e) { return ''; }
}
const src = readOr('ZoeKeyGen/app.js');
const html = readOr('ZoeKeyGen/index.html');
const rulesText = readOr('ZoeKeyGen/firebase-database.rules.json');

function sliceFn(name) {
    const plainStart = src.indexOf('\nfunction ' + name + '(');
    const asyncStart = src.indexOf('\nasync function ' + name + '(');
    const start = asyncStart !== -1 && (plainStart === -1 || asyncStart < plainStart) ? asyncStart : plainStart;
    if (start === -1) return null;
    let depth = 0;
    let i = src.indexOf('{', start);
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    return src.slice(start + 1, i);
}
function realDecl(name) {
    const m = src.match(new RegExp('^const ' + name + ' = .*;$', 'm'));
    return m ? m[0] : null;
}

const FN_NAMES = ['noticeBucketPath', 'cleanNoticeText', 'buildNoticePayload', 'noticeErrorMessage', 'newNoticeId',
    'noticeIdsToTrim', 'noticeRowsOf', 'setNoticeSendBusy', 'refreshNoticeList', 'renderNoticeList',
    'sendNotice', 'deleteNotice', 'escapeHtml', 'captureSensitiveSession', 'isSensitiveSessionCurrent', 'invalidateSensitiveSession'];
const DECL_NAMES = ['LICENSE_APP_CODE', 'NOTICE_TITLE_MAX', 'NOTICE_BODY_MAX', 'NOTICE_KEEP_MAX', 'NOTICE_KIND_LABELS', 'NOTICE_ID_ALPHABET', 'NOTICE_SEND_LABEL'];

const fnSources = FN_NAMES.map((n) => [n, sliceFn(n)]);
const declSources = DECL_NAMES.map((n) => [n, realDecl(n)]);
const missing = fnSources.filter((x) => !x[1]).map((x) => x[0]).concat(declSources.filter((x) => !x[1]).map((x) => x[0]));
ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ ស្រង់ function/ថេរ ដំណឹងពី ZoeKeyGen/app.js បានគ្រប់', missing.length === 0, missing);

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function drain(n) { for (let i = 0; i < (n || 8); i++) await flush(); }

function snapOf(value) {
    return { exists: () => value !== null && value !== undefined, val: () => (value === undefined ? null : JSON.parse(JSON.stringify(value))) };
}

function build(options) {
    const opts = Object.assign({}, options || {});
    const elements = {};
    const getElementById = (id) => {
        if (!elements[id]) elements[id] = { id, value: '', textContent: '', innerHTML: '', disabled: false };
        return elements[id];
    };
    const log = { alerts: [], toasts: [], confirms: [], updates: [], sets: [], gets: [], refreshes: 0, captures: 0 };
    const user = { uid: 'admin-1' };
    const sandbox = {
        console: { log() {}, error() {}, warn() {} },
        Promise, Error, JSON, String, Number, Object, Array, Uint8Array, Math, Date, isFinite, setTimeout, clearTimeout,
        crypto: require('crypto').webcrypto,
        confirm: (m) => { log.confirms.push(m); return opts.confirm !== false; },
        alert: (m) => log.alerts.push(m),
        document: { getElementById },
        showToast: (m) => log.toasts.push(m),
        getServerNow: () => opts.now || 1760000000000,
        retryAsync: (fn) => Promise.resolve().then(fn),
        withTimeout: opts.withTimeout || ((p) => p),
        auth: { currentUser: user },
        window: { ZoeErrors: { capture() { log.captures++; } } },
        ZoeErrors: { capture() { log.captures++; } },
        fb: {
            ref: (db, p) => ({ db, path: p || '' }),
            get: (ref) => { log.gets.push(ref.path); return opts.get ? opts.get(ref) : Promise.resolve(snapOf(null)); },
            update: (ref, updates) => { log.updates.push({ path: ref.path, updates: JSON.parse(JSON.stringify(updates)) }); return opts.update ? opts.update(updates) : Promise.resolve(); },
            set: (ref, value) => { log.sets.push({ path: ref.path, value }); return opts.set ? opts.set(ref, value) : Promise.resolve(); }
        },
        db: { name: 'license-db' },
        __log: log
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(`
        var sensitiveSessionGeneration = 0;
        var authGeneration = 3;
        var isSignedInUiActive = true;
        var keyListSessionGeneration = 0;
        var noticeListCache = [];
        var noticeReadFailed = false;
        var isSendingNotice = false;
        var noticeSendOwner = null;
    `, ctx);
    vm.runInContext(declSources.map((x) => (x[1] || '').replace(/^const /, 'var ')).join('\n'), ctx);
    vm.runInContext(fnSources.map((x) => x[1] || '').join('\n\n'), ctx);
    vm.runInContext('var __realRefresh = refreshNoticeList; refreshNoticeList = function () { __log.refreshes++; return __realRefresh(); };', ctx);
    return { ctx, log, el: getElementById };
}

function fill(h, kind, title, body) {
    h.el('noticeKindInput').value = kind;
    h.el('noticeTitleInput').value = title;
    h.el('noticeBodyInput').value = body;
}

async function run() {
    if (missing.length) return;
    const probe = build();
    const C = probe.ctx;
    const kinds = Object.keys(C.NOTICE_KIND_LABELS);
    const bucket = 'license_announcements/' + C.LICENSE_APP_CODE;

    console.log('-- ១. ស្នាមភ្ជាប់ ZoeKeyGen ↔ index.html ↔ rules --');
    ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ ប្រភេទដំណឹងយ៉ាងតិច ២', kinds.length >= 2, kinds);
    const selectBlock = (html.match(/<select id="noticeKindInput">([\s\S]*?)<\/select>/) || [])[1] || '';
    const optionValues = [...selectBlock.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
    ok('option ក្នុង #noticeKindInput = NOTICE_KIND_LABELS (ទាំង ២ ទិស)',
        optionValues.length === kinds.length && optionValues.every((v) => kinds.includes(v)), { optionValues, kinds });
    const maxOf = (id) => Number(((html.match(new RegExp('id="' + id + '"[^>]*maxlength="(\\d+)"')) || [])[1]));
    ok('#noticeTitleInput maxlength = NOTICE_TITLE_MAX', maxOf('noticeTitleInput') === C.NOTICE_TITLE_MAX, maxOf('noticeTitleInput'));
    ok('#noticeBodyInput maxlength = NOTICE_BODY_MAX', maxOf('noticeBodyInput') === C.NOTICE_BODY_MAX, maxOf('noticeBodyInput'));

    let node = null;
    try { node = JSON.parse(rulesText).rules.license_announcements.$appCode.$msgId; } catch (e) { node = null; }
    ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ rules មាន license_announcements/$appCode/$msgId', !!node);
    if (node) {
        const ruleKinds = [...String(node.kind && node.kind['.validate']).matchAll(/newData\.val\(\) === '([a-z]+)'/g)].map((m) => m[1]);
        ok('ប្រភេទក្នុង rules = NOTICE_KIND_LABELS (ទាំង ២ ទិស)',
            ruleKinds.length === kinds.length && ruleKinds.every((k) => kinds.includes(k)), { ruleKinds, kinds });
        const lenMax = (field) => Number((String(node[field] && node[field]['.validate']).match(/length <= (\d+)/) || [])[1]);
        ok('rules title ≤ NOTICE_TITLE_MAX', lenMax('title') === C.NOTICE_TITLE_MAX, lenMax('title'));
        ok('rules body ≤ NOTICE_BODY_MAX', lenMax('body') === C.NOTICE_BODY_MAX, lenMax('body'));
        const idRe = (String(node['.validate']).match(/\$msgId\.matches\(\/(.+?)\/\)/) || [])[1];
        ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ rules ចាក់សោទម្រង់ id', !!idRe, node['.validate']);
        if (idRe) {
            const re = new RegExp(idRe);
            const samples = [];
            for (let i = 0; i < 200; i++) samples.push(C.newNoticeId(1700000000000 + i * 997));
            ok('newNoticeId() ២០០ គំរូ ➜ ឆ្លង regex របស់ rules ទាំងអស់', samples.every((id) => re.test(id)), samples.find((id) => !re.test(id)));
            const sorted = samples.slice().sort();
            ok('id តម្រៀបតាមអក្សរ = តាមពេល (ZoeW ប្រើ orderBy $key + limitToLast)', sorted.every((id, i) => id === samples[i]));
            ok('ទិសផ្ទុយ ៖ regex បដិសេធ id ក្រៅទម្រង់', !re.test('x' + samples[0].slice(1)) && !re.test(samples[0] + 'Z'));
        }
    }

    console.log('-- ២. buildNoticePayload · noticeIdsToTrim --');
    const good = C.buildNoticePayload(kinds[0], '  ចំណងជើង\u0007  ', '', 1700000000123.7);
    ok('payload ៖ trim · លុបតួបញ្ជា · `at` ជាចំនួនគត់ · គ្មាន `body` ពេលទទេ',
        good.payload && good.payload.title === 'ចំណងជើង' && good.payload.at === 1700000000123 && !('body' in good.payload), good);
    const withBody = C.buildNoticePayload(kinds[1], 'x', 'បន្ទាត់ ១\nបន្ទាត់ ២', 1700000000000);
    ok('ខ្លឹមសាររក្សាការចុះបន្ទាត់', withBody.payload && withBody.payload.body === 'បន្ទាត់ ១\nបន្ទាត់ ២', withBody);
    ok('វាលក្នុង payload មានតែ kind/title/body/at',
        withBody.payload && Object.keys(withBody.payload).sort().join() === 'at,body,kind,title', withBody.payload && Object.keys(withBody.payload));
    ok('ប្រភេទ `update` ➜ បដិសេធ (កុំក្លែងកំណែ App)', C.buildNoticePayload('update', 'x', '', 1).error === 'kind');
    ok('ប្រភេទ `__proto__` ➜ បដិសេធ', C.buildNoticePayload('__proto__', 'x', '', 1).error === 'kind');
    ok('ចំណងជើងទទេ (ឬតែដកឃ្លា) ➜ បដិសេធ', C.buildNoticePayload(kinds[0], '   ', '', 1).error === 'title-empty');
    const longTitle = C.buildNoticePayload(kinds[0], 'ក'.repeat(C.NOTICE_TITLE_MAX + 1), '', 1);
    ok('ចំណងជើងលើសព្រំដែន ➜ បដិសេធ ហើយប្រាប់ចំនួនតួ (គ្មានការកាត់ស្ងាត់)',
        longTitle.error === 'title-long' && longTitle.length === C.NOTICE_TITLE_MAX + 1
        && C.noticeErrorMessage(longTitle).includes(String(C.NOTICE_TITLE_MAX + 1)), longTitle);
    ok('ខ្លឹមសារលើសព្រំដែន ➜ បដិសេធ', C.buildNoticePayload(kinds[0], 'x', 'ក'.repeat(C.NOTICE_BODY_MAX + 1), 1).error === 'body-long');
    ok('`at` មិនមែនលេខ/0/NaN ➜ បដិសេធ', ['x', 0, NaN, Infinity].every((a) => C.buildNoticePayload(kinds[0], 'x', '', a).error === 'at'));

    const K = C.NOTICE_KEEP_MAX;
    const ids = (n) => Array.from({ length: n }, (_, i) => C.newNoticeId(1700000000000 + i * 1000));
    const ex25 = ids(K + 5);
    const trim25 = C.noticeIdsToTrim(ex25.slice().reverse(), K);
    ok('មាន ' + (K + 5) + ' ➜ លុប ' + 6 + ' ចាស់ជាងគេ (រួមថ្មី = ' + K + ')',
        trim25.length === 6 && trim25.join() === ex25.slice(0, 6).join(), trim25.length);
    ok('មាន ' + (K - 1) + ' ➜ មិនលុបអ្វី', C.noticeIdsToTrim(ids(K - 1), K).length === 0);
    ok('មាន ' + K + ' ➜ លុប ១ ចាស់ជាងគេ', C.noticeIdsToTrim(ids(K), K).length === 1);

    console.log('-- ៣. sendNotice ៖ ជោគជ័យ (toast ក្រោយ commit) --');
    {
        const existing = {};
        ids(K).forEach((id) => { existing[id] = { kind: kinds[0], title: 't', at: 1 }; });
        const commit = deferred();
        const h = build({ get: () => Promise.resolve(snapOf(existing)), update: () => commit.promise });
        fill(h, kinds[1], 'ថែទាំ', 'ម៉ោង ៩ យប់');
        const task = h.ctx.sendNotice();
        await drain();
        ok('⛔ មុន commit ៖ គ្មាន toast ✅', h.log.toasts.length === 0, h.log.toasts);
        ok('ប៊ូតុងផ្ញើត្រូវបិទខណៈកំពុងផ្ញើ', h.el('noticeSendBtn').disabled === true);
        const second = h.ctx.sendNotice();
        await drain();
        ok('⛔ ចុចម្តងទៀតខណៈកំពុងផ្ញើ ➜ គ្មានការសរសេរទី ២', h.log.updates.length === 1, h.log.updates.length);
        commit.resolve();
        await task;
        await second;
        await drain();
        const up = h.log.updates[0] || { updates: {} };
        const keys = Object.keys(up.updates);
        const newKey = keys.find((k) => up.updates[k] !== null);
        const delKeys = keys.filter((k) => up.updates[k] === null);
        ok('សរសេរជា multi-path ពី root', up.path === '', up.path);
        ok('ដំណឹងថ្មីចុះនៅ ' + bucket + '/<id>', !!newKey && newKey.startsWith(bucket + '/'), keys);
        ok('payload = buildNoticePayload() ពិត', newKey && JSON.stringify(up.updates[newKey]) === JSON.stringify({ kind: kinds[1], title: 'ថែទាំ', at: 1760000000000, body: 'ម៉ោង ៩ យប់' }), up.updates[newKey]);
        const oldest = Object.keys(existing).sort()[0];
        ok('មាន ' + K + ' រួច ➜ លុបចាស់ជាងគេ ១ ក្នុង update ដដែល', delKeys.length === 1 && delKeys[0] === bucket + '/' + oldest, delKeys);
        ok('ក្រោយ commit ៖ toast ✅', h.log.toasts.length === 1 && h.log.toasts[0].startsWith('✅'), h.log.toasts);
        ok('ក្រោយ commit ៖ សម្អាតវាល', h.el('noticeTitleInput').value === '' && h.el('noticeBodyInput').value === '');
        ok('ក្រោយ commit ៖ ទាញបញ្ជីឡើងវិញ', h.log.refreshes >= 1, h.log.refreshes);
        ok('ប៊ូតុងផ្ញើបើកវិញ', h.el('noticeSendBtn').disabled === false);
    }

    console.log('-- ៤. sendNotice ៖ session ប្តូរកណ្តាលការផ្ញើ --');
    {
        const commit = deferred();
        const h = build({ update: () => commit.promise });
        fill(h, kinds[0], 'ក', 'ខ');
        const task = h.ctx.sendNotice();
        await drain();
        h.ctx.invalidateSensitiveSession();
        commit.resolve();
        await task;
        await drain();
        ok('⛔ logout កណ្តាលការផ្ញើ ➜ គ្មាន toast', h.log.toasts.length === 0, h.log.toasts);
        ok('⛔ logout កណ្តាលការផ្ញើ ➜ មិនទាញបញ្ជីក្រោយ', h.log.refreshes === 0, h.log.refreshes);
    }
    {
        const oldCommit = deferred();
        const newCommit = deferred();
        let n = 0;
        const h = build({ update: () => (++n === 1 ? oldCommit.promise : newCommit.promise) });
        fill(h, kinds[0], 'ចាស់', '');
        const oldTask = h.ctx.sendNotice();
        await drain();
        vm.runInContext('noticeSendOwner = null; isSendingNotice = false; invalidateSensitiveSession();', h.ctx);
        fill(h, kinds[0], 'ថ្មី', '');
        const newTask = h.ctx.sendNotice();
        await drain();
        ok('logout ➜ វគ្គថ្មីផ្ញើបានភ្លាម (មិនជាប់ការផ្ញើចាស់)', h.log.updates.length === 2, h.log.updates.length);
        oldCommit.resolve();
        await oldTask;
        await drain();
        ok('⛔ ការផ្ញើចាស់ចប់ ➜ មិនដោះប៊ូតុងរបស់ការផ្ញើថ្មី', h.el('noticeSendBtn').disabled === true && h.ctx.isSendingNotice === true);
        newCommit.resolve();
        await newTask;
        await drain();
        ok('ការផ្ញើថ្មីចប់ ➜ ប៊ូតុងបើកវិញ', h.el('noticeSendBtn').disabled === false && h.el('noticeSendBtn').textContent === h.ctx.NOTICE_SEND_LABEL);
    }

    console.log('-- ៥. sendNotice ៖ server បដិសេធ --');
    {
        const h = build({ update: () => Promise.reject(new Error('PERMISSION_DENIED')) });
        fill(h, kinds[0], 'ក', 'ខ');
        await h.ctx.sendNotice();
        await drain();
        ok('បដិសេធ ➜ alert «មិនបាន»', h.log.alerts.length === 1 && h.log.alerts[0].includes('មិនបាន'), h.log.alerts);
        ok('បដិសេធ ➜ គ្មាន toast ✅', h.log.toasts.length === 0, h.log.toasts);
        ok('បដិសេធ ➜ វាលនៅដដែល (មិនបាត់អត្ថបទ)', h.el('noticeTitleInput').value === 'ក' && h.el('noticeBodyInput').value === 'ខ');
        ok('បដិសេធ ➜ ផ្ញើទៅ Sentry', h.log.captures >= 1);
    }

    console.log('-- ៦. sendNotice ៖ ព្យួរ ➜ commit យឺត --');
    {
        const commit = deferred();
        const timeoutErr = new Error('Notice send timed out');
        const h = build({
            update: () => commit.promise,
            withTimeout: (p, ms, msg) => (msg === 'Notice send timed out' ? Promise.reject(timeoutErr) : p)
        });
        fill(h, kinds[0], 'ក', 'ខ');
        await h.ctx.sendNotice();
        await drain();
        ok('ព្យួរ ➜ សារ «មិនទាន់បញ្ជាក់» (មិនមែន «មិនបាន»)',
            h.log.alerts.length === 1 && h.log.alerts[0].includes('មិនទាន់បញ្ជាក់') && !h.log.alerts[0].includes('ផ្ញើដំណឹងមិនបាន'), h.log.alerts);
        ok('ព្យួរ ➜ គ្មាន toast ✅ មុន commit', h.log.toasts.length === 0, h.log.toasts);
        ok('ព្យួរ ➜ វាលនៅដដែល', h.el('noticeTitleInput').value === 'ក');
        commit.resolve();
        await drain();
        ok('⛔ commit យឺត ➜ toast ✅ «ដំណឹងដែលរង់ចាំ»', h.log.toasts.length === 1 && h.log.toasts[0].includes('រង់ចាំ'), h.log.toasts);
        ok('⛔ commit យឺត ➜ ទាញបញ្ជីឡើងវិញ', h.log.refreshes >= 1, h.log.refreshes);
    }
    {
        const commit = deferred();
        const h = build({
            update: () => commit.promise,
            withTimeout: (p, ms, msg) => (msg === 'Notice send timed out' ? Promise.reject(new Error('t')) : p)
        });
        fill(h, kinds[0], 'ក', 'ខ');
        await h.ctx.sendNotice();
        h.ctx.invalidateSensitiveSession();
        commit.resolve();
        await drain();
        ok('⛔ commit យឺតក្រោយ logout ➜ គ្មាន toast', h.log.toasts.length === 0, h.log.toasts);
    }

    console.log('-- ៧. sendNotice ៖ ការអានធ្លាក់ ➜ មិនសរសេរ --');
    {
        const h = build({ get: () => Promise.reject(new Error('offline')) });
        fill(h, kinds[0], 'ក', 'ខ');
        await h.ctx.sendNotice();
        await drain();
        ok('ការអានធ្លាក់ ➜ គ្មាន fb.update', h.log.updates.length === 0, h.log.updates.length);
        ok('ការអានធ្លាក់ ➜ alert «មិនបាន»', h.log.alerts.length === 1 && h.log.alerts[0].includes('មិនបាន'), h.log.alerts);
    }
    {
        const h = build({ confirm: false });
        fill(h, kinds[0], 'ក', 'ខ');
        await h.ctx.sendNotice();
        ok('បោះបង់ confirm ➜ គ្មានការអាន/សរសេរ', h.log.gets.length === 0 && h.log.updates.length === 0);
    }
    {
        const h = build();
        h.ctx.auth.currentUser = null;
        fill(h, kinds[0], 'ក', 'ខ');
        await h.ctx.sendNotice();
        ok('មិនទាន់ចូលប្រព័ន្ធ ➜ គ្មានការសរសេរ', h.log.updates.length === 0 && h.log.gets.length === 0);
    }
    {
        const h = build();
        fill(h, kinds[0], '', 'ខ');
        await h.ctx.sendNotice();
        ok('ចំណងជើងទទេ ➜ alert មុន confirm · គ្មានការសរសេរ', h.log.alerts.length === 1 && h.log.confirms.length === 0 && h.log.updates.length === 0);
    }

    console.log('-- ៨. បញ្ជី · លុប · XSS --');
    {
        const idA = C.newNoticeId(1700000000000);
        const idB = C.newNoticeId(1700000005000);
        const raw = {};
        raw[idA] = { kind: kinds[0], title: '<img src=x onerror=alert(1)>', body: '"><script>x</script>', at: 1700000000000 };
        raw[idB] = { kind: kinds[1], title: 'ថ្មីជាង', at: 1700000005000 };
        const h = build({ get: () => Promise.resolve(snapOf(raw)) });
        await h.ctx.refreshNoticeList();
        const out = h.el('noticeListBody').innerHTML;
        ok('បញ្ជីតម្រៀបថ្មីមុន', h.ctx.noticeListCache.map((r) => r.id).join() === [idB, idA].join());
        ok('⛔ ចំណងជើង/ខ្លឹមសារ escape (គ្មាន tag ឆៅ)', !/<img|<script/.test(out) && out.includes('&lt;img') && out.includes('&lt;script'), out.slice(0, 200));
        ok('ប៊ូតុងលុបផ្ទុក id ពិត', out.includes('data-notice-id="' + idA + '"') && out.includes('data-action="delete-notice"'));
        const hf = build({ get: () => Promise.reject(new Error('PERMISSION_DENIED')) });
        await hf.ctx.refreshNoticeList();
        ok('⛔ អានមិនបាន ➜ ⚠️ មិនមែន «មិនទាន់មាន»', hf.el('noticeListBody').innerHTML.includes('⚠️') && !hf.el('noticeListBody').innerHTML.includes('មិនទាន់មាន'));
        const he = build({ get: () => Promise.resolve(snapOf(null)) });
        await he.ctx.refreshNoticeList();
        ok('ទិសផ្ទុយ ៖ ទទេពិត ➜ «មិនទាន់មាន»', he.el('noticeListBody').innerHTML.includes('មិនទាន់មាន'));
        const stale = deferred();
        const hs = build({ get: () => stale.promise });
        const t = hs.ctx.refreshNoticeList();
        hs.ctx.keyListSessionGeneration++;
        hs.el('noticeListBody').innerHTML = '';
        stale.resolve(snapOf(raw));
        await t;
        ok('⛔ ចម្លើយយឺតក្រោយ logout ➜ មិនគូរបញ្ជីឡើងវិញ', hs.el('noticeListBody').innerHTML === '' && hs.ctx.noticeListCache.length === 0);

        await h.ctx.deleteNotice(idA);
        await drain();
        ok('លុប ➜ fb.set(null) លើផ្លូវពិត', h.log.sets.length === 1 && h.log.sets[0].path === bucket + '/' + idA && h.log.sets[0].value === null, h.log.sets);
        ok('លុប ➜ toast ✅ ក្រោយ commit', h.log.toasts.length === 1 && h.log.toasts[0].startsWith('✅'), h.log.toasts);
        const hx = build({ get: () => Promise.resolve(snapOf(raw)) });
        await hx.ctx.refreshNoticeList();
        await hx.ctx.deleteNotice('n0000000000000zzzzzz');
        ok('លុប id ដែលមិនមានក្នុងបញ្ជី ➜ គ្មានការសរសេរ', hx.log.sets.length === 0);
        const hd = build({ get: () => Promise.resolve(snapOf(raw)), set: () => Promise.reject(new Error('denied')) });
        await hd.ctx.refreshNoticeList();
        await hd.ctx.deleteNotice(idA);
        ok('លុបធ្លាក់ ➜ alert · គ្មាន toast ✅', hd.log.alerts.length === 1 && hd.log.toasts.length === 0, hd.log);
    }

    console.log('-- ៩. logout សម្អាតផ្ទៃដំណឹង --');
    {
        const logoutFn = sliceFn('showLoginModalWithPrefill') || '';
        ok('showLoginModalWithPrefill() សម្អាត noticeListCache · #noticeListBody · វាលចំណងជើង/ខ្លឹមសារ · ប៊ូតុង/សោផ្ញើ',
            /noticeListCache = \[\]/.test(logoutFn) && /noticeListBody/.test(logoutFn)
            && /noticeTitleInput/.test(logoutFn) && /noticeBodyInput/.test(logoutFn)
            && /noticeSendOwner = null/.test(logoutFn) && /isSendingNotice = false/.test(logoutFn) && /noticeSendBtn/.test(logoutFn));
        const afterAdmin = sliceFn('verifyAdminRoleThenProceed') || '';
        ok('ក្រោយផ្ទៀងផ្ទាត់ admin ➜ ទាញបញ្ជីដំណឹង', /refreshNoticeList\(\)/.test(afterAdmin));
    }
}

run().then(() => {
    const total = pass + fail;
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    if (fail === 0 && total >= 40) process.exitCode = 0;
    else if (fail === 0) console.log('FAIL — ការអះអាងតិចពេក (' + total + ' < 40)');
}, (e) => {
    console.log('  FAIL   កំហុសក្នុង checker ៖ ' + (e && e.stack || e));
    console.log('\n' + pass + ' ok, ' + (fail + 1) + ' FAIL');
});
