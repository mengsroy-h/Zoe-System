// ថ្នាក់ ៖ **ការតភ្ជាប់ Database «ងាប់ស្ងាត់» (zombie socket) ➜ App រាយ «ភ្ជាប់ Server រួចរាល់» ខណៈគ្មានអ្វីដើរ** ·
//        និងការឆ្លង online/offline ពិត លើ **App ពិត + SDK Firebase ពិត + RTDB emulator ពិត**។
//
// ⛔ ហេតុអ្វីតេស្តនេះចាំបាច់ ៖ checker បណ្តាញផ្សេងទាំងអស់ (`connection-recovery-test` · `reconnect-ladder-test` ·
//    `connection-state-fuzz-test`) រត់កូដ App លើ **SDK ក្លែង** ដែលបាញ់ `.info/connected` តាមអ្វីដែលតេស្តសរសេរ ➜
//    ពួកវាមិនអាចឆ្លើយថា «SDK ពិតធ្វើអ្វីពេលបណ្តាញស្លាប់ដោយគ្មានព្រឹត្តិការណ៍ `offline`» ទេ។ វាស់បាន (SDK 12.19.0 ·
//    emulator ពិត · proxy TCP ដែលឈប់បញ្ជូន byte ខណៈ socket នៅបើក) ៖ `.info/connected` នៅ **`true` ១០០ វិ. ពេញ** ·
//    `get()` មិនដែលឆ្លើយ។ មូលហេតុក្នុង SDK ៖ WebSocket ផ្ញើ keepalive `0` រាល់ ៤៥ វិ. តែ **មិនរង់ចាំចម្លើយ** ហើយ SDK
//    បិទការតភ្ជាប់តែលើ `window` `offline` ➜ WiFi ដែលបាត់អ៊ីនធឺណិតខាងលើ · NAT ផុតកំណត់ · ការប្តូរបណ្តាញ · iOS ភ្ញាក់ពី
//    background ➜ socket ពាក់កណ្តាលបើក រស់រហូតដល់ TCP ផុតកំណត់ (រាប់នាទី) ➜ ចំណុចស្ថានភាពបៃតង · ការស្កេនព្យួរ ១៥ វិ. ម្តងៗ
//    · ទិន្នន័យមិនស្រស់ · ពេលអ៊ីនធឺណិតមកវិញ SDK នៅជាប់ socket ចាស់។
//
// ឯកសារនេះរត់ ៖ build វាស់ `ZoeW/` (bundle ពិត) ក្នុង Chromium · SDK ពិតពី `ZoeW/node_modules/firebase` (កំណែដដែលនឹង
// `firebase-loader.js` ផ្ទុកពី CDN · route `www.gstatic.com` ➜ ឯកសារក្នុងស្រុក) · ការចូលប្រព័ន្ធតាម Identity Toolkit ក្លែង
// (token មិន sign ដែល emulator ទទួល) · rules ពិត (`firebase-database.rules.json`) · proxy TCP រវាង browser ↔ emulator ៖
//   ក. ចាប់ផ្តើម ➜ ចូលប្រព័ន្ធ ➜ «ភ្ជាប់ Server រួចរាល់» + ទិន្នន័យមកដល់ពី server ពិត
//   ខ. browser offline/online (`context.setOffline`) ➜ ស្ថានភាពប្តូរ · ភ្ជាប់វិញ · ការប្រែលើ server ក្នុងពេលក្រៅបណ្តាញមកដល់
//   គ. ទិសផ្ទុយ ៖ ការតភ្ជាប់ **យឺតតែរស់** (latency ៣ វិ.) ➜ ការវាស់ភាពរស់ **មិន** ផ្តាច់ · ស្ថានភាពនៅបៃតង
//   ឃ. ទិសផ្ទុយ ៖ ការតភ្ជាប់ល្អ + ការភ្ញាក់ពី background ➜ គ្មានការផ្តាច់ · គ្មានការតភ្ជាប់ថ្មី
//   ង. ⛔ **zombie** ៖ socket ចាស់ឈប់បញ្ជូន (គ្មាន FIN/RST · `navigator.onLine` នៅ `true`) ➜ ការសរសេរព្យួរ ➜ App ត្រូវ
//      ឈប់រាយ «ភ្ជាប់ Server រួចរាល់» ក្នុងពិដាន ហើយពេលបណ្តាញមកវិញ (socket ចាស់នៅងាប់ ៖ ករណីអាក្រក់បំផុត) ត្រូវភ្ជាប់វិញ
//      ដោយខ្លួនឯង + ទិន្នន័យថ្មីមកដល់
//   ច. ⛔ zombie ក្រោយ **ភ្ញាក់ពី background** (គ្មានការសរសេរ) ➜ ដូចគ្នា
//   ឆ. listener មិនកកកុញ ៖ ក្រោយការឆ្លងទាំងអស់ ការតភ្ជាប់ថ្មីនីមួយៗ listen path នីមួយៗ **ម្តងគត់** (វាស់លើ frame WebSocket)
//   ឈ. បើក App ក្រោយ ៦.៥ ម៉ោង (token ផុត ➜ refresh · `auth_time` លើស ៤ ម៉ោង) ➜ ផុតកំណត់ ➜ ចូលវិញដោយពាក្យសម្ងាត់ដែលចងចាំ ➜ ទិន្នន័យគ្រប់
//      រួមការប្រែដែលឧបករណ៍ផ្សេងធ្វើពេលទូរស័ព្ទដេក (បងប្អូននៃ `supabase-app-network-e2e-test` ផ្នែក ជ)
//
//   java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
//   NODE_PATH=ZoeW/node_modules node audit-tools/emu/app-network-e2e-test.js   (ក្នុង root វាស់ ៖ run-all.sh)
'use strict';

