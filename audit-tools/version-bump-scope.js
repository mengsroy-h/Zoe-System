// ⛔ **ឡើងកំណែតែ App ដែលកែពិត។**
//
// 🔴 អ្នកប្រើសួរត្រង់ៗ (2026-08-27)៖ «ជុំខ្លះ app ខ្លះមិនបានកែអីផង ត្រូវឡើង
// កំណែដែរ វាអត់សូវសមហេតុផល … ហើយរាល់ការគ្រាន់តែឡើងកំណែ ធ្វើឲ្យ netlify
// redeploy»។ គាត់ត្រូវ។ ភស្តុតាងពីជុំ 2.19.4៖ `ZoeKeyGen/app.js` ប្រែ
// **តែបន្ទាត់ `APP_VERSION` មួយគត់** — គ្មានការកែពិតសោះ — តែវាបង្ខំ
// `CACHE_VERSION` ឲ្យឡើង ➜ **អ្នកប្រើ ZoeKeyGen ទាំងអស់ទាញសំបកទាំងមូល
// ឡើងវិញ** និង Netlify redeploy ដោយឥតប្រយោជន៍។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ (ធៀបនឹង base branch)៖
//   ១. ឯកសារដែល ship របស់ App ប្រែ  ➜ `CACHE_VERSION` **ត្រូវ** ឡើង
//      (បើភ្លេច អ្នកប្រើជាប់នឹងសំបកចាស់ក្នុង cache)
//   ២. ឯកសារដែល ship **មិនប្រែ**    ➜ `CACHE_VERSION` **មិនត្រូវ** ឡើង
//      (បើឡើង អ្នកប្រើទាញឡើងវិញដោយឥតប្រយោជន៍)
//   ៣. `app.js` ប្រែលើសពីបន្ទាត់ `APP_VERSION` ➜ `APP_VERSION` ត្រូវឡើង
//   ៤. `app.js` ប្រែ **តែបន្ទាត់ `APP_VERSION`** ➜ នោះជាការឡើងកំណែទទេ ➜ ធ្លាក់
//
// ⚠️ ការប្រៀបធៀបធ្វើឡើងធៀបនឹង `VERSIONSCOPE_BASE` (លំនាំដើម `origin/main`)។
// បើគ្មាន git ឬគ្មាន base នោះ ➜ **SKIP ដោយស្មោះ** (មិនមែនបៃតងក្លែងក្លាយ)។
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = process.env.VERSIONSCOPE_APP_DIR
    ? path.resolve(process.env.VERSIONSCOPE_APP_DIR)
    : path.resolve(__dirname, '..');
const BASE = process.env.VERSIONSCOPE_BASE || 'origin/main';
const APPS = ['ZoeW', 'ZoeKeyGen'];
// ⛔ App React ៖ `run-all.sh` វាស់ «root វាស់» (ZoeW = build វាស់ ដែលមាន `sw.js` អានបាន) ខណៈប្រវត្តិ git រស់នៅ repo ពិត
//    ➜ `VERSIONSCOPE_GIT_DIR` ចង្អុលទៅ repo (លំនាំដើម = ROOT ដូចមុន)។
const GIT_DIR = process.env.VERSIONSCOPE_GIT_DIR ? path.resolve(process.env.VERSIONSCOPE_GIT_DIR) : ROOT;
// ⛔ ប្រភព React ៖ កំណែរស់នៅ `src/core/version.ts` · `src/sw/cache-version.ts` ហើយកូដ ship គឺ **អ្វីដែល Vite build**
//    (src · public · index.html · vite.config) បូក dependency (`package.json`/lock ៖ React · Firebase ចូល bundle —
//    ផ្ទុយពី App vanilla ដែល package.json ជា manifest របស់ server តែប៉ុណ្ណោះ)។ ស្ពាន build វាស់មិន ship ទេ។
const REACT_VERSION_FILES = { app: 'src/core/version.ts', cache: 'src/sw/cache-version.ts' };
const REACT_SHIPPED = /^(src\/|public\/|index\.html$|vite\.config\.mts$|package(-lock)?\.json$)/;
const REACT_AUDIT_ONLY = /^src\/(expose-globals\.ts|audit-compat\.ts|audit-annotate\.ts|_generated-state\.json)$/;
function isReactSource(app) { return fs.existsSync(path.join(GIT_DIR, app, 'src', 'main.tsx')); }

