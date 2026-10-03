// ថ្នាក់ ៖ **`disconnect` ≠ «មិនបានអនុវត្ត»** — វាស់លើ SDK Firebase **ពិត** (កំណែដដែលនឹង CDN ដែល App ផ្ទុក)
// និង RTDB emulator **ពិត** តាម proxy TCP ដែលកាត់ការតភ្ជាប់នៅចំណុចជាក់លាក់។
//
//   java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
//   NODE_PATH=ZoeW/node_modules node audit-tools/emu/tx-disconnect-emu-test.js
//
// ⛔ ហេតុអ្វីតេស្តនេះចាំបាច់ ៖ `tx-outcome-test` វាស់កូដ App លើ **គំរូ** SDK («អនុវត្ត ➜ បដិសេធ disconnect»)។
//    គំរូដែលសរសេរដោយដៃ ជាប្រភពនៃបៃតងក្លែង (`restore-finalization-fence-test` ធៀប `emu/restore-deadlock-test`)
//    ➜ ឯកសារនេះបញ្ជាក់គំរូនោះលើ SDK ពិត ហើយរត់ wrapper ពិតរបស់ App (`runTransactionResolved`) ទល់នឹង server ពិត ៖
//    ក. ack បាត់ក្រោយ server អនុវត្ត ➜ SDK បដិសេធ `disconnect` · server មានតម្លៃថ្មី · wrapper ➜ committed
//    ខ. សំណើបាត់មុនដល់ server ➜ SDK បដិសេធ `disconnect` · server មិនប្រែ · wrapper ➜ not-applied
//    គ. registry barcode (តម្លៃ `true` ថេរ) ៖ path គ្មាន listener ➜ SDK ពិតរត់ updater លើ cache ទទេ (`null`) ➜ ផ្ញើ `true`
//       ➜ បើ barcode ចុះឈ្មោះរួចដោយកញ្ចប់ផ្សេង server មាន `true` ដដែល ➜ «ស្មើតម្លៃដែលផ្ញើ» មិនមែនភស្តុតាង ➜ មិនត្រូវ `claimed`
//    ឃ. ledger ៖ ឧបករណ៍ផ្សេងដកចំនួនដូចគ្នាពីមូលដ្ឋានដដែល ខណៈសំណើរបស់យើងបាត់ ➜ តម្លៃលើ server ដូចយើងបេះបិទ ➜ token `op`
//       ក្នុង `runLedgerTransaction()` ពិតរបស់ App ត្រូវធ្វើឲ្យ wrapper **មិន** ជឿ «applied»
'use strict';

process.exitCode = 1;

const fs = require('fs');
const net = require('net');
const path = require('path');
const vm = require('vm');
const { emuNamespace } = require('./ns.js');

const ROOT = process.env.TXEMU_APP_DIR ? path.resolve(process.env.TXEMU_APP_DIR) : path.join(__dirname, '..', '..');
const PORT = parseInt(process.env.TXEMU_PORT || '9000', 10);

let pass = 0, fail = 0;
const check = (c, label, detail) => {
    if (c) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : '')); }
};

function sliceFrom(src, name) {
    let start = src.indexOf('function ' + name + '(');
    if (start === -1) return '';
    if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = src.indexOf('{', src.indexOf(')', start)), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}
function sliceConst(src, name) {
    const m = new RegExp('^\\s*const ' + name + '\\s*=\\s*[^;]+;', 'm').exec(src);
    return m ? m[0].trim() : '';
}

function emulatorUp() {
    return new Promise((resolve) => {
        const s = net.connect(PORT, '127.0.0.1');
        s.once('connect', () => { s.destroy(); resolve(true); });
        s.once('error', () => resolve(false));
    });
}

function clientFrameTexts(buf) {
    const out = [];
    let i = 0;
    while (i + 2 <= buf.length) {
        const b1 = buf[i + 1];
        const masked = (b1 & 0x80) !== 0;
        let len = b1 & 0x7f;
        let at = i + 2;
        if (len === 126) { if (at + 2 > buf.length) break; len = buf.readUInt16BE(at); at += 2; }
        else if (len === 127) { if (at + 8 > buf.length) break; len = Number(buf.readBigUInt64BE(at)); at += 8; }
        let mask = null;
        if (masked) { if (at + 4 > buf.length) break; mask = buf.slice(at, at + 4); at += 4; }
        if (at + len > buf.length) break;
        const payload = Buffer.from(buf.slice(at, at + len));
        if (mask) for (let k = 0; k < payload.length; k++) payload[k] ^= mask[k & 3];
        out.push(payload.toString('utf8'));
        i = at + len;
    }
    return out;
}