process.exitCode = 1;

const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { emuNamespace } = require('./ns.js');

const ROOT = process.env.NETE2E_APP_DIR ? path.resolve(process.env.NETE2E_APP_DIR) : path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'ZoeW');
const EMU_PORT = parseInt(process.env.NETE2E_EMU_PORT || '9000', 10);
const CHROME = process.env.NETE2E_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const STRICT = process.env.NETE2E_STRICT === '1' || process.env.CRUD_FLOW_STRICT === '1';
const ONLINE_TEXT = 'ភ្ជាប់ Server រួចរាល់';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };

let pass = 0, fail = 0;
const check = (c, label, detail) => {
    if (c) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function emulatorUp() {
    return new Promise((resolve) => {
        const s = net.connect(EMU_PORT, '127.0.0.1');
        s.once('connect', () => { s.destroy(); resolve(true); });
        s.once('error', () => resolve(false));
    });
}

function wsFrameHeader(first, len) {
    if (len < 126) return Buffer.from([first, len]);
    if (len < 65536) { const h = Buffer.alloc(4); h[0] = first; h[1] = 126; h.writeUInt16BE(len, 2); return h; }
    const h = Buffer.alloc(10); h[0] = first; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); return h;
}

// frame WebSocket (browser ➜ server ៖ masked) ➜ អត្ថបទ ៖ រាប់ action `q` (listen) តាម path
function clientFrameParser(onText) {
    let pending = Buffer.alloc(0);
    let upgraded = false;
    return (chunk) => {
        pending = Buffer.concat([pending, chunk]);
        if (!upgraded) {
            const at = pending.indexOf('\r\n\r\n');
            if (at === -1) return;
            pending = pending.slice(at + 4);
            upgraded = true;
        }
        while (pending.length >= 2) {
            const b1 = pending[1];
            let len = b1 & 0x7f;
            let at = 2;
            if (len === 126) { if (pending.length < 4) return; len = pending.readUInt16BE(2); at = 4; }
            else if (len === 127) { if (pending.length < 10) return; len = Number(pending.readBigUInt64BE(2)); at = 10; }
            let mask = null;
            if (b1 & 0x80) { if (pending.length < at + 4) return; mask = pending.slice(at, at + 4); at += 4; }
            if (pending.length < at + len) return;
            const payload = Buffer.from(pending.slice(at, at + len));
            if (mask) for (let k = 0; k < payload.length; k++) payload[k] ^= mask[k & 3];
            if ((pending[0] & 0x0f) === 1) onText(payload.toString('utf8'));
            pending = pending.slice(at + len);
        }
    };
}

// server ➜ browser ៖ emulator ប្រាប់ host ខាងក្នុង (`"h":"127.0.0.1:9000"`) ក្នុង handshake ➜ SDK ភ្ជាប់ឡើងវិញ (និង upgrade
// long-poll ➜ WebSocket) ទៅ host នោះដោយផ្ទាល់ (រំលង proxy) ➜ សរសេរ host ឡើងវិញជា host របស់ proxy លើ **transport ទាំង ២** ៖
// frame WebSocket (ប្រវែងថ្មី) និងតួ HTTP long-poll (`Content-Length` ថ្មី) — ⛔ វាស់បាន ៖ ការសរសេរតែ frame WebSocket ➜ ក្រោយ
// offline/online SDK ចាប់ផ្តើមដោយ long-poll (`/.lp`) ហើយ upgrade ទៅ WebSocket ដោយផ្ទាល់លើ emulator ➜ proxy មើលមិនឃើញ
function serverStreamRewriter(hostFrom, hostTo) {
    let pending = Buffer.alloc(0);
    let mode = 'head';
    let head = '';
    let bodyLeft = 0;
    let chunks = [];
    const swap = (buf) => Buffer.from(buf.toString('utf8').split(hostFrom).join(hostTo), 'utf8');
    const withLength = (text, len) => text.replace(/(\r\ncontent-length:\s*)\d+/i, '$1' + len);
    return (chunk) => {
        pending = Buffer.concat([pending, chunk]);
        const out = [];
        for (;;) {
            if (mode === 'head') {
                const at = pending.indexOf('\r\n\r\n');
                if (at === -1) break;
                head = pending.slice(0, at + 4).toString('latin1');
                pending = pending.slice(at + 4);
                if (/^HTTP\/1\.1 101\b/.test(head)) { out.push(Buffer.from(head, 'latin1')); mode = 'ws'; continue; }
                const cl = /\r\ncontent-length:\s*(\d+)/i.exec(head);
                if (cl) { bodyLeft = parseInt(cl[1], 10); mode = 'body'; continue; }
                if (/\r\ntransfer-encoding:\s*chunked/i.test(head)) { chunks = []; mode = 'chunked'; continue; }
                out.push(Buffer.from(head, 'latin1'));
                continue;
            }
            if (mode === 'body') {
                if (pending.length < bodyLeft) break;
                const body = swap(pending.slice(0, bodyLeft));
                pending = pending.slice(bodyLeft);
                out.push(Buffer.from(withLength(head, body.length), 'latin1'), body);
                mode = 'head';
                continue;
            }
            if (mode === 'chunked') {
                const lineEnd = pending.indexOf('\r\n');
                if (lineEnd === -1) break;
                const size = parseInt(pending.slice(0, lineEnd).toString('latin1'), 16);
                if (!Number.isFinite(size)) { out.push(Buffer.from(head, 'latin1'), pending); pending = Buffer.alloc(0); mode = 'raw'; break; }
                if (pending.length < lineEnd + 2 + size + 2) break;
                const data = pending.slice(lineEnd + 2, lineEnd + 2 + size);
                pending = pending.slice(lineEnd + 2 + size + 2);
                if (size > 0) { chunks.push(data); continue; }
                const body = swap(Buffer.concat(chunks));
                const text = head.replace(/\r\ntransfer-encoding:[^\r]*/i, '').replace(/\r\n\r\n$/, '\r\nContent-Length: ' + body.length + '\r\n\r\n');
                out.push(Buffer.from(text, 'latin1'), body);
                mode = 'head';
                continue;
            }
            if (mode === 'raw') { out.push(pending); pending = Buffer.alloc(0); break; }
            if (pending.length < 2) break;
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
            if (text !== null && text.includes(hostFrom)) {
                const next = Buffer.from(text.split(hostFrom).join(hostTo), 'utf8');
                out.push(wsFrameHeader(first, next.length), next);
            } else {
                out.push(frame);
            }
        }
        return Buffer.concat(out);
    };
}

