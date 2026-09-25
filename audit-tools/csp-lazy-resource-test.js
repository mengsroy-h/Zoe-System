// ធនធានដែលផ្ទុក **យឺត** ត្រូវឆ្លងកាត់ CSP ពិតដែរ។
//
// 🔴 កំហុសផលិតកម្មពិត (2.19.1)៖ អ្នកប្រើរាយការណ៍ថា «export excel អត់ចេញ
// មិនមែនមកពី internet ទេ internet ខ្ញុំដើរលឿនធម្មតា»។ ZoeW ទាញ SheetJS ពី
// `https://unpkg.com/...` ខណៈ `script-src` របស់ `netlify.toml` **គ្មាន host
// នោះសោះ** ➜ browser **ទប់មុនចេញដំណើរ**។ វាស់ក្នុង Chromium ពិតជាមួយ header
// CSP ពិត (ហើយបម្រើ unpkg ក្នុងមូលដ្ឋានដើម្បីឲ្យ **តែ CSP** ជាអ្នកសម្រេច)៖
//
//     លទ្ធផលការផ្ទុក  : { loaded: false, hasXLSX: false }
//     សំណើទៅដល់ unpkg : 0     ← គ្មានសំណើណាចេញពីឧបករណ៍សោះ
//     console          : "Refused to load the script ... violates ... script-src"
//
// រួច `script.onerror` ➜ catch ➜ toast «សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត» —
// ជាការចោទបណ្តាញខុស ខណៈបណ្តាញដើរល្អ។
//
// **ហេតុអ្វីវារស់រានយូរម្ល៉េះ៖** `csp-enforced-test.js` វាស់តែធនធានដែលផ្ទុក
// **ពេល boot**; ចំណែក `export-cells-test.js` ប្រើ module `xlsx` **របស់ npm
// ក្នុង Node** ➜ វាមិនដែលសួរថា *browser យក library នេះមកពីណា* សោះ។ នេះជា
// មេរៀនដដែលនឹង `network-timeout-test.js` (2.12.1) និង
// `fluid-type-focus-test.js` (2.16.0)៖ **ត្រូវសួរថា checker ពិនិត្យអ្វីខ្លះ។**
//
// ដូច្នេះឯកសារនេះគ្រប **ធនធានដែលផ្ទុកយឺត** — អ្វីដែលលេចឡើងតែពេលអ្នកប្រើចុច។

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const crypto = require('crypto');

let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { chromium = null; }
const CHROME = process.env.CSPLAZY_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.resolve(process.env.CSPLAZY_APP_DIR || path.join(__dirname, '..'));

// SheetJS 0.20.3 ផ្លូវការដែល vendor ក្នុង repo — digest ចាក់សោកុំឲ្យឯកសារប្រែស្ងាត់ៗ
const XLSX_SRI = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';

const APPS = ['ZoeW', 'ZoeKeyGen'];

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

function cspOf(app) {
    const m = /Content-Security-Policy = "([^"]+)"/.exec(read(app + '/netlify.toml'));
    return m ? m[1] : null;
}

function directive(csp, name) {
    const m = new RegExp('(?:^|;)\\s*' + name + '\\s+([^;]+)').exec(csp);
    return m ? m[1].trim().split(/\s+/) : null;
}

// ត្រូវនឹងច្បាប់ host របស់ CSP ដែលគ្រប់គ្រាន់សម្រាប់គម្រោងនេះ (រួម wildcard មួយថ្នាក់)
function cspAllows(sources, url) {
    if (!sources) return false;
    let parsed;
    try { parsed = new URL(url); } catch (e) { return false; }
    return sources.some((raw) => {
        const src = raw.replace(/^'|'$/g, '');
        if (src === '*') return true;
        if (raw.charAt(0) === "'") return false;
        let candidate = src;
        if (candidate.indexOf('://') === -1) candidate = parsed.protocol + '//' + candidate;
        let allowed;
        try { allowed = new URL(candidate); } catch (e) { return false; }
        if (allowed.protocol !== parsed.protocol) return false;
        if (allowed.hostname.indexOf('*.') === 0) {
            const suffix = allowed.hostname.slice(1);
            return parsed.hostname.endsWith(suffix);
        }
        return allowed.hostname === parsed.hostname;
    });
}