// ឯកសារដែលបម្រើដល់អ្នកប្រើពិត — README/manifest មិនប៉ះឥរិយាបថ runtime
const SHIPPED = /\.(js|css|html|wasm|json)$/;
// ⛔ `netlify/functions/` រត់លើ **server** — វាមិនដែលចូលសំបករបស់ `sw.js` ទេ
// (`sw.js` បញ្ជូន `/.netlify/functions/` ទៅ `networkOnly()` ដោយផ្ទាល់) ➜ ការកែ
// Function មិនអាចធ្វើឲ្យសំបកដែល cache ចាស់បានឡើយ។ បើរាប់វាជាកូដ ship នោះ
// ការកែខាង server បង្ខំ `CACHE_VERSION` ឲ្យឡើង ➜ **អ្នកប្រើទាំងអស់ទាញសំបក
// PWA ទាំងមូលឡើងវិញដោយឥតប្រយោជន៍** — ជាកំហុសដដែលនឹងច្បាប់ទី ៦។
// ⛔ ការលើកលែងនេះមិនឈរតែឯងទេ — ការអះអាង «សំបកគ្មានផ្លូវ server» ខាងក្រោម
// ចាក់សោវា ៖ បើថ្ងៃណាឯកសារសំបកពិតចូល `netlify/` ឬ `tools/` នោះវាធ្លាក់។
// ⛔ `package.json` / `package-lock.json` ជា manifest នៃការ **build** របស់
// Netlify — វាមិនដែលចូលសំបករបស់ `sw.js` ទេ ➜ ការបន្ថែម dependency ខាង server
// មិនត្រូវបង្ខំអ្នកប្រើទាញសំបក PWA ទាំងមូលឡើងវិញឡើយ (ច្បាប់ទី ៦ ដដែល)។
// ការលើកលែងនេះក៏ត្រូវចាក់សោដោយការអះអាងលើបញ្ជីសំបកខាងក្រោមដែរ។
// ⛔ `public/announcements.json` (សារជូនដំណឹង/ថែទាំ) ជា **ទិន្នន័យ** ដែល App ទាញ network-only — វាមិនចូលសំបករបស់ `sw.js`
//    ➜ សារថែទាំបន្ទាន់មិនត្រូវបង្ខំអ្នកប្រើទាញសំបក PWA ឡើងវិញ (ច្បាប់ទី ៦)។ ចាក់សោដោយការអះអាងលើបញ្ជីសំបកខាងក្រោមដូចគ្នា។
const FEED_DATA = /(^|\/)announcements\.json$/;
const NOT_SHIPPED = /(README|netlify\.toml|netlify\/functions\/|firebase-database\.rules\.json|\/test\.js$|\/package(-lock)?\.json$|(^|\/)announcements\.json$)/;
const BUILD_MANIFEST = /package(-lock)?\.json$/;
const SERVER_ONLY_DIRS = /(^|\/)(netlify|tools)\//;

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + detail : '')); }
}

