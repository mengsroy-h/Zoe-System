// ⛔ ថ្នាក់កំហុស៖ **ថ្ងៃរបស់ចំណូល និងម៉ោងដែលបង្ហាញ គណនាតាមតំបន់ម៉ោង
// *ឧបករណ៍* មិនមែនតាមតំបន់ម៉ោង *អាជីវកម្ម* (កម្ពុជា) ទេ។**
//
// 🔴 សំណើរបស់អ្នកប្រើ (2026-08-27)៖ *«រាល់ពេលវេលាទាំងអស់ត្រូវ sync តាម
// server timezone khmer»*។
//
// `getServerNow()` កែ **ចំណុចលើអ័ក្សពេលវេលា** (epoch) ឲ្យត្រូវតាម server
// រួចហើយ។ ប៉ុន្តែការបម្លែង epoch ➜ **ប្រតិទិន** ធ្វើដោយ `d.getFullYear()` ·
// `d.getMonth()` · `d.getDate()` · `toLocaleTimeString()` ដែលសុទ្ធតែអាន
// **តំបន់ម៉ោងរបស់ឧបករណ៍**។ ដូច្នេះ epoch ត្រឹមត្រូវ តែ **ថ្ងៃខុស**។
//
// វាស់បានពិត ៖ ម៉ោង 17:00 UTC គឺ 00:00 **ថ្ងៃបន្ទាប់** នៅភ្នំពេញ។ ក្នុង
// បង្អួច **៧ ម៉ោងរៀងរាល់យប់** (00:00–07:00 ម៉ោងកម្ពុជា) ឧបករណ៍ដែលកំណត់ជា
// UTC (ឬតំបន់ម៉ោងលោកខាងលិច) ចុះចំណូលចូល **ថ្ងៃមុន** ➜ តួលេខប្រចាំថ្ងៃ
// ឃ្លាតគ្នារវាងឧបករណ៍ ២ គ្រឿងរបស់អាជីវកម្មតែមួយ។
//
// ⚠️ `CLAUDE.md` ធ្លាប់ចាត់ទុកនេះជា «ទទួលយកដោយចេតនា» ដោយស្នើឲ្យបើក
// «កាលបរិច្ឆេទ និងម៉ោងស្វ័យប្រវត្តិ»។ នោះមិនគ្រប់គ្រាន់ទេ ៖ «ស្វ័យប្រវត្តិ»
// កែ **នាឡិកា** តែមិនកែ **តំបន់ម៉ោង** ដែលអ្នកប្រើអាចប្តូរដោយដៃ ឬដែល
// ខុសពេលធ្វើដំណើរ។
//
// ច្បាប់៖ **`Asia/Phnom_Penh` ជាប្រតិទិនរបស់អាជីវកម្ម** — ថ្ងៃចំណូល ·
// តម្រងថ្ងៃ · ម៉ោងដែលបោះត្រា ត្រូវគណនាក្នុងតំបន់ម៉ោងនោះ **គ្រប់ឧបករណ៍**។
// កម្ពុជា **គ្មាន DST** (UTC+7 ពេញឆ្នាំ) ➜ ការគណនាច្បាស់លាស់ ១០០%។
//
// ⚠️ ឯកសារនេះរត់ **កូដពិត** ក្នុង `vm` ហើយ **រត់ខ្លួនវាឡើងវិញក្នុង child
// process ក្រោមតំបន់ម៉ោង ៤ ផ្សេងគ្នា** ➜ ការអះអាង «មិនអាស្រ័យលើឧបករណ៍»
// ត្រូវបានវាស់ពិត មិនមែនសន្មតទេ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = process.env.KHMERTZ_APP_DIR
    ? path.resolve(process.env.KHMERTZ_APP_DIR)
    : path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW', 'app.js');

const ZONE = 'Asia/Phnom_Penh';

// epoch ដែលជ្រើសដោយចេតនា ៖ ឆ្លងព្រំដែនថ្ងៃខុសគ្នាក្នុងតំបន់ម៉ោងផ្សេងៗ
const PROBES = [
    Date.UTC(2026, 7, 27, 16, 14),  // ភ្នំពេញ 23:14 ថ្ងៃ ២៧ — UTC ក៏ ២៧
    Date.UTC(2026, 7, 27, 17, 0),   // ភ្នំពេញ 00:00 ថ្ងៃ ២៨ — UTC នៅ ២៧ ⛔
    Date.UTC(2026, 7, 27, 23, 59),  // ភ្នំពេញ 06:59 ថ្ងៃ ២៨ — UTC នៅ ២៧ ⛔
    Date.UTC(2026, 7, 28, 3, 30),   // ភ្នំពេញ 10:30 ថ្ងៃ ២៨ — UTC ក៏ ២៨
    Date.UTC(2026, 0, 1, 20, 0)     // ភ្នំពេញ 03:00 ថ្ងៃ ២ មករា — UTC នៅ ១ ⛔ (ឆ្លងឆ្នាំ)
];