function wsFrameHeader(first, len) {
    if (len < 126) return Buffer.from([first, len]);
    if (len < 65536) { const h = Buffer.alloc(4); h[0] = first; h[1] = 126; h.writeUInt16BE(len, 2); return h; }
    const h = Buffer.alloc(10); h[0] = first; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); return h;
}

// server ➜ client ៖ emulator ប្រាប់ host ខាងក្នុងរបស់វា (`"h":"127.0.0.1:<PORT>"`) ក្នុង handshake ➜ SDK ភ្ជាប់ឡើងវិញទៅ host
// នោះដោយផ្ទាល់ (រំលង proxy) ➜ សរសេរ host ក្នុង text frame ឡើងវិញជា host របស់ proxy ហើយ encode ប្រវែង frame ថ្មី
// (port របស់ proxy ជា ephemeral ➜ ប្រវែងប្រែ)
function serverStreamRewriter(state) {
    let pending = Buffer.alloc(0);
    let upgraded = false;
    let passthrough = false;
    return (chunk) => {
        if (passthrough) return chunk;
        pending = Buffer.concat([pending, chunk]);
        const out = [];
        if (!upgraded) {
            const at = pending.indexOf('\r\n\r\n');
            if (at === -1) return Buffer.alloc(0);
            // ការអាន REST របស់ wrapper (HTTP ធម្មតា · មិនមែន 101) ក៏ឆ្លង proxy ដែរ ➜ បញ្ជូនត្រង់ៗ
            if (!/^HTTP\/1\.1 101\b/.test(pending.slice(0, at).toString('latin1'))) {
                passthrough = true;
                const all = pending;
                pending = Buffer.alloc(0);
                return all;
            }
            out.push(pending.slice(0, at + 4));
            pending = pending.slice(at + 4);
            upgraded = true;
        }
        while (pending.length >= 2) {
            const first = pending[0];
            const b1 = pending[1];
            let len = b1 & 0x7f;
            let at = 2;
            if (len === 126) { if (pending.length < 4) break; len = pending.readUInt16BE(2); at = 4; }
            else if (len === 127) { if (pending.length < 10) break; len = Number(pending.readBigUInt64BE(2)); at = 10; }
            if (b1 & 0x80) at += 4;
            if (pending.length < at + len) break;
            const frame = pending.slice(0, at + len);
            const payload = pending.slice(at, at + len);
            pending = pending.slice(at + len);
            const text = (first & 0x0f) === 1 && !(b1 & 0x80) ? payload.toString('utf8') : null;
            if (text !== null && state.hostFrom && text.includes(state.hostFrom)) {
                const next = Buffer.from(text.split(state.hostFrom).join(state.hostTo), 'utf8');
                out.push(wsFrameHeader(first, next.length), next);
                state.rewrites++;
            } else {
                out.push(frame);
            }
        }
        return Buffer.concat(out);
    };
}