function git(args) {
    return execFileSync('git', args, { cwd: GIT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}

// ⛔ **ជាន់អប្បបរមាត្រូវមកមុន SKIP។** បើដាក់ SKIP មុន នោះថតដែលគ្មាន git
// (ឧ. `*_APP_DIR` ចង្អុលខុស ឬថតទទេ) នឹងចេញ exit 0 ➜ **បៃតងក្លែងក្លាយ**។
// `checker-coverage.js` ចាប់បាននេះពិតៗពេលឯកសារនេះទើបសរសេរ។
const present = APPS.filter((a) => fs.existsSync(path.join(ROOT, a, 'sw.js')));
ok('ជាន់អប្បបរមា៖ ឃើញ App ដែលមាន sw.js >= 2', present.length >= 2, present.join(', '));
if (present.length < 2) {
    console.log('\n❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ') — checker នេះមិនបានឃើញកូដទេ');
    process.exit(1);
}

// SKIP ត្រូវរក្សាទុកសម្រាប់ **បរិស្ថាន** តែប៉ុណ្ណោះ (គ្មាន git ឬគ្មាន base)
// ក្រោយពេលបានបញ្ជាក់រួចថាកូដ App មានពិត។
//
// ⛔ **តែ SKIP នោះជាបៃតងក្លែងក្លាយក្នុង CI។** `actions/checkout@v4` ទាញ
// តែ **១ commit** ដោយលំនាំដើម (`fetch-depth: 1`) ➜ គ្មាន `origin/main` ➜
// ឯកសារនេះ **SKIP រាល់ការរត់ CI តាំងពីវាត្រូវបានសរសេរ** ➜ ការការពារ
// «កូដ ship ប្រែ ➜ ត្រូវឡើងកំណែ» និង «ការឡើងកំណែទទេ» **មិនដែលអនុវត្ត
// លើ PR ណាមួយសោះ**។ វាដំណើរការតែពេលអ្នកអភិវឌ្ឍន៍រត់នៅមូលដ្ឋាន។
//
// ការកែ ២ ជាន់៖ `audit.yml` ដាក់ `fetch-depth: 0` ហើយ
// `VERSIONSCOPE_STRICT=1` ធ្វើឲ្យ SKIP នោះក្លាយជាការធ្លាក់ ➜ បើ base
// បាត់ម្តងទៀត នោះ CI ក្រហម មិនមែនស្ងាត់ទេ។ (ថ្នាក់ដដែលនឹង
// `CRUD_FLOW_STRICT` — មើល `.github/workflows/audit.yml`។)
const strictMode = process.env.VERSIONSCOPE_STRICT === '1';
try {
    git(['rev-parse', '--verify', BASE]);
} catch (e) {
    console.log((strictMode ? 'FAIL' : 'SKIP') + ' — រកមិនឃើញ base `' + BASE + '` (ត្រូវការ git និង origin/main)');
    if (strictMode) {
        console.log('        VERSIONSCOPE_STRICT=1 ➜ ការ SKIP ត្រូវរាប់ជាការធ្លាក់');
        console.log('        ជាធម្មតា៖ `actions/checkout` ត្រូវការ `fetch-depth: 0`');
    }
    process.exit(strictMode ? 1 : 0);
}

const changed = git(['diff', '--name-only', BASE]).split('\n').filter(Boolean);

// ប្រភពកំណែ ៖ ឯកសារ React (បើមាន) មុន ➜ ឯកសារ vanilla (`sw.js` · `app.js`) — ទាំងនៅ working tree និងនៅ ref
function versionOf(ref, app, reactFile, vanillaFile, re) {
    const candidates = [app + '/' + reactFile, app + '/' + vanillaFile];
    for (const rel of candidates) {
        let src;
        try {
            src = ref === null
                ? fs.readFileSync(rel === candidates[0] ? path.join(GIT_DIR, rel) : path.join(ROOT, rel), 'utf8')
                : git(['show', ref + ':' + rel]);
        } catch (e) { continue; }
        const m = src.match(re);
        if (m) return m[1];
    }
    return null;
}
function cacheVersionOf(ref, app) {
    return versionOf(ref, app, REACT_VERSION_FILES.cache, 'sw.js', /CACHE_VERSION\s*=\s*'([^']+)'/);
}
function appVersionOf(ref, app) {
    return versionOf(ref, app, REACT_VERSION_FILES.app, 'app.js', /APP_VERSION\s*=\s*'([^']+)'/);
}
// ការប្រែដែល **លើសពី** បន្ទាត់កំណែ (ការឡើងកំណែទទេ ≠ ការកែពិត)
function changedBeyond(file, versionLine) {
    return git(['diff', '-U0', BASE, '--', file])
        .split('\n')
        .filter((l) => /^[+-]/.test(l) && !/^[+-][+-]/.test(l))
        .some((l) => !versionLine.test(l));
}