function refDate(ms, dayOffset) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(ms).split('-');
    const base = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const d = new Date(base + (dayOffset || 0) * 86400000);
    return d.getUTCFullYear() + '-'
        + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
        + String(d.getUTCDate()).padStart(2, '0');
}

function refClock(ms) {
    const p = {};
    new Intl.DateTimeFormat('en-GB', {
        timeZone: ZONE, hour12: false,
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(ms).forEach((x) => { if (x.type !== 'literal') p[x.type] = x.value; });
    const hh = p.hour === '24' ? '00' : p.hour;
    return hh + ':' + p.minute + ':' + p.second;
}

function sliceBalanced(src, from) {
    let depth = 0;
    for (let i = from; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) return src.slice(from, i + 1); }
    }
    return null;
}

function extractFn(src, name) {
    const re = new RegExp('\\n(\\s*)(async\\s+)?function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    const head = src.indexOf('function ' + name, m.index);
    const brace = src.indexOf('{', src.indexOf('(', head));
    const body = sliceBalanced(src, brace);
    return body ? (m[2] ? 'async ' : '') + src.slice(head, brace) + body : null;
}

function extractConst(src, name) {
    const re = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);');
    const m = re.exec(src);
    return m ? 'const ' + name + ' = ' + m[1] + ';' : null;
}

const src = fs.existsSync(APP) ? fs.readFileSync(APP, 'utf8').replace(/\r\n?/g, '\n') : '';

// ការគណនាដែល child process បោះចេញ ➜ parent ប្រៀបធៀបឆ្លងតំបន់ម៉ោង
function computeProbe() {
    const pieces = [
        extractConst(src, 'APP_TIME_ZONE'),
        extractConst(src, 'APP_TIME_ZONE_OFFSET_MINUTES'),
        'let serverTimeOffsetMs = 0;',
        'function getServerNow() { return Date.now() + serverTimeOffsetMs; }',
        extractFn(src, 'appZoneParts'),
        extractFn(src, 'getZoneDateKey'),
        extractFn(src, 'getFormattedClockTime'),
        extractFn(src, 'getFormattedDate')
    ].filter(Boolean);
    const ctx = { console, Date, Intl, Number, String, Math, JSON, Object, Array, isNaN };
    vm.createContext(ctx);
    try { new vm.Script(pieces.join('\n\n')).runInContext(ctx); }
    catch (e) { return { error: String(e && e.message || e) }; }

    const out = { dates: [], prev: [], clocks: [] };
    for (const ms of PROBES) {
        try { out.dates.push(typeof ctx.getFormattedDate === 'function' ? ctx.getFormattedDate(new Date(ms)) : null); }
        catch (e) { out.dates.push('ERR:' + e.message); }
        try { out.prev.push(typeof ctx.getZoneDateKey === 'function' ? ctx.getZoneDateKey(ms, -1) : null); }
        catch (e) { out.prev.push('ERR:' + e.message); }
        try { out.clocks.push(typeof ctx.getFormattedClockTime === 'function' ? ctx.getFormattedClockTime(ms) : null); }
        catch (e) { out.clocks.push('ERR:' + e.message); }
    }
    return out;
}

if (process.env.KHMERTZ_PROBE === '1') {
    process.stdout.write(JSON.stringify(computeProbe()));
    process.exit(0);
}

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

console.log('=== ថ្ងៃ និងម៉ោង ត្រូវតាមប្រតិទិនកម្ពុជា គ្រប់ឧបករណ៍ ===\n');

// ── ជាន់អប្បបរមា ─────────────────────────────────────────────────────
ok('ជាន់អប្បបរមា ៖ អាន ZoeW/app.js បាន', src.length > 10000, src.length);
ok('ជាន់អប្បបរមា ៖ Node មាន Intl ជាមួយតំបន់ម៉ោង', (() => {
    try { return !!new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(0); } catch (e) { return false; }
})());
if (src.length <= 10000) {
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
}

// ── ១. ឆ្លងតំបន់ម៉ោង ៤ ➜ លទ្ធផលត្រូវ **ដូចគ្នាបេះបិទ** និងត្រូវតាមកម្ពុជា ──
const ZONES = ['UTC', 'Asia/Phnom_Penh', 'America/New_York', 'Pacific/Kiritimati'];
const results = {};
let probeFailed = null;
for (const tz of ZONES) {
    try {
        const raw = execFileSync(process.execPath, [__filename], {
            env: Object.assign({}, process.env, { TZ: tz, KHMERTZ_PROBE: '1' }),
            encoding: 'utf8', timeout: 60000
        });
        results[tz] = JSON.parse(raw);
    } catch (e) {
        probeFailed = tz + ': ' + String(e && e.message || e);
        break;
    }
}
ok('ជាន់អប្បបរមា ៖ រត់ probe ក្រោមតំបន់ម៉ោង ' + ZONES.length + ' បាន',
    !probeFailed && Object.keys(results).length === ZONES.length, probeFailed || Object.keys(results));