// proxy ៖ `pass` · `blackhole()` ៖ socket ដែលបង្កើតរួច **ងាប់ជារៀងរហូត** (គ្មាន FIN/RST ➜ ដូច NAT ដែលបាត់ ៖ ករណីអាក្រក់បំផុត)
// ហើយ socket ថ្មីក្នុងពេលដាច់ត្រូវ **ទប់** (ដូច SYN ដែលគ្មានចម្លើយ) · `restore()` ៖ socket ដែលទប់បន្តទៅ server (SYN ដែលផ្ញើឡើងវិញ
// ជោគជ័យ) · `latencyMs` ៖ យឺតតែរស់
function startProxy() {
    const state = { mode: 'pass', latencyMs: 0, conns: [], wsConns: 0, lpConns: 0 };
    const stamp = () => ((Date.now() % 1000000) / 1000).toFixed(1);
    const server = net.createServer((client) => {
        const conn = { id: state.conns.length + 1, dead: false, held: state.mode === 'blackhole', closed: false, listens: {}, ws: false, queue: [] };
        state.conns.push(conn);
        if (process.env.NETE2E_DEBUG) console.log('      🔎 ' + stamp() + ' tcp #' + conn.id + ' mode=' + state.mode);
        const rewrite = serverStreamRewriter('127.0.0.1:' + EMU_PORT, '127.0.0.1:' + state.port);
        const parse = clientFrameParser((text) => {
            if (!conn.ws) { conn.ws = true; state.wsConns++; }
            let msg;
            try { msg = JSON.parse(text); } catch (e) { return; }
            const d = msg && msg.d;
            if (msg && msg.t === 'd' && d && d.a === 'q' && d.b && typeof d.b.p === 'string') {
                conn.listens[d.b.p] = (conn.listens[d.b.p] || 0) + 1;
            }
        });
        let up = null;
        const forward = (to, data) => {
            if (conn.dead || conn.closed || !to) return;
            if (state.latencyMs > 0) setTimeout(() => { if (!conn.dead && !conn.closed) to.write(data); }, state.latencyMs);
            else to.write(data);
        };
        // ⛔ socket ដែលងាប់ ៖ server បិទខាងខ្លួន (keepalive មិនមកដល់) តែ FIN នោះមិនឆ្លងបណ្តាញដែលស្លាប់ ➜ browser មិនដឹង
        const end = () => { conn.closed = true; try { client.destroy(); } catch (e) {} try { if (up) up.destroy(); } catch (e) {} };
        const upEnded = () => { if (conn.dead) { conn.upClosed = true; try { up.destroy(); } catch (e) {} return; } end(); };
        const openUp = () => {
            up = net.connect(EMU_PORT, '127.0.0.1');
            up.on('data', (chunk) => {
                if (conn.dead) return;
                const d = rewrite(chunk);
                if (d.length) forward(client, d);
            });
            up.on('error', upEnded);
            up.on('close', upEnded);
            const queued = conn.queue;
            conn.queue = [];
            queued.forEach((d) => forward(up, d));
        };
        conn.release = () => {
            if (!conn.held || conn.closed) return;
            conn.held = false;
            if (process.env.NETE2E_DEBUG) console.log('      🔎 ' + stamp() + ' tcp #' + conn.id + ' released');
            openUp();
        };
        if (!conn.held) openUp();
        // ⛔ Chromium ចរចា `permessage-deflate` ➜ frame របស់ server ត្រូវបង្ហាប់ ➜ ការសរសេរ host ឡើងវិញមើលមិនឃើញ `"h"` ➜
        //    SDK រៀន host ខាងក្នុងរបស់ emulator ហើយភ្ជាប់ឡើងវិញរំលង proxy (វាស់បាន ៖ ការតភ្ជាប់ទី ២ មិនដែលមកដល់ proxy) ➜
        //    ដក header extension ចេញពីសំណើ upgrade
        let head = Buffer.alloc(0);
        let headDone = false;
        client.on('data', (d) => {
            if (conn.dead) return;
            if (!headDone) {
                head = Buffer.concat([head, d]);
                const at = head.indexOf('\r\n\r\n');
                if (at === -1) return;
                headDone = true;
                if (process.env.NETE2E_DEBUG) console.log('      🔎 ' + stamp() + ' tcp #' + conn.id + ' ' + head.slice(0, head.indexOf('\r\n')).toString('latin1').slice(0, 90));
                const text = head.slice(0, at + 4).toString('latin1').replace(/^Sec-WebSocket-Extensions:[^\r\n]*\r\n/gim, '');
                conn.kind = /^GET \/\.ws\b/.test(text) ? 'ws' : (/^GET \/\.lp\b/.test(text) ? 'lp' : 'http');
                if (conn.kind === 'lp') state.lpConns++;
                d = Buffer.concat([Buffer.from(text, 'latin1'), head.slice(at + 4)]);
                head = null;
            }
            if (conn.kind === 'ws') parse(d);
            if (conn.held) { conn.queue.push(d); return; }
            forward(up, d);
        });
        client.on('error', end);
        client.on('close', end);
    });
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            state.port = server.address().port;
            resolve({
                server, state,
                blackhole() { state.mode = 'blackhole'; state.conns.forEach((c) => { if (!c.held) c.dead = true; }); },
                restore() {
                    state.mode = 'pass';
                    if (process.env.NETE2E_DEBUG) console.log('      🔎 ' + stamp() + ' RESTORE');
                    state.conns.forEach((c) => { if (c.release) c.release(); });
                },
                live() { return state.conns.filter((c) => !c.closed && !c.dead && !c.held && c.ws); }
            });
        });
    });
}