// ⛔ ការបិទរន្ធនៃការលើកលែង `netlify/functions/` ខាងលើ។
// ការ **បន្ធូរ checker** ដោយគ្មានការចាក់សោ គឺជាការបង្កើតបៃតងក្លែងក្លាយសម្រាប់
// ជុំក្រោយ (មេរៀន «ការការពារដែលងាប់»)។ ការលើកលែងនោះឈរលើការពិត **តែមួយ** ៖
// បញ្ជីសំបករបស់ `sw.js` គ្មានផ្លូវណាក្រោម `netlify/` ឬ `tools/` ទេ។ ដូច្នេះ
// ត្រូវអះអាងការពិតនោះដោយផ្ទាល់ — បើថ្ងៃណាវាលែងពិត នោះការលើកលែងក្លាយជា
// គ្រោះថ្នាក់ ហើយ checker នេះត្រូវធ្លាក់ **មុន** ការកែនោះ ship។
for (const app of present) {
    let sw;
    try { sw = fs.readFileSync(path.join(ROOT, app, 'sw.js'), 'utf8'); } catch (e) { sw = ''; }
    const lists = sw.match(/(?:CORE_SHELL|OPTIONAL_SHELL)\s*=\s*\[([^\]]*)\]/g) || [];
    ok(app + ' ៖ ជាន់អប្បបរមា៖ ឃើញបញ្ជីសំបក ២ (CORE + OPTIONAL)',
        lists.length === 2, 'ឃើញ ' + lists.length + ' — ការស្កេនសំបកមិនអាចទុកចិត្តបាន');
    const entries = [];
    for (const l of lists) {
        for (const m of l.matchAll(/['"]([^'"]+)['"]/g)) entries.push(m[1]);
    }
    ok(app + ' ៖ ជាន់អប្បបរមា៖ ធាតុសំបក >= 8', entries.length >= 8, 'ឃើញ ' + entries.length);
    const leaked = entries.filter((e) => SERVER_ONLY_DIRS.test(e));
    ok('⛔ ' + app + ' ៖ សំបកគ្មានផ្លូវក្រោម `netlify/` ឬ `tools/`',
        leaked.length === 0,
        'ឃើញ ' + leaked.join(', ') + ' ➜ ការលើកលែង `netlify/functions/` ក្នុង '
            + 'NOT_SHIPPED លែងសុវត្ថិភាព ➜ ការកែឯកសារនោះនឹងទុកអ្នកប្រើនឹងសំបកចាស់');
    const feeds = entries.filter((e) => FEED_DATA.test(e));
    ok('⛔ ' + app + ' ៖ សំបកគ្មាន `announcements.json` (សារត្រូវទាញ network-only)',
        feeds.length === 0,
        'ឃើញ ' + feeds.join(', ') + ' ➜ ការលើកលែងក្នុង NOT_SHIPPED លែងសុវត្ថិភាព ➜ សារថែទាំនឹងជាប់ក្នុង cache ចាស់');
    const manifests = entries.filter((e) => BUILD_MANIFEST.test(e));
    ok('⛔ ' + app + ' ៖ សំបកគ្មាន `package.json` / `package-lock.json`',
        manifests.length === 0,
        'ឃើញ ' + manifests.join(', ') + ' ➜ ការលើកលែង manifest ក្នុង NOT_SHIPPED '
            + 'លែងសុវត្ថិភាព ➜ ការកែឯកសារនោះនឹងទុកអ្នកប្រើនឹងសំបកចាស់');
}