function sliceFn(src, name) {
    let start = src.indexOf('function ' + name + '(');
    if (start === -1) return null;
    if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = src.indexOf('{', start), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}

function sliceConst(src, name) {
    const start = src.indexOf('const ' + name + ' =');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < src.length; i++) {
        const c = src[i];
        if (c === '[' || c === '{' || c === '(') depth++;
        else if (c === ']' || c === '}' || c === ')') depth--;
        else if (c === ';' && depth === 0) return src.slice(start, i + 1);
    }
    return null;
}

// ── ១. គ្មាន script ណាមួយចង្អុលទៅ host ដែល CSP មិនអនុញ្ញាត ─────────────
console.log('-- ១. រាល់ script ដែល App ផ្ទុក ត្រូវឆ្លងកាត់ `script-src` ពិត --');
for (const app of APPS) {
    const csp = cspOf(app);
    ok(app + ' ៖ មាន header CSP ក្នុង netlify.toml', !!csp);
    if (!csp) continue;
    const scriptSrc = directive(csp, 'script-src');

    const html = read(app + '/index.html');
    const js = read(app + '/app.js');

    const htmlScripts = [];
    const tagRe = /<script[^>]*\ssrc=["']([^"']+)["']/g;
    let m;
    while ((m = tagRe.exec(html)) !== null) htmlScripts.push(m[1]);

    // URL ណាមួយក្នុងកូដដែលបញ្ចប់ដោយ .js គឺជាបេក្ខជនផ្ទុកយឺត
    const lazyScripts = (js.match(/https?:\/\/[^'"`\s)]+\.js\b/g) || []);

    const offenders = htmlScripts.concat(lazyScripts)
        .filter((u) => /^https?:\/\//.test(u))
        .filter((u) => !cspAllows(scriptSrc, u));

    ok(app + ' ៖ គ្មាន script URL ដែល `script-src` នឹងទប់', offenders.length === 0, offenders);
}

// ── ២. SheetJS ត្រូវនៅក្នុង repo — កុំនាំវាទៅ CDN ────────────────────
console.log('\n-- ២. SheetJS ស្ថិតក្នុង repo (ច្បាប់ដដែលនឹង ZXing) --');
for (const app of ['ZoeW']) {
    const rel = app + '/vendor/xlsx.full.min.js';
    ok(app + ' ៖ មានឯកសារ vendor', exists(rel));
    if (!exists(rel)) continue;
    const digest = 'sha384-' + crypto.createHash('sha384')
        .update(fs.readFileSync(path.join(ROOT, rel))).digest('base64');
    ok(app + ' ៖ ត្រូវនឹង SheetJS 0.20.3 ផ្លូវការដែលបានផ្ទៀងផ្ទាត់ (sha384)',
        digest === XLSX_SRI, digest);
}
{
    const js = read('ZoeW/app.js');
    ok('ZoeW ៖ EXPORT_LIBS លែងចង្អុលទៅ CDN', js.indexOf('unpkg.com') === -1);
    ok('ZoeW ៖ EXPORT_LIBS ចង្អុលទៅឯកសារ same-origin',
        /xlsx:\s*\{\s*url:\s*'\.\/vendor\/xlsx\.full\.min\.js'/.test(js));
    const loader = sliceFn(js, 'loadScriptOnce') || '';
    // `script.integrity = undefined` សរសេរ attribute ជា "undefined" ➜ SRI ធ្លាក់
    // App React ៖ ការសាង `<script>` ផ្លាស់ទៅច្រកចេញ `injectScript(spec)` (`platform/document-io.ts`) ➜ ច្រកទ្វារ
    // ត្រូវឈរក្នុងវា ហើយ loader ត្រូវបញ្ជូន `integrity: lib.integrity` (មិនមែនតម្លៃថេរ)
    const injector = /\binjectScript\(/.test(loader) ? (sliceFn(js, 'injectScript') || '') : '';
    const guarded = /if \(lib\.integrity\)/.test(loader)
        || (/integrity:\s*lib\.integrity\b/.test(loader) && /if \((\w+)\.integrity\) \{[^}]*script\.integrity = \1\.integrity/.test(injector));
    ok('ZoeW ៖ loadScriptOnce ដាក់ integrity តែពេល lib ប្រកាសវា', guarded, (injector || loader).slice(0, 240));
}

// ── ៣. ធនធាននោះត្រូវនៅក្នុងសំបក ➜ Export ដើរពេលក្រៅបណ្ដាញដែរ ────────
console.log('\n-- ៣. ធនធានផ្ទុកយឺត ត្រូវនៅក្នុងសំបករបស់ service worker --');
for (const app of ['ZoeW']) {
    const sw = read(app + '/sw.js');
    const inShell = /['"]\.\/vendor\/xlsx\.full\.min\.js['"]/.test(sw);
    ok(app + ' ៖ `./vendor/xlsx.full.min.js` នៅក្នុង CORE_SHELL ឬ OPTIONAL_SHELL', inShell);
}

// ── ៤. សារបរាជ័យ មិនត្រូវចោទបណ្តាញខុស ────────────────────────────────
console.log('\n-- ៤. សារបរាជ័យត្រូវប្រាប់មូលហេតុពិត --');
{
    const js = read('ZoeW/app.js');
    const fn = sliceFn(js, 'exportFailureMessage');
    ok('ZoeW ៖ មាន exportFailureMessage', !!fn);
    if (fn) {
        const ctx = { navigator: { onLine: true }, String };
        vm.createContext(ctx);
        vm.runInContext(fn + '\nthis.__msg = exportFailureMessage;', ctx);
        const loadErr = new Error('Failed to load ./vendor/xlsx.full.min.js');
        loadErr.code = 'SCRIPT_LOAD_FAILED';

        const online = ctx.__msg(loadErr);
        ok('ZoeW ៖ បណ្តាញដើរល្អ ➜ សារ **មិនចោទ** អ៊ីនធឺណិត',
            online.indexOf('អ៊ីនធឺណិត') === -1 && online.indexOf('ក្រៅបណ្ដាញ') === -1, online);
        ok('ZoeW ៖ ហើយវាប្រាប់ថាការផ្ទុកឯកសារបរាជ័យ', online.indexOf('ផ្ទុក') !== -1, online);

        ctx.navigator.onLine = false;
        const offline = ctx.__msg(loadErr);
        ok('ZoeW ៖ ក្រៅបណ្ដាញពិត ➜ ទើបនិយាយពីបណ្តាញ',
            offline.indexOf('ក្រៅបណ្ដាញ') !== -1, offline);
        ok('ZoeW ៖ សារទាំង ២ ខុសគ្នា (បើដូចគ្នា = គ្មានការបែងចែក)',
            online !== offline, { online, offline });

        const other = ctx.__msg(new Error('boom'));
        ok('ZoeW ៖ កំហុសផ្សេង ➜ បង្ហាញមូលហេតុពិត មិនមែនស្មានថាបណ្តាញ',
            other.indexOf('boom') !== -1 && other.indexOf('អ៊ីនធឺណិត') === -1, other);
    }
}

// ── ៥. ក្នុង browser ពិត ក្រោម header CSP ពិត ────────────────────────
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.wasm': 'application/wasm' };
function serve(dir, csp) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            const headers = { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' };
            if (csp) headers['Content-Security-Policy'] = csp;
            rsp.writeHead(200, headers);
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

(async () => {
    if (!chromium || !fs.existsSync(CHROME)) {
        console.log('\n-- ៥. browser ពិត — SKIP (គ្មាន playwright-core ឬ Chromium) --');
        console.log('\nសរុប: ' + pass + ' ok, ' + fail + ' FAIL');
        process.exit(fail ? 1 : 0);
    }
    console.log('\n-- ៥. Chromium ពិត ក្រោម header CSP ពិត ៖ ផ្លូវ Export ត្រូវដើរ --');
    const browser = await chromium.launch({ executablePath: CHROME });
    const dir = path.join(ROOT, 'ZoeW');
    const csp = cspOf('ZoeW');
    const server = await serve(dir, csp);
    const port = server.address().port;
    const ctx = await browser.newContext({ viewport: { width: 412, height: 800 } });
    const page = await ctx.newPage();
    const violations = [];
    page.on('console', (m) => {
        if (/Content Security Policy|Refused to load/i.test(m.text())) violations.push(m.text().slice(0, 200));
    });
    // unpkg ត្រូវឆ្លើយជាធម្មតា ➜ បើការផ្ទុកនៅតែធ្លាក់ នោះ **CSP** ជាអ្នកទប់
    // មិនមែនបណ្តាញទេ។ នេះជាចំណុចដែលធ្វើឲ្យការវាស់នេះមានតម្លៃ។
    let cdnHits = 0;
    await page.route('**', (route) => {
        const u = route.request().url();
        if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
        if (u.indexOf('unpkg.com') !== -1) {
            cdnHits++;
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.XLSX = { faked: true };' });
        }
        return route.abort();
    });
    try {
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1200);

        const js = read('ZoeW/app.js');
        const libs = sliceConst(js, 'EXPORT_LIBS');
        const loader = sliceFn(js, 'loadScriptOnce');
        // App React ៖ ច្រកចេញ DOM ដែល loader ហៅ (`injectScript`) ត្រូវមកជាមួយ — វាជាកូដ ship ពិត មិនមែន stub
        const injectorSrc = loader && /\binjectScript\(/.test(loader) ? sliceFn(js, 'injectScript') : '';
        if (!libs || !loader || (/\binjectScript\(/.test(loader || '') && !injectorSrc)) {
            ok('ZoeW ៖ ស្រង់ EXPORT_LIBS និង loadScriptOnce ចេញបាន', false);
        } else {
            await page.evaluate('window.__exportProbe = (function () {\n' +
                'const loadedScriptPromises = {};\n' + libs + '\n' + (injectorSrc || '') + '\n' + loader + '\n' +
                'return { load: () => loadScriptOnce(\'xlsx\'), url: EXPORT_LIBS.xlsx.url };\n})();');

            const out = await page.evaluate(() => window.__exportProbe.load().then(
                () => ({ ok: true, hasXLSX: typeof window.XLSX !== 'undefined' }),
                (e) => ({ ok: false, code: e && e.code, message: e && e.message })
            ));
            ok('ZoeW ៖ ផ្លូវផ្ទុក Excel ពិត ដើរក្រោម CSP ពិត', out.ok === true && out.hasXLSX === true, out);
            ok('ZoeW ៖ គ្មានការរំលោភ CSP អំឡុងផ្លូវនោះ', violations.length === 0, violations[0]);
            ok('ZoeW ៖ ហើយវាមិនប៉ះ CDN ខាងក្រៅសោះ', cdnHits === 0, cdnHits);

            // library ត្រូវ **ដំណើរការពិត** មិនត្រឹមតែផ្ទុកចូល
            const built = await page.evaluate(() => {
                try {
                    const ws = XLSX.utils.aoa_to_sheet([['ល.រ', 'អតិថិជន'], [1, '0976455977']]);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'ប្រវត្តិ');
                    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx', bookSST: true });
                    const head = new Uint8Array(bytes.slice(0, 2));
                    return { bytes: bytes.byteLength, zip: head[0] === 0x50 && head[1] === 0x4b };
                } catch (e) { return { error: String(e && e.message) }; }
            });
            ok('ZoeW ៖ សរសេរ .xlsx ពិតបាន (ឯកសារចាប់ផ្តើមដោយ PK)',
                built.zip === true && built.bytes > 0, built);
        }
    } catch (e) {
        ok('ZoeW ៖ ការវាស់ក្នុង browser រត់បាន', false, String(e && e.message));
    }
    await ctx.close();
    server.close();
    await browser.close();
    console.log('\nសរុប: ' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