function unsignedToken(uid, email, projectId, authTime) {
    const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    return b({ alg: 'none', typ: 'JWT' }) + '.' + b({
        iss: 'https://securetoken.google.com/' + projectId, aud: projectId, auth_time: authTime || now, user_id: uid, sub: uid,
        iat: now, exp: now + 3600, email, email_verified: false, firebase: { identities: { email: [email] }, sign_in_provider: 'password' }
    }) + '.';
}

(async () => {
    console.log('=== emu/app-network-e2e — App ពិត · SDK Firebase ពិត · emulator ពិត · បណ្តាញ «ភ្ជាប់តែស្លាប់» ===');

    const indexFile = path.join(DIR, 'index.html');
    const indexHtml = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, 'utf8') : '';
    const bundle = (/src="\.\/(assets\/index-[^"]+\.js)"/.exec(indexHtml) || [])[1] || '';
    const bundleSize = bundle && fs.existsSync(path.join(DIR, bundle)) ? fs.statSync(path.join(DIR, bundle)).size : 0;
    check(bundleSize > 200000, 'ជាន់អប្បបរមា ៖ bundle ពិតរបស់ App (build វាស់ ZoeW/) មិនទទេ', { bundle, bundleSize });

    let sdkDir = '', sdkVersion = '', chromium = null;
    try {
        sdkDir = path.dirname(require.resolve('firebase/package.json'));
        sdkVersion = require('firebase/package.json').version;
    } catch (e) {
        check(false, 'SDK Firebase ពិតត្រូវមាន (devDependency `firebase` ក្នុង ZoeW) — រត់ ៖ npm ci --prefix ZoeW', String(e && e.message));
    }
    try { chromium = require('playwright-core').chromium; } catch (e) { chromium = null; }
    const loader = path.join(DIR, 'firebase-loader.js');
    const loaderSrc = fs.existsSync(loader) ? fs.readFileSync(loader, 'utf8') : '';
    const cdnVersion = (loaderSrc.match(/firebasejs\/(\d+\.\d+\.\d+)\//) || [])[1] || '';
    const cdnFiles = Array.from(new Set((loaderSrc.match(/firebase-[a-z]+\.js/g) || [])));
    check(!!sdkVersion && sdkVersion === cdnVersion, 'SDK ដែលវាស់ = SDK ដែល App ផ្ទុកពី CDN (firebase-loader.js)', { tested: sdkVersion, shipped: cdnVersion });
    check(cdnFiles.length >= 3 && cdnFiles.every((f) => sdkDir && fs.existsSync(path.join(sdkDir, f))),
        'ឯកសារ CDN ដែល loader ផ្ទុក មានក្នុងកញ្ចប់ firebase ដែលដំឡើង (បម្រើក្នុងស្រុក)', cdnFiles);
    check(!!chromium && fs.existsSync(CHROME), 'មាន playwright-core និង Chromium', { chromium: !!chromium, chrome: CHROME });

    if (!(await emulatorUp())) {
        if (STRICT) {
            check(false, 'STRICT ➜ គ្មាន RTDB emulator នៅ 127.0.0.1:' + EMU_PORT + ' ត្រូវរាប់ជាការធ្លាក់');
            console.log('\n❌ ធ្លាក់ ' + fail + ' / ok ' + pass);
            return;
        }
        console.log('SKIP — គ្មាន RTDB emulator នៅ 127.0.0.1:' + EMU_PORT);
        process.exitCode = fail ? 1 : 0;
        return;
    }
    if (fail) { console.log('\n❌ ធ្លាក់ ' + fail + ' / ok ' + pass); return; }

    const PROJECT = 'demo-zoe-nete2e';
    const NS = emuNamespace('demo-zoe-nete2e');
    const owner = (p, method, body) => fetch('http://127.0.0.1:' + EMU_PORT + '/' + p + '?ns=' + NS, {
        method: method || 'GET', headers: { Authorization: 'Bearer owner' }, body: body === undefined ? undefined : JSON.stringify(body)
    });
    const rulesFile = path.join(ROOT, 'firebase-database.rules.json');
    const rulesRes = await owner('.settings/rules.json', 'PUT', JSON.parse(fs.readFileSync(rulesFile, 'utf8')));
    check(rulesRes.ok, 'ដាក់ rules ពិត (firebase-database.rules.json) លើ namespace ឯកជន', rulesRes.status);

    const now = Date.now();
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const mkItem = (id, phone, code, cod) => ({
        id, phone, cod, dod: 0, price: cod, count: 1, isClosed: false, isCalled: false,
        barcodes: [{ code, cod, dod: 0, locker: '', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 3600000, time: '09:00:00 (' + day + ')' }],
        time: '09:00:00 (' + day + ')', scanDate: day, createdAt: now - 3600000
    });
    const seedRes = await owner('zoew_scan_history_cod_dod.json', 'PUT', { n1: mkItem('n1', '012000001', 'NET1', 5), n2: mkItem('n2', '012000002', 'NET2', 7) });
    await owner('zoew_barcode_registry.json', 'PUT', { NET1: true, NET2: true });
    await owner('zoew_settings.json', 'PUT', { exchange_rate: 4100 });
    check(seedRes.ok, 'សាប history ២ ជួរលើ server ពិត', seedRes.status);

    const proxy = await startProxy();
    const staticServer = await new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            let f = path.join(DIR, p);
            if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = indexFile;
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
    const origin = 'http://127.0.0.1:' + staticServer.address().port;
    const config = { apiKey: 'fake-api-key', authDomain: PROJECT + '.firebaseapp.com', projectId: PROJECT, appId: '1:1:web:1',
        databaseURL: 'http://127.0.0.1:' + proxy.state.port + '?ns=' + NS };
    const EMAIL = 'net@zoew1.com';
    const UID = 'nete2e-user';

    const browser = await chromium.launch({ executablePath: CHROME, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 }, serviceWorkers: 'block' });
    await ctx.route('https://www.gstatic.com/firebasejs/**', (route) => {
        const file = route.request().url().split('/').pop().split('?')[0];
        const src = path.join(sdkDir, file);
        if (!/^firebase-[a-z-]+\.js$/.test(file) || !fs.existsSync(src)) return route.abort();
        return route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(src) });
    });
    const idp = { signIns: 0, refreshes: 0, authAge: 0 };
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
    await ctx.route(/^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//, (route) => {
        const req = route.request();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
        const url = req.url();
        const refresh = /securetoken\.googleapis\.com/.test(url);
        const token = unsignedToken(UID, EMAIL, PROJECT, refresh && idp.authAge ? Math.floor(Date.now() / 1000) - idp.authAge : 0);
        let body;
        if (/accounts:signInWithPassword/.test(url)) {
            idp.signIns++;
            body = { kind: 'identitytoolkit#VerifyPasswordResponse', localId: UID, email: EMAIL, displayName: '', idToken: token, registered: true, refreshToken: 'refresh-' + UID, expiresIn: '3600' };
        } else if (/accounts:lookup/.test(url)) {
            const t = String(Date.now());
            body = { kind: 'identitytoolkit#GetAccountInfoResponse', users: [{ localId: UID, email: EMAIL, emailVerified: false, passwordHash: 'x', passwordUpdatedAt: Number(t), providerUserInfo: [{ providerId: 'password', federatedId: EMAIL, email: EMAIL, rawId: EMAIL }], validSince: String(Math.floor(Number(t) / 1000)), lastLoginAt: t, createdAt: t, lastRefreshAt: new Date().toISOString() }] };
        } else if (refresh) {
            idp.refreshes++;
            body = { access_token: token, expires_in: '3600', token_type: 'Bearer', refresh_token: 'refresh-' + UID, id_token: token, user_id: UID, project_id: PROJECT };
        } else {
            body = {};
        }
        return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    });
    await ctx.route(/\/license-verify\.js(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: `window.ZoeLicense = {
        getStatus: function () { return Promise.resolve({ state: 'active' }); },
        setServerTimeOffset: function () {},
        syncServerTime: function () { return Promise.resolve(); },
        activate: function () { return Promise.resolve({ valid: true }); },
        checkOnline: function () { return Promise.resolve({ ok: true }); },
        announcementsUrl: function () { return ''; },
        clearActivation: function () {}
    };` }));
    await ctx.addInitScript((cfg) => {
        try { if (!localStorage.getItem('zoew_firebase_config')) localStorage.setItem('zoew_firebase_config', cfg); } catch (e) {}
        window.__hiddenOverride = null;
        const desc = (prop, fallback) => ({ configurable: true, get() { return window.__hiddenOverride === null ? fallback.call(document) : (prop === 'hidden' ? window.__hiddenOverride : (window.__hiddenOverride ? 'hidden' : 'visible')); } });
        const proto = Object.getPrototypeOf(Object.getPrototypeOf(document));
        const hid = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
        const vis = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
        if (hid && vis) {
            Object.defineProperty(document, 'hidden', desc('hidden', hid.get));
            Object.defineProperty(document, 'visibilityState', desc('visibilityState', vis.get));
        }
        void proto;
        // ⛔ listener ស្ទួនកម្រិត JS ៖ រាប់ `onValue` ដែលសកម្មតាម path (off(ref) ➜ ០ · unsubscribe ➜ −1) លើ SDK ពិត
        window.__listenCounts = {};
        let sdk;
        Object.defineProperty(window, 'firebaseSDK', {
            configurable: true,
            get() { return sdk; },
            set(v) {
                if (v && typeof v.onValue === 'function' && typeof v.off === 'function') {
                    const key = (ref) => { try { return decodeURIComponent(new URL(String(ref)).pathname); } catch (e) { return String(ref); } };
                    const onValue = v.onValue;
                    const off = v.off;
                    v = Object.assign({}, v, {
                        onValue(ref, cb, cancel) {
                            const k = key(ref);
                            window.__listenCounts[k] = (window.__listenCounts[k] || 0) + 1;
                            const unsub = onValue(ref, cb, cancel);
                            let done = false;
                            return function () { if (!done) { done = true; window.__listenCounts[k] = Math.max(0, (window.__listenCounts[k] || 0) - 1); } return unsub.apply(this, arguments); };
                        },
                        off(ref) {
                            const k = key(ref);
                            if (arguments.length <= 1) window.__listenCounts[k] = 0;
                            return off.apply(this, arguments);
                        }
                    });
                }
                sdk = v;
            }
        });
        // ⛔ វដ្ត ≥ ៦០ វិ. (`scope.every`) ចាប់ទុក មិនរត់ដោយខ្លួនឯង ➜ តេស្តបាញ់វាពេលដែលខ្លួនចង់ (`__fireIntervals`) ៖ បើមិនដូច្នេះ
        //    វដ្ត ៦០ វិ. អាចរកឃើញ zombie ជំនួសទ្វារដែលផ្នែកនីមួយៗវាស់ ➜ mutation លើទ្វារនោះរស់រានដោយចៃដន្យ
        const realSetInterval = window.setInterval.bind(window);
        const captured = [];
        window.setInterval = function (fn, ms) {
            if (typeof fn === 'function' && Number(ms) >= 60000) { captured.push({ fn, ms: Number(ms) }); return 0; }
            return realSetInterval.apply(window, arguments);
        };
        window.__fireIntervals = (ms) => { let n = 0; captured.forEach((c) => { if (c.ms === ms) { n++; try { c.fn(); } catch (e) {} } }); return n; };
        const realNow = Date.now.bind(Date);
        let skew = 0;
        try { skew = Number(sessionStorage.getItem('__bootSkew') || 0); } catch (e) {}
        Date.now = () => realNow() + skew;
        window.__zoeSkew = (ms) => { skew += ms; };
    }, JSON.stringify(config));
    await ctx.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
            var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
            setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
        });`);

    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e && e.message)));
    const statusText = () => page.evaluate(() => { const el = document.getElementById('firebaseStatusText'); return el ? el.textContent : ''; }).catch(() => '');
    const historyCount = () => page.evaluate(() => (Array.isArray(window.scanHistory) ? window.scanHistory.length : -1)).catch(() => -1);
    const waitUntil = async (fn, ms) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
            if (await fn()) return Date.now() - t0;
            await sleep(200);
        }
        return (await fn()) ? Date.now() - t0 : -1;
    };
    const setHidden = (hidden) => page.evaluate((h) => { window.__hiddenOverride = h; document.dispatchEvent(new Event('visibilitychange')); }, hidden);
    const debugConns = (tag) => { if (process.env.NETE2E_DEBUG) console.log('      🔎 ' + tag + ' ' + JSON.stringify(proxy.state.conns.map((c) => ({ id: c.id, ws: c.ws, dead: c.dead, closed: c.closed, upClosed: !!c.upClosed, kind: c.kind, listens: Object.keys(c.listens).length })))); };
    const addServerItem = (id, phone, code) => owner('zoew_scan_history_cod_dod/' + id + '.json', 'PUT', mkItem(id, phone, code, 3));

    const timings = {};
    try {
        // ── ក. ចាប់ផ្តើម ➜ ចូលប្រព័ន្ធ ➜ ទិន្នន័យពី server ពិត ──
        console.log('\n── ក. ចាប់ផ្តើម · ចូលប្រព័ន្ធ · ទិន្នន័យមកដល់ ──');
        await page.goto(origin + '/', { waitUntil: 'load' });
        const loginShown = await waitUntil(() => page.evaluate(() => { const m = document.getElementById('loginModal'); return !!m && getComputedStyle(m).display !== 'none'; }).catch(() => false), 20000);
        check(loginShown >= 0, 'ប្រអប់ចូលប្រព័ន្ធលេច (config ពិត · SDK ពិតផ្ទុកបាន)', { loginShown, status: await statusText() });
        await page.fill('#loginEmailInput', EMAIL);
        await page.fill('#loginPasswordInput', 'password-123');
        await page.click('#loginBtn');
        const bootOnline = await waitUntil(async () => (await statusText()) === ONLINE_TEXT && (await historyCount()) === 2, 25000);
        check(bootOnline >= 0, '«' + ONLINE_TEXT + '» + history ២ ជួរពី server ពិត (តាម proxy)', { status: await statusText(), history: await historyCount(), signIns: idp.signIns });
        check(proxy.live().length === 1, 'លក្ខខណ្ឌចាំបាច់ ៖ WebSocket តែ ១ ឆ្លង proxy (មិនរំលង proxy ទៅ emulator ផ្ទាល់)', proxy.state.conns.map((c) => ({ id: c.id, ws: c.ws, closed: c.closed })));
        const probeFn = await page.evaluate(() => typeof window.probeDatabaseLiveness === 'function');

        debugConns('ក');
        // ── ខ. browser offline/online ──
        console.log('\n── ខ. browser offline ➜ online ──');
        await ctx.setOffline(true);
        const offlineAt = await waitUntil(async () => (await statusText()) === 'ក្រៅបណ្ដាញ', 5000);
        timings.offline = { statusMs: offlineAt };
        check(offlineAt >= 0, 'offline ➜ «ក្រៅបណ្ដាញ» ក្នុង ៥ វិ.', { ms: offlineAt, status: await statusText() });
        await addServerItem('n3', '012000003', 'NET3');
        await sleep(1500);
        await ctx.setOffline(false);
        if (process.env.NETE2E_DEBUG) console.log('      🔎 setOffline(false)');
        const backAt = await waitUntil(async () => (await statusText()) === ONLINE_TEXT && (await historyCount()) === 3, 20000);
        timings.offline.onlineMs = backAt;
        check(backAt >= 0, 'online ➜ «' + ONLINE_TEXT + '» + ការប្រែលើ server ក្នុងពេលក្រៅបណ្តាញមកដល់ ក្នុង ២០ វិ.', { ms: backAt, status: await statusText(), history: await historyCount() });

        // ── គ. ទិសផ្ទុយ ៖ យឺតតែរស់ ──
        console.log('\n── គ. ទិសផ្ទុយ ៖ ការតភ្ជាប់យឺត (៣ វិ.) តែរស់ ──');
        check(probeFn, 'App មាន `probeDatabaseLiveness()` (ការវាស់ភាពរស់តាម round trip ពិតលើ socket)', probeFn);
        const connsBeforeSlow = proxy.state.wsConns;
        proxy.state.latencyMs = 3000;
        const slowVerdict = probeFn ? await page.evaluate(() => window.probeDatabaseLiveness('audit-slow')) : null;
        proxy.state.latencyMs = 0;
        await sleep(1000);
        check(slowVerdict === true, 'យឺត ៣ វិ. ➜ ការវាស់ឆ្លើយ «រស់» (មិនច្រឡំជា zombie)', slowVerdict);
        check(proxy.state.wsConns === connsBeforeSlow && (await statusText()) === ONLINE_TEXT, 'យឺតតែរស់ ➜ មិនផ្តាច់ · ស្ថានភាពនៅបៃតង', { conns: proxy.state.wsConns, before: connsBeforeSlow, status: await statusText() });

        // ── ឃ. ទិសផ្ទុយ ៖ ភ្ញាក់ពី background លើការតភ្ជាប់ល្អ ──
        console.log('\n── ឃ. ទិសផ្ទុយ ៖ ភ្ញាក់ពី background លើការតភ្ជាប់ល្អ ──');
        const connsBeforeResume = proxy.state.wsConns;
        await setHidden(true);
        await page.evaluate(() => window.__zoeSkew(120000));
        await setHidden(false);
        await sleep(4000);
        check(proxy.state.wsConns === connsBeforeResume && (await statusText()) === ONLINE_TEXT, 'ការតភ្ជាប់ល្អ ➜ គ្មានការផ្តាច់ · គ្មានការតភ្ជាប់ថ្មី', { conns: proxy.state.wsConns, before: connsBeforeResume, status: await statusText() });

        // ── ង. zombie ➜ ការសរសេរព្យួរ ──
        console.log('\n── ង. zombie socket (គ្មាន FIN/RST · navigator.onLine = true) ➜ ការសរសេរព្យួរ ──');
        proxy.blackhole();
        const zombieAt = Date.now();
        await page.evaluate(() => {
            if (typeof window.dbOp !== 'function' || !window.firebaseSDK) return;
            window.__auditStall = window.dbOp(new Promise(() => {}), 'Audit write stalled').catch(() => 'stalled');
        });
        const leftGreen = await waitUntil(async () => (await statusText()) !== ONLINE_TEXT, 45000);
        const stillOnline = await page.evaluate(() => navigator.onLine);
        check(stillOnline === true, 'លក្ខខណ្ឌចាំបាច់ ៖ `navigator.onLine` នៅ true (គ្មានព្រឹត្តិការណ៍ offline)', stillOnline);
        timings.stall = { leftGreenMs: leftGreen };
        check(leftGreen >= 0, '⛔ zombie + ការសរសេរព្យួរ ➜ App ឈប់រាយ «' + ONLINE_TEXT + '» ក្នុង ៤៥ វិ. (dbOp ១៥ វិ. + ការវាស់ ១០ វិ.)',
            { ms: leftGreen, status: await statusText(), isDatabaseConnected: await page.evaluate(() => window.isDatabaseConnected) });
        await addServerItem('n4', '012000004', 'NET4');
        proxy.restore();
        const recoveredAt = await waitUntil(async () => (await statusText()) === ONLINE_TEXT && (await historyCount()) === 4, 75000);
        timings.stall.recoveredMs = recoveredAt;
        check(recoveredAt >= 0, '⛔ បណ្តាញមកវិញ (socket ចាស់នៅងាប់) ➜ ភ្ជាប់វិញដោយខ្លួនឯង + ទិន្នន័យថ្មីមកដល់ ក្នុង ៧៥ វិ.',
            { ms: recoveredAt, sinceZombie: Date.now() - zombieAt, status: await statusText(), history: await historyCount() });

        debugConns('ង');
        // ── ច. zombie ក្រោយភ្ញាក់ពី background ──
        console.log('\n── ច. zombie ក្រោយភ្ញាក់ពី background (គ្មានការសរសេរ) ──');
        await sleep(2000);
        await setHidden(true);
        proxy.blackhole();
        await page.evaluate(() => window.__zoeSkew(120000));
        await setHidden(false);
        if (process.env.NETE2E_DEBUG) console.log('      🔎 ' + ((Date.now() % 1000000) / 1000).toFixed(1) + ' BLACKHOLE+resume');
        const resumeLeft = await waitUntil(async () => (await statusText()) !== ONLINE_TEXT, 25000);
        timings.resume = { leftGreenMs: resumeLeft };
        check(resumeLeft >= 0, '⛔ ភ្ញាក់ពី background លើ zombie ➜ ឈប់រាយ «' + ONLINE_TEXT + '» ក្នុង ២៥ វិ.', { ms: resumeLeft, status: await statusText() });
        await addServerItem('n5', '012000005', 'NET5');
        proxy.restore();
        const resumeBack = await waitUntil(async () => (await statusText()) === ONLINE_TEXT && (await historyCount()) === 5, 75000);
        timings.resume.recoveredMs = resumeBack;
        check(resumeBack >= 0, 'បណ្តាញមកវិញ ➜ ភ្ជាប់វិញ + ទិន្នន័យថ្មីមកដល់ ក្នុង ៧៥ វិ.', { ms: resumeBack, status: await statusText(), history: await historyCount() });

        debugConns('ច');
        // ── ជ. zombie ពេល App ស្ងៀម (គ្មានការសរសេរ · គ្មាន background) ➜ វដ្ត ៦០ វិ. ──
        console.log('\n── ជ. zombie ពេល App ស្ងៀម ➜ វដ្ត ៦០ វិ. ──');
        await sleep(2000);
        const idleEarly = await page.evaluate(() => window.__fireIntervals(60000));
        await sleep(1500);
        check(idleEarly >= 1 && (await statusText()) === ONLINE_TEXT, 'ទិសផ្ទុយ ៖ វដ្ត ៦០ វិ. លើការតភ្ជាប់ល្អ ➜ គ្មានការផ្តាច់', { ticks: idleEarly, status: await statusText() });
        proxy.blackhole();
        await page.evaluate(() => window.__zoeSkew(120000));
        const idleTicks = await page.evaluate(() => window.__fireIntervals(60000));
        const idleLeft = await waitUntil(async () => (await statusText()) !== ONLINE_TEXT, 25000);
        check(idleTicks >= 1 && idleLeft >= 0, '⛔ zombie ពេល App ស្ងៀម ➜ វដ្ត ៦០ វិ. ឈប់រាយ «' + ONLINE_TEXT + '» ក្នុង ២៥ វិ.', { ticks: idleTicks, ms: idleLeft, status: await statusText() });
        await addServerItem('n6', '012000006', 'NET6');
        proxy.restore();
        const idleBack = await waitUntil(async () => (await statusText()) === ONLINE_TEXT && (await historyCount()) === 6, 75000);
        check(idleBack >= 0, 'បណ្តាញមកវិញ ➜ ភ្ជាប់វិញ + ទិន្នន័យថ្មីមកដល់ ក្នុង ៧៥ វិ.', { ms: idleBack, status: await statusText(), history: await historyCount() });
        timings.idle = { leftGreenMs: idleLeft, recoveredMs: idleBack };
        // ── ឆ. listener មិនកកកុញ ──
        console.log('\n── ឆ. listener មិនកកកុញ ក្រោយ offline/online · zombie · ការភ្ជាប់ឡើងវិញ ──');
        const counts = await page.evaluate(() => window.__listenCounts || {});
        const dataPaths = ['/zoew_scan_history_cod_dod', '/zoew_recently_deleted_cod_dod', '/zoew_daily_revenue_cod_dod', '/.info/connected'];
        check(dataPaths.every((p) => counts[p] === 1), 'លក្ខខណ្ឌចាំបាច់ ៖ ការរាប់ onValue លើ SDK ពិតឃើញ history · ធុងសំរាម · ledger · .info/connected', counts);
        const dup = Object.entries(counts).filter(([, n]) => n > 1);
        check(dup.length === 0, 'path នីមួយៗមាន onValue សកម្មតែ ១ (គ្មាន listener ស្ទួនក្រោយការឆ្លង ៦ ដង)', dup);
        const liveWs = proxy.live().filter((c) => c.kind === 'ws');
        check(liveWs.length === 1, 'WebSocket រស់តែ ១ ក្រោយការឆ្លងទាំងអស់ (គ្មានការតភ្ជាប់ស្របគ្នា)', liveWs.map((c) => c.id));
        // ── ឈ. បើក App ក្រោយ ៦.៥ ម៉ោង ➜ ផុតកំណត់ ៤ ម៉ោង ➜ ចូលវិញដោយពាក្យសម្ងាត់ដែលចងចាំ ──
        console.log('\n── ឈ. បើក App ក្រោយ ៦.៥ ម៉ោង ➜ ផុតកំណត់ ➜ ចូលវិញដោយពាក្យសម្ងាត់ដែលចងចាំ ──');
        const loginVisible = () => page.evaluate(() => { const m = document.getElementById('loginModal'); return !!m && getComputedStyle(m).display !== 'none'; }).catch(() => null);
        const beforeSleep = await historyCount();
        idp.authAge = Math.round(6.5 * 3600);
        await page.evaluate(() => sessionStorage.setItem('__bootSkew', String(2 * 3600 * 1000)));
        await addServerItem('n7', '012000007', 'NET7');
        await addServerItem('n8', '012000008', 'NET8');
        const refreshesBefore = idp.refreshes;
        await page.reload({ waitUntil: 'load' });
        const expiredAt = await waitUntil(async () => (await loginVisible()) === true, 30000);
        check(beforeSleep === 6 && expiredAt >= 0 && idp.refreshes > refreshesBefore,
            'លក្ខខណ្ឌចាំបាច់ ៖ token ផុត ➜ refresh (`auth_time` ៦.៥ ម៉ោងមុន) ➜ ការផុតកំណត់ ៤ ម៉ោងចាកចេញ ➜ ប្រអប់ចូលលេច',
            { beforeSleep, expiredAt, refreshes: idp.refreshes - refreshesBefore });
        await sleep(1500);
        idp.authAge = 0;
        const prefilled = await page.evaluate(() => ({ email: document.getElementById('loginEmailInput').value, pw: (document.getElementById('loginPasswordInput').value || '').length }));
        check(prefilled.email === EMAIL && prefilled.pw > 0, 'ប្រអប់ចូលបំពេញអ៊ីមែល និងពាក្យសម្ងាត់ដែលចងចាំ', prefilled);
        if (!prefilled.pw) await page.fill('#loginPasswordInput', 'password-123');
        await page.click('#loginBtn');
        const reloginAt = await waitUntil(async () => (await statusText()) === ONLINE_TEXT && (await historyCount()) === 8, 30000);
        timings.expiry = { ms: reloginAt };
        check(reloginAt >= 0, '⛔ ចូលវិញក្រោយផុតកំណត់ ➜ history ៨ ជួរគ្រប់ (រួម ២ ជួរដែលឧបករណ៍ផ្សេងបន្ថែមពេលដេក) ក្នុង ៣០ វិ.',
            { ms: reloginAt, history: await historyCount(), status: await statusText(), login: await loginVisible() });
        const noisy = errors.filter((e) => !/sentry|gstatic|fonts\.googleapis|ERR_|Failed to fetch|NetworkError/i.test(e));
        check(noisy.length === 0, 'គ្មានកំហុស runtime / unhandledrejection', noisy.slice(0, 5));
        console.log('      ⏱  ' + JSON.stringify(timings));
    } finally {
        await browser.close().catch(() => {});
        staticServer.close();
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