if (!probeFailed && Object.keys(results).length === ZONES.length) {
    const expectDates = PROBES.map((ms) => refDate(ms, 0));
    const expectPrev = PROBES.map((ms) => refDate(ms, -1));
    const expectClocks = PROBES.map((ms) => refClock(ms));

    for (const tz of ZONES) {
        const r = results[tz];
        ok('ថ្ងៃចំណូល ត្រូវតាមប្រតិទិនកម្ពុជា ក្រោម TZ=' + tz,
            JSON.stringify(r.dates) === JSON.stringify(expectDates),
            { got: r.dates, want: expectDates });
    }
    for (const tz of ZONES) {
        ok('ថ្ងៃ «ម្សិលមិញ» ត្រូវតាមប្រតិទិនកម្ពុជា ក្រោម TZ=' + tz,
            JSON.stringify(results[tz].prev) === JSON.stringify(expectPrev),
            { got: results[tz].prev, want: expectPrev });
    }
    for (const tz of ZONES) {
        ok('ម៉ោងដែលបោះត្រា ត្រូវតាមម៉ោងកម្ពុជា ក្រោម TZ=' + tz,
            JSON.stringify(results[tz].clocks) === JSON.stringify(expectClocks),
            { got: results[tz].clocks, want: expectClocks });
    }

    // ⛔ ទិសផ្ទុយ ៖ ឧបករណ៍ដែល **កំណត់ត្រឹមត្រូវជាម៉ោងកម្ពុជា** មិនត្រូវឃើញ
    //    អ្វីប្រែសោះ — បើអត់ ការកែនេះនឹងរំកិលទិន្នន័យរបស់អតិថិជនដែលធ្វើត្រូវ។
    ok('⛔ ទិសផ្ទុយ ៖ ឧបករណ៍ដែលកំណត់ជា Asia/Phnom_Penh រួច ➜ លទ្ធផលដដែល',
        JSON.stringify(results['Asia/Phnom_Penh']) === JSON.stringify(results['UTC']),
        { pp: results['Asia/Phnom_Penh'], utc: results['UTC'] });

    // ⛔ តេស្តត្រូវពិតជាឆ្លងព្រំដែនថ្ងៃ — បើអត់ វាមិនអះអាងអ្វីសោះ
    const crosses = PROBES.filter((ms) => {
        const utc = new Date(ms);
        const utcKey = utc.getUTCFullYear() + '-' + String(utc.getUTCMonth() + 1).padStart(2, '0')
            + '-' + String(utc.getUTCDate()).padStart(2, '0');
        return utcKey !== refDate(ms, 0);
    });
    ok('ជាន់អប្បបរមា ៖ epoch សាកល្បងឆ្លងព្រំដែនថ្ងៃពិត >= ៣', crosses.length >= 3, crosses.length);
}

// ── ២. ស្តាទិច ៖ គ្មានផ្លូវប្រតិទិនណាអានតំបន់ម៉ោងឧបករណ៍ទៀត ────────────
{
    const fd = extractFn(src, 'getFormattedDate') || '';
    ok('⛔ `getFormattedDate()` លែងប្រើ `getFullYear/getMonth/getDate` របស់ឧបករណ៍',
        !!fd && !/\.get(FullYear|Month|Date)\s*\(/.test(fd), fd.slice(0, 160));

    const filter = extractFn(src, 'getFilterTargetDateKey') || '';
    ok('⛔ `getFilterTargetDateKey()` ប្រើ `getZoneDateKey()` មិនមែន `setDate()`',
        !!filter && /getZoneDateKey\s*\(/.test(filter) && !/setDate\s*\(/.test(filter),
        filter.slice(0, 200));

    const filtered = extractFn(src, 'getFilteredDataByDate') || '';
    ok('⛔ `getFilteredDataByDate()` ក៏ប្រើ `getZoneDateKey()` ដែរ',
        !!filtered && /getZoneDateKey\s*\(/.test(filtered) && !/setDate\s*\(/.test(filtered),
        filtered.slice(0, 200));

    const entry = extractFn(src, 'addOrUpdateEntry') || '';
    ok('⛔ ម៉ោងដែលបោះត្រាមកពី `getFormattedClockTime()` មិនមែន `toLocaleTimeString()`',
        !!entry && /getFormattedClockTime\s*\(/.test(entry) && !/toLocaleTimeString\s*\(/.test(entry),
        entry.slice(0, 240));
}

console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
