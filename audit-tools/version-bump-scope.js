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

// ឯកសារដែលបម្រើដល់អ្នកប្រើពិត — README/manifest មិនប៉ះឥរិយាបថ runtime
const SHIPPED = /\.(js|css|html|wasm|json)$/;
// ⛔ `netlify/functions/` រត់លើ **server** — វាមិនដែលចូលសំបករបស់ `sw.js` ទេ
// (`sw.js` បញ្ជូន `/.netlify/functions/` ទៅ `networkOnly()` ដោយផ្ទាល់) ➜ ការកែ
// Function មិនអាចធ្វើឲ្យសំបកដែល cache ចាស់បានឡើយ។ បើរាប់វាជាកូដ ship នោះ
// ការកែខាង server បង្ខំ `CACHE_VERSION` ឲ្យឡើង ➜ **អ្នកប្រើទាំងអស់ទាញសំបក
// PWA ទាំងមូលឡើងវិញដោយឥតប្រយោជន៍** — ជាកំហុសដដែលនឹងច្បាប់ទី ៦។
// ⛔ ការលើកលែងនេះមិនឈរតែឯងទេ — ការអះអាង «សំបកគ្មានផ្លូវ server» ខាងក្រោម
// ចាក់សោវា ៖ បើថ្ងៃណាឯកសារសំបកពិតចូល `netlify/` ឬ `tools/` នោះវាធ្លាក់។
const NOT_SHIPPED = /(README|netlify\.toml|netlify\/functions\/|firebase-database\.rules\.json|\/test\.js$)/;
const SERVER_ONLY_DIRS = /(^|\/)(netlify|tools)\//;

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + detail : '')); }
}

function git(args) {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
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

function cacheVersionOf(ref, app) {
    let src;
    try {
        src = ref === null
            ? fs.readFileSync(path.join(ROOT, app, 'sw.js'), 'utf8')
            : git(['show', ref + ':' + app + '/sw.js']);
    } catch (e) { return null; }
    const m = src.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
    return m ? m[1] : null;
}

function appVersionOf(ref, app) {
    let src;
    try {
        src = ref === null
            ? fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8')
            : git(['show', ref + ':' + app + '/app.js']);
    } catch (e) { return null; }
    const m = src.match(/APP_VERSION\s*=\s*'([^']+)'/);
    return m ? m[1] : null;
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
}

let anyChecked = 0;
for (const app of present) {
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