let anyChecked = 0;
for (const app of present) {
    if (isReactSource(app)) {
        const prefix = app + '/';
        const reactFiles = changed.filter((f) => f.startsWith(prefix)).map((f) => f.slice(prefix.length))
            .filter((f) => REACT_SHIPPED.test(f) && !REACT_AUDIT_ONLY.test(f) && !FEED_DATA.test(f));
        const versionOnly = new Map([
            [REACT_VERSION_FILES.app, /APP_VERSION\s*=/],
            [REACT_VERSION_FILES.cache, /CACHE_VERSION\s*=/],
            ['package.json', /"version"\s*:/],
            ['package-lock.json', /"version"\s*:/],
            ['public/manifest.json', /"version"\s*:/]
        ]);
        let reactExists = true;
        try { git(['cat-file', '-e', BASE + ':' + app + '/src/main.tsx']); } catch (e) { reactExists = false; }
        // base ជា App vanilla ➜ ឯកសារ ship ទាំងអស់ប្រែ (ការជំនួសទាំងស្រុង) ➜ ការកែពិតតាមនិយមន័យ
        const realFiles = reactExists
            ? reactFiles.filter((f) => !versionOnly.has(f) || changedBeyond(prefix + f, versionOnly.get(f)))
            : reactFiles;
        const swBumpedR = cacheVersionOf(BASE, app) !== cacheVersionOf(null, app);
        if (!reactFiles.length && !swBumpedR) continue;
        anyChecked++;
        if (realFiles.length) {
            ok(app + ' (React) ៖ កូដដែល ship ប្រែ ➜ `CACHE_VERSION` ត្រូវឡើង',
                swBumpedR, 'ឯកសារប្រែ៖ ' + realFiles.slice(0, 8).join(', ') + (realFiles.length > 8 ? ' …' : '') + ' តែ CACHE_VERSION នៅ ' + cacheVersionOf(null, app));
            const av = appVersionOf(null, app), avBase = appVersionOf(BASE, app);
            ok(app + ' (React) ៖ កូដដែល ship ប្រែ ➜ `APP_VERSION` ត្រូវឡើង',
                !!av && av !== avBase, 'នៅ ' + av + ' ដដែល');
        } else {
            ok('⛔ ' + app + ' (React) ៖ គ្មានការកែពិត ➜ **មិនត្រូវឡើងកំណែ/cache**',
                !swBumpedR,
                'CACHE_VERSION ' + cacheVersionOf(BASE, app) + ' ➜ ' + cacheVersionOf(null, app)
                    + ' ខណៈឯកសារ ship ប្រែតែបន្ទាត់កំណែ ➜ ការឡើងកំណែទទេបង្ខំអ្នកប្រើទាញសំបកទាំងមូលឡើងវិញ');
        }
        continue;
    }
    const shipped = changed.filter((f) =>
        f.startsWith(app + '/') && SHIPPED.test(f) && !NOT_SHIPPED.test(f) && f !== app + '/sw.js');
    const swBumped = cacheVersionOf(BASE, app) !== cacheVersionOf(null, app);

    // ⛔ `sw.js` **ជាកូដដែល ship ដែរ** — វាត្រូវដកចេញពី `shipped` ខាងលើ
    // តែម្យ៉ាងព្រោះ `CACHE_VERSION` រស់នៅក្នុងវា ➜ ការឡើងកំណែខ្លួនវាធ្វើឲ្យ
    // ឯកសារនោះប្រែ ➜ រង្វិលជុំ។ ប៉ុន្តែការដករាល់ការប្រែរបស់វាចោលបង្កើត
    // ចន្លោះផ្ទុយ៖ ការកែ **តក្កវិជ្ជាពិត** ក្នុង `sw.js` (ការសម្អាត cache,
    // ការដោះ slot, ផ្លូវធ្លាក់ចុះ) ត្រូវអានថា «គ្មានការកែពិត» ➜ checker
    // **ហាមឡើង cache** ➜ អ្នកប្រើជាប់នឹង service worker ចាស់ជារៀងរហូត។
    // ដំណោះស្រាយដដែលនឹង `app.js`៖ រាប់វា លុះត្រាតែការប្រែ **លើសពី**
    // បន្ទាត់ `CACHE_VERSION`។
    const swFile = app + '/sw.js';
    let swLogicChanged = false;
    if (changed.indexOf(swFile) !== -1) {
        const swDiff = git(['diff', '-U0', BASE, '--', swFile])
            .split('\n')
            .filter((l) => /^[+-]/.test(l) && !/^[+-][+-]/.test(l));
        swLogicChanged = swDiff.some((l) => !/CACHE_VERSION\s*=/.test(l));
    }

    // ការប្រែក្នុង app.js ក្រៅពីបន្ទាត់ APP_VERSION
    let realCodeChange = shipped.length > 0 || swLogicChanged;
    if (!swLogicChanged && shipped.length === 1 && shipped[0] === app + '/app.js') {
        const diff = git(['diff', '-U0', BASE, '--', app + '/app.js'])
            .split('\n')
            .filter((l) => /^[+-]/.test(l) && !/^[+-][+-]/.test(l));
        realCodeChange = diff.some((l) => !/APP_VERSION\s*=/.test(l));
    }

    if (!shipped.length && !swBumped) continue;
    anyChecked++;

    if (realCodeChange) {
        ok(app + ' ៖ កូដដែល ship ប្រែ ➜ `CACHE_VERSION` ត្រូវឡើង',
            swBumped, 'ឯកសារប្រែ៖ ' + shipped.concat(swLogicChanged ? [swFile] : []).join(', ') + ' តែ CACHE_VERSION នៅ '
                + cacheVersionOf(null, app));
        const av = appVersionOf(null, app), avBase = appVersionOf(BASE, app);
        if (av && avBase) {
            ok(app + ' ៖ កូដដែល ship ប្រែ ➜ `APP_VERSION` ត្រូវឡើង',
                av !== avBase, 'នៅ ' + av + ' ដដែល');
        }
    } else {
        ok('⛔ ' + app + ' ៖ គ្មានការកែពិត ➜ **មិនត្រូវឡើងកំណែ/cache**',
            !swBumped,
            'CACHE_VERSION ' + cacheVersionOf(BASE, app) + ' ➜ ' + cacheVersionOf(null, app)
                + ' ខណៈគ្មានឯកសារកូដណាប្រែ (ក្រៅពីបន្ទាត់ APP_VERSION)'
                + '\n         ➜ ការឡើងកំណែទទេបង្ខំអ្នកប្រើទាញសំបកទាំងមូលឡើងវិញ');
    }
}

if (!anyChecked) console.log('   (គ្មាន App ណាប្រែធៀបនឹង ' + BASE + ')');

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