function startProxy() {
    const state = { mode: null, fired: 0, rewrites: 0, hostFrom: '', hostTo: '', beforeCut: null };
    const server = net.createServer((client) => {
        const upstream = net.connect(PORT, '127.0.0.1');
        const rewrite = serverStreamRewriter(state);
        const end = () => { client.destroy(); upstream.destroy(); };
        let cut = false;
        client.on('data', (d) => {
            if (cut) return;
            if (state.mode === 'drop-request' && clientFrameTexts(d).some((t) => /"a":"p"/.test(t) && /"h":/.test(t))) {
                state.mode = null; state.fired++;
                cut = true;
                const before = state.beforeCut;
                state.beforeCut = null;
                Promise.resolve(before ? before() : null).then(end, end);
                return;
            }
            upstream.write(d);
        });
        upstream.on('data', (chunk) => {
            const d = rewrite(chunk);
            if (!d.length) return;
            const s = d.toString('latin1');
            if (state.mode === 'drop-ack' && /"b":\{"s":"ok"/.test(s) && /"r":\d+/.test(s)) {
                state.mode = null; state.fired++;
                end();
                return;
            }
            client.write(d);
        });
        client.on('error', end); upstream.on('error', end); client.on('close', end); upstream.on('close', end);
    });
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            state.hostFrom = '127.0.0.1:' + PORT;
            state.hostTo = '127.0.0.1:' + port;
            resolve({ server, state, port });
        });
    });
}

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    console.log('=== emu/tx-disconnect — SDK ពិត · emulator ពិត · wrapper ពិតរបស់ App ===');

    const appFile = path.join(ROOT, 'ZoeW/app.js');
    const SRC = fs.existsSync(appFile) ? fs.readFileSync(appFile, 'utf8') : '';
    check(SRC.split('\n').length >= 4000, 'ជាន់អប្បបរមា ៖ ZoeW/app.js មិនទទេ', SRC.split('\n').length);

    let sdkApp = null, sdkDb = null, sdkVersion = '';
    try {
        sdkApp = require('firebase/app');
        sdkDb = require('firebase/database');
        sdkVersion = require('firebase/package.json').version;
    } catch (e) {
        check(false, 'SDK Firebase ពិតត្រូវមាន (devDependency `firebase` ក្នុង ZoeW) — រត់ ៖ npm ci --prefix ZoeW', String(e && e.message));
    }
    const loader = [path.join(ROOT, 'ZoeW/public/firebase-loader.js'), path.join(ROOT, 'ZoeW/firebase-loader.js')].find((f) => fs.existsSync(f));
    const cdnVersion = loader ? ((fs.readFileSync(loader, 'utf8').match(/firebasejs\/(\d+\.\d+\.\d+)\//) || [])[1] || '') : '';
    check(!!sdkVersion && sdkVersion === cdnVersion, 'SDK ដែលវាស់ = SDK ដែល App ផ្ទុកពី CDN (firebase-loader.js)', { tested: sdkVersion, shipped: cdnVersion });

    if (!(await emulatorUp())) {
        if (process.env.CRUD_FLOW_STRICT === '1') {
            check(false, 'CRUD_FLOW_STRICT=1 ➜ គ្មាន RTDB emulator នៅ 127.0.0.1:' + PORT + ' ត្រូវរាប់ជាការធ្លាក់');
            console.log('\n❌ ធ្លាក់ ' + fail + ' / ok ' + pass);
            return;
        }
        console.log('SKIP — គ្មាន RTDB emulator នៅ 127.0.0.1:' + PORT);
        process.exitCode = fail ? 1 : 0;
        return;
    }
    if (!sdkApp || !sdkDb) {
        console.log('\n❌ ធ្លាក់ ' + fail + ' / ok ' + pass);
        return;
    }

    const proxy = await startProxy();
    const NS = emuNamespace('demo-zoe-txdisc');
    const DB_URL = 'http://127.0.0.1:' + proxy.port + '?ns=' + NS;
    const app = sdkApp.initializeApp({ projectId: 'demo-zoe-txdisc', databaseURL: DB_URL }, 'txdisc-' + process.pid);
    const db = sdkDb.getDatabase(app);

    const restRead = async (p) => {
        const res = await fetch('http://127.0.0.1:' + PORT + '/' + p + '.json?ns=' + NS, { headers: { Authorization: 'Bearer owner' } });
        return res.json();
    };
    const restWrite = async (p, value) => {
        const res = await fetch('http://127.0.0.1:' + PORT + '/' + p + '.json?ns=' + NS, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify(value) });
        return res.ok;
    };

    const box = {
        console: { log: () => {}, error: () => {}, warn: () => {} },
        JSON, Math, Object, Array, String, Number, Promise, Error, URL, Set, Map, WeakMap, Proxy, Reflect, RegExp,
        setTimeout, clearTimeout, AbortController, fetch,
        navigator: { onLine: true },
        resolveNativeApiUrl: (u) => u,
        nativeFunctionRequest: (u, o) => ({ url: u, options: o }),
        lookupState: { nativeQueryHeaderUnsupported: false },
        ZoeErrors: { capture: () => {} },
        firebaseConfig: { databaseURL: DB_URL },
        auth: { currentUser: { getIdToken: () => Promise.resolve('owner') } }
    };
    box.window = box;
    box.authGeneration = 0;
    // wrapper ឈប់ដោះស្រាយពេលប្តូរ auth **ឬ database** (`firebaseState.db` ➜ `db` ក្នុង text view)
    box.db = {};
    const ctx = vm.createContext(box);
    const parts = ['const txOutcomeUnknownReported = new Set();'];
    ['TX_OUTCOME_READ_TIMEOUT_MS', 'TX_OUTCOME_RETRY_GAP_MS', 'TX_OUTCOME_MAX_GAP_MS', 'TX_OUTCOME_MAX_REFUSALS', 'TX_OUTCOME_GATE_RELEASE_FAILS', 'txResolvingPaths', 'txDisconnectResolving'].forEach((c) => { const s = sliceConst(SRC, c); if (s) parts.push(s); });
    const FNS = ['elapsedSince', 'withTimeout', 'fetchWithTimeout', 'transactionOutcomeUnknown', 'txCloneJson', 'txCanonical', 'txSameValue', 'txRestUrl',
        'txReadServerValue', 'txDelay', 'txReadWasRefused', 'txResolveOutcome', 'txPathKey', 'txResolvingBlockers', 'txTrackResolving',
        'txSnapshotOf', 'reportTxOutcomeUnknown', 'runTransactionResolved',
        'barcodeRegistryKey', 'claimBarcodeInRegistry', 'runLedgerTransaction'];
    const missing = FNS.filter((n) => !sliceFrom(SRC, n));
    check(missing.length === 0, 'wrapper ពិតរបស់ App មានក្នុងកូដ ship', missing);
    FNS.forEach((n) => { const s = sliceFrom(SRC, n); if (s) parts.push(s); });
    if (missing.indexOf('runTransactionResolved') !== -1) parts.push('function runTransactionResolved(sdk, ref, fn) { return sdk.runTransaction(ref, fn); }');
    vm.runInContext(parts.join('\n\n'), ctx);
    const resolved = (ref, fn) => ctx.runTransactionResolved(sdkDb, ref, fn);

    let connected = false;
    sdkDb.onValue(sdkDb.ref(db, '.info/connected'), (snap) => { connected = snap.val() === true; });
    const waitConnected = async () => {
        for (let i = 0; i < 100 && !connected; i++) await settle(100);
        await settle(200);
        return connected;
    };
    try {
        await sdkDb.set(sdkDb.ref(db, 'ledger/a'), { codDollar: 10 });
        await sdkDb.set(sdkDb.ref(db, 'ledger/b'), { codDollar: 10 });
        sdkDb.onValue(sdkDb.ref(db, 'ledger'), () => {});
        await settle(300);

        console.log('\n── ក. ack បាត់ក្រោយ server អនុវត្ត ──');
        check(await waitConnected(), 'លក្ខខណ្ឌចាំបាច់ ៖ SDK ភ្ជាប់រួច មុនកាត់');
        check(proxy.state.rewrites >= 1, 'លក្ខខណ្ឌចាំបាច់ ៖ host ក្នុង handshake ត្រូវសរសេរជា proxy (SDK មិនរំលង proxy)', proxy.state.rewrites);
        proxy.state.mode = 'drop-ack';
        let raw = null;
        try { await sdkDb.runTransaction(sdkDb.ref(db, 'ledger/a'), (cur) => ({ codDollar: (cur && cur.codDollar || 0) - 3 })); raw = 'resolved'; }
        catch (e) { raw = String(e && e.message); }
        await settle(1500);
        check(proxy.state.fired >= 1, 'លក្ខខណ្ឌចាំបាច់ ៖ proxy បានកាត់ ack ពិត', proxy.state.fired);
        check(raw === 'disconnect', '⛔ គំរូ ៖ SDK ពិតបដិសេធ `disconnect`', raw);
        const afterA = await restRead('ledger/a');
        check(afterA && afterA.codDollar === 7, '⛔⛔ គំរូ ៖ server ពិតបានអនុវត្តរួច (10 ➜ 7) ខណៈ SDK រាយបរាជ័យ', afterA);

        await waitConnected();
        proxy.state.mode = 'drop-ack';
        let wrapped = null;
        try {
            const r = await resolved(sdkDb.ref(db, 'ledger/a'), (cur) => ({ codDollar: (cur && cur.codDollar || 0) - 2 }));
            wrapped = { committed: r && r.committed, value: r && r.snapshot && r.snapshot.val(), txOutcome: r && r.txOutcome };
        } catch (e) { wrapped = { error: String(e && e.message), txOutcome: e && e.txOutcome }; }
        const afterA2 = await restRead('ledger/a');
        check(afterA2 && afterA2.codDollar === 5, 'លក្ខខណ្ឌចាំបាច់ ៖ server អនុវត្តការហៅតាម wrapper (7 ➜ 5)', afterA2);
        check(proxy.state.fired >= 2, 'លក្ខខណ្ឌចាំបាច់ ៖ ការហៅតាម wrapper ក៏ត្រូវកាត់ ack ពិតដែរ (SDK នៅលើ proxy)', proxy.state.fired);
        check(!!(wrapped && wrapped.committed === true && wrapped.value && wrapped.value.codDollar === 5),
            '⛔⛔ wrapper ពិត ➜ committed: true ជាមួយតម្លៃ server', wrapped);

        console.log('\n── ខ. សំណើបាត់មុនដល់ server ──');
        check(await waitConnected(), 'លក្ខខណ្ឌចាំបាច់ ៖ SDK ភ្ជាប់វិញ មុនកាត់សំណើ');
        proxy.state.mode = 'drop-request';
        let rawB = null;
        try { await sdkDb.runTransaction(sdkDb.ref(db, 'ledger/b'), (cur) => ({ codDollar: (cur && cur.codDollar || 0) - 4 })); rawB = 'resolved'; }
        catch (e) { rawB = String(e && e.message); }
        await settle(1500);
        const afterB = await restRead('ledger/b');
        check(afterB && afterB.codDollar === 10, 'លក្ខខណ្ឌចាំបាច់ ៖ server មិនប្រែ (10)', afterB);
        check(proxy.state.fired >= 3, 'លក្ខខណ្ឌចាំបាច់ ៖ proxy បានកាត់សំណើ put ពិត', proxy.state.fired);
        check(rawB === 'disconnect', '⛔ គំរូ ៖ សំណើបាត់ ➜ SDK ពិតបដិសេធ `disconnect` ដដែល (មិនដឹងលទ្ធផល)', rawB);

        await waitConnected();
        proxy.state.mode = 'drop-request';
        let wrappedB = null;
        try {
            const r = await resolved(sdkDb.ref(db, 'ledger/b'), (cur) => ({ codDollar: (cur && cur.codDollar || 0) - 4 }));
            wrappedB = { committed: r && r.committed, txOutcome: r && r.txOutcome };
        } catch (e) { wrappedB = { error: String(e && e.message), txOutcome: e && e.txOutcome }; }
        const afterB2 = await restRead('ledger/b');
        check(proxy.state.fired >= 4, 'លក្ខខណ្ឌចាំបាច់ ៖ ការហៅតាម wrapper ក៏ត្រូវកាត់សំណើពិតដែរ', proxy.state.fired);
        check(!!(wrappedB && wrappedB.txOutcome === 'not-applied') && afterB2 && afterB2.codDollar === 10,
            '⛔⛔ wrapper ពិត ➜ not-applied ហើយ server មិនប្រែ (10)', { wrappedB, server: afterB2 });

        console.log('\n── គ. registry barcode ៖ barcode ចុះឈ្មោះរួចដោយកញ្ចប់ផ្សេង + សំណើបាត់ ──');
        check(await restWrite('zoew_barcode_registry/ZT7788990011', true), 'លក្ខខណ្ឌចាំបាច់ ៖ កូនសោ registry មានរួច (កញ្ចប់ផ្សេង)');
        ctx.db = db;
        ctx.fb = { ref: sdkDb.ref, runTransaction: (ref, fn, o) => ctx.runTransactionResolved(sdkDb, ref, fn, o) };
        let sawNull = false;
        await waitConnected();
        proxy.state.mode = 'drop-request';
        const firedBefore = proxy.state.fired;
        const probeRaw = await (async () => {
            try {
                await sdkDb.runTransaction(sdkDb.ref(db, 'zoew_barcode_registry/ZT7788990011'), (cur) => { if (cur === null) sawNull = true; return cur === null ? true : undefined; });
                return 'resolved';
            } catch (e) { return String(e && e.message); }
        })();
        check(proxy.state.fired > firedBefore && probeRaw === 'disconnect', 'លក្ខខណ្ឌចាំបាច់ ៖ សំណើ put ត្រូវកាត់ ➜ SDK ពិតបដិសេធ `disconnect`', { probeRaw, fired: proxy.state.fired });
        check(sawNull, '⛔ គំរូ ៖ SDK ពិតរត់ updater លើ cache ទទេ (`null`) ទោះ server មាន `true` ➜ ផ្ញើ `true`');
        await waitConnected();
        proxy.state.mode = 'drop-request';
        let verdict = null;
        try { verdict = await vm.runInContext('claimBarcodeInRegistry("ZT7788990011")', ctx); } catch (e) { verdict = 'throw:' + (e && e.message); }
        check(await restRead('zoew_barcode_registry/ZT7788990011') === true, 'លក្ខខណ្ឌចាំបាច់ ៖ server នៅ `true` (ជារបស់កញ្ចប់ផ្សេង)');
        check(verdict !== 'claimed', '⛔⛔ claim ពិតរបស់ App ➜ **មិនមែន** `claimed` (barcode ស្ទួន ➜ COD បូក ២ ដង)', verdict);

        console.log('\n── ឃ. ledger ៖ ឧបករណ៍ផ្សេងដកចំនួនដូចគ្នា + សំណើរបស់យើងបាត់ ──');
        await restWrite('ledger/c', { codDollar: 10, dodDollar: 0, totalCount: 2 });
        sdkDb.onValue(sdkDb.ref(db, 'ledger/c'), () => {});
        await settle(400);
        await waitConnected();
        const ledgerTx = vm.runInContext('typeof runLedgerTransaction === "function" ? runLedgerTransaction : null', ctx);
        const next = (cur) => ({ codDollar: (cur && cur.codDollar || 0) - 5, dodDollar: 0, totalCount: (cur && cur.totalCount || 0) - 1 });
        proxy.state.mode = 'drop-request';
        proxy.state.beforeCut = () => restWrite('ledger/c', { codDollar: 5, dodDollar: 0, totalCount: 1 });
        const firedBeforeD = proxy.state.fired;
        let outD = null;
        try {
            const r = ledgerTx
                ? await ledgerTx(sdkDb.ref(db, 'ledger/c'), (cur, op) => (op ? Object.assign(next(cur), { op }) : next(cur)))
                : await resolved(sdkDb.ref(db, 'ledger/c'), next);
            outD = { committed: r && r.committed, txOutcome: r && r.txOutcome };
        } catch (e) { outD = { error: String(e && e.message), txOutcome: e && e.txOutcome }; }
        const afterD = await restRead('ledger/c');
        check(proxy.state.fired > firedBeforeD, 'លក្ខខណ្ឌចាំបាច់ ៖ សំណើ put របស់យើងត្រូវកាត់ (ការសរសេររបស់ឧបករណ៍ផ្សេងចុះមុន)', proxy.state.fired);
        check(afterD && afterD.codDollar === 5 && !afterD.op, 'លក្ខខណ្ឌចាំបាច់ ៖ server មានតម្លៃដូចយើង (5) តែជារបស់ឧបករណ៍ផ្សេង', afterD);
        check(!(outD && outD.committed), '⛔⛔ wrapper + runLedgerTransaction ពិត ➜ **មិនមែន** committed (ការដករបស់យើងមិនបានចុះ)', outD);
    } finally {
        try { sdkDb.goOffline(db); } catch (e) {}
        try { await sdkApp.deleteApp(app); } catch (e) {}
        proxy.server.close();
    }

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' / ok ' + pass : '✅ ជោគជ័យ ' + pass + ' ការអះអាង'));
    process.exitCode = fail ? 1 : 0;
    setTimeout(() => process.exit(process.exitCode), 50).unref();
})().catch((e) => {
    console.log('  FAIL  checker គាំង ៖ ' + (e && e.stack || e));
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 50).unref();
});
