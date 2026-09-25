/**
 * អ្នកយាម App Android (Capacitor) — វាស់អ្វីដែល **Gradle មិនអាចវាស់នៅទីនេះ**
 * (គ្មាន Android SDK) និងអ្វីដែល **ឃ្លាតស្ងាត់ៗ** ពេលកែកន្លែងមួយភ្លេចមួយទៀត ៖
 *
 *   ១. លេខកំណែ APK ដេរីវេពី `APP_VERSION` (គ្មាន literal ទី ២) · `package.json`
 *      ស្មើ `APP_VERSION` · versionCode មិនប៉ះគ្នា
 *   ២. appId តែមួយ ៖ capacitor.config.ts ↔ build.gradle ↔ strings.xml
 *   ៣. សិទ្ធិ ៖ កាមេរ៉ា · ញ័រ · ហាម backup (កៅអី License មិនត្រូវក្លែង)
 *   ៤. Logo ៖ រាល់ density មាន PNG ៤ ទំហំត្រឹមត្រូវ · adaptive/themed icon
 *   ៥. Plugin ៖ រាល់ plugin ក្នុង package.json ត្រូវ sync ចូល Android project
 *   ៦. Web មិនផ្ទុកកូដ native ៖ គ្មាន import static ពី `@capacitor/*`/`@capgo/*`
 *      ក្រៅ `src/platform/native-biometric.ts` · chunk native មិនចូល Service Worker
 *   ៧. config build Android ↔ template របស់ Capacitor ដែលដំឡើង ៖ SDK · AndroidX ស្មើ ·
 *      AGP · Gradle · google-services ស្ថិតក្នុងខ្សែ major.minor ដដែល (patch ឡើងបាន)
 *
 *   node scripts/android-check.mjs   (ANDROIDCHECK_ROOT=<ថត> ដើម្បីចង្អុលទៅ tree ផ្សេង)
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ANDROIDCHECK_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const oks = [];
const ok = (label, cond, got) => { (cond ? oks : fails).push(cond ? label : `${label}${got !== undefined ? '  ➜ ' + got : ''}`); };
const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

function pngSize(rel) {
    try {
        const b = fs.readFileSync(path.join(ROOT, rel));
        if (b.readUInt32BE(0) !== 0x89504e47) return null;
        return [b.readUInt32BE(16), b.readUInt32BE(20)];
    } catch {
        return null;
    }
}

/* ── ១. លេខកំណែ ─────────────────────────────────────────────────────── */
const versionSrc = read('src/core/version.ts');
const vm = versionSrc.match(/APP_VERSION\s*=\s*'(\d+)\.(\d+)\.(\d+)'/);
ok('អាន APP_VERSION (X.Y.Z) ពី src/core/version.ts', !!vm);
const gradle = read('android/app/build.gradle');
ok('ជាន់អប្បបរមា ៖ អាន android/app/build.gradle បាន', gradle.length > 500, gradle.length);
if (vm) {
    const [major, minor, patch] = vm.slice(1).map(Number);
    const name = `${major}.${minor}.${patch}`;
    const code = major * 1000000 + minor * 1000 + patch;
    ok('package.json version ស្មើ APP_VERSION', JSON.parse(read('package.json') || '{}').version === name, JSON.parse(read('package.json') || '{}').version);
    ok('versionCode ដែលដេរីវេបាន ស្ថិតក្នុងព្រំដែន Play (≤ 2100000000)', code > 0 && code <= 2100000000, code);
    console.log(`   ℹ️  APK ៖ versionName ${name} · versionCode ${code}`);
}
ok('build.gradle អាន APP_VERSION ពី ../src/core/version.ts', gradle.includes("rootProject.file('../src/core/version.ts')"));
ok('versionName ដេរីវេ (គ្មាន literal)', /versionName\s+zoewVersion\.name/.test(gradle) && !/versionName\s+["']/.test(gradle));
ok('versionCode ដេរីវេ (គ្មាន literal)', /versionCode\s+zoewVersion\.code/.test(gradle) && !/versionCode\s+\d/.test(gradle));
ok('រូបមន្ត versionCode = major×1000000 + minor×1000 + patch', /major \* 1000000 \+ minor \* 1000 \+ patch/.test(gradle));
ok('APP_VERSION ខូច ➜ build បដិសេធ (មិនចេញលេខខុសស្ងាត់ៗ)', /throw new GradleException/.test(gradle));

/* ── ២. appId ────────────────────────────────────────────────────────── */
const capConfig = read('capacitor.config.ts');
const appId = (capConfig.match(/appId:\s*'([^']+)'/) || [])[1];
ok('capacitor.config.ts មាន appId', !!appId);
ok('build.gradle applicationId ស្មើ appId', gradle.includes(`applicationId "${appId}"`));
ok('build.gradle namespace ស្មើ appId', gradle.includes(`namespace = "${appId}"`));
ok('strings.xml package_name ស្មើ appId', read('android/app/src/main/res/values/strings.xml').includes(`<string name="package_name">${appId}</string>`));
const mainActivity = read(`android/app/src/main/java/${(appId || '').split('.').join('/')}/MainActivity.java`);
ok('MainActivity ស្ថិតក្នុង package របស់ appId', mainActivity.includes(`package ${appId};`));
ok('webDir = dist (build របស់ Vite)', /webDir:\s*'dist'/.test(capConfig));
ok('SystemBars insetsHandling = native', /insetsHandling:\s*'native'/.test(capConfig));

/* ── ៣. សិទ្ធិ ─────────────────────────────────────────────────────────── */
const manifest = read('android/app/src/main/AndroidManifest.xml');
ok('សិទ្ធិ CAMERA (ស្កេន Barcode)', manifest.includes('android.permission.CAMERA'));
ok('សិទ្ធិ VIBRATE (សញ្ញាស្កេន)', manifest.includes('android.permission.VIBRATE'));
ok('កាមេរ៉ាមិនមែនលក្ខខណ្ឌដំឡើង (required=false)', /android\.hardware\.camera"\s+android:required="false"/.test(manifest));
ok('ហាម backup (កៅអី License មិនត្រូវក្លែងតាមការស្តារ)', manifest.includes('android:allowBackup="false"'));
ok('ហាមផ្ទេរទិន្នន័យទៅទូរស័ព្ទថ្មី (dataExtractionRules)', manifest.includes('@xml/data_extraction_rules') &&
    /<device-transfer>[\s\S]*domain="root"[\s\S]*<\/device-transfer>/.test(read('android/app/src/main/res/xml/data_extraction_rules.xml')));
ok('FileProvider សម្រាប់ Share (Export)', manifest.includes('androidx.core.content.FileProvider') &&
    read('android/app/src/main/res/xml/file_paths.xml').includes('<cache-path'));

/* ── ៤. Logo ──────────────────────────────────────────────────────────── */
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
let iconCount = 0;
for (const [d, s] of Object.entries(DENSITIES)) {
    const want = { ic_launcher: 48 * s, ic_launcher_round: 48 * s, ic_launcher_foreground: 108 * s, ic_launcher_monochrome: 108 * s };
    for (const [name, px] of Object.entries(want)) {
        const size = pngSize(`android/app/src/main/res/mipmap-${d}/${name}.png`);
        const good = !!size && size[0] === Math.round(px) && size[1] === Math.round(px);
        if (good) iconCount++;
        else fails.push(`icon ${d}/${name}.png ត្រូវ ${Math.round(px)}px  ➜ ${size ? size.join('×') : 'អវត្តមាន'}`);
    }
}
ok('រូប icon ២០ (៥ density × ៤)', iconCount === 20, iconCount);
for (const n of ['ic_launcher', 'ic_launcher_round']) {
    const xml = read(`android/app/src/main/res/mipmap-anydpi-v26/${n}.xml`);
    ok(`${n}.xml ៖ adaptive (gradient + គូប + themed)`, xml.includes('@drawable/ic_launcher_background') &&
        xml.includes('@mipmap/ic_launcher_foreground') && xml.includes('@mipmap/ic_launcher_monochrome'));
}
ok('រូបមេ resources/icon.svg មាន', exists('resources/icon.svg'));
ok('splash.png មិនមែន template របស់ Capacitor (កើតពីរូបមេ)', !!pngSize('android/app/src/main/res/drawable-port-xxxhdpi/splash.png'));

/* ── ៥. Plugin ────────────────────────────────────────────────────────── */
const pkg = JSON.parse(read('package.json') || '{}');
const allDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
const plugins = Object.keys(allDeps).filter((n) => /^@(capacitor|capgo)\//.test(n) &&
    !['@capacitor/core', '@capacitor/cli', '@capacitor/android'].includes(n));
const settings = read('android/capacitor.settings.gradle');
ok('ជាន់អប្បបរមា ៖ plugin native >= 5', plugins.length >= 5, plugins.length);
for (const name of plugins) {
    const dir = `../node_modules/${name}/android`;
    ok(`plugin ${name} sync ចូល Android project`, settings.includes(dir));
}
for (const want of ['@capacitor/app', '@capgo/capacitor-native-biometric', '@capacitor/filesystem', '@capacitor/share', '@capgo/capacitor-printer']) {
    ok(`plugin ដែល App ពឹង ៖ ${want}`, plugins.includes(want));
}

/* ── ៦. Web មិនផ្ទុកកូដ native ─────────────────────────────────────────── */
function walk(dir, out = []) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full, out);
        else if (/\.(ts|tsx)$/.test(name)) out.push(full);
    }
    return out;
}
const srcFiles = exists('src') ? walk(path.join(ROOT, 'src')) : [];
ok('ជាន់អប្បបរមា ៖ ស្កេនឯកសារ src >= 100', srcFiles.length >= 100, srcFiles.length);
const staticNative = srcFiles.filter((f) => /^\s*import\s[^;]*from\s+['"]@(capacitor|capgo)\//m.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
ok('import static ពី plugin native មានតែក្នុង src/platform/native-biometric.ts',
    staticNative.length === 1 && staticNative[0] === 'src/platform/native-biometric.ts', staticNative.join(', '));
const dynamicBiometric = srcFiles.filter((f) => /import\(['"][^'"]*platform\/native-biometric['"]\)/.test(fs.readFileSync(f, 'utf8'))).length;
const staticBiometric = srcFiles.filter((f) => /from\s+['"][^'"]*platform\/native-biometric['"]/.test(fs.readFileSync(f, 'utf8'))).length;
ok('native-biometric ផ្ទុកតាម import() តែប៉ុណ្ណោះ', dynamicBiometric >= 1 && staticBiometric === 0, `${dynamicBiometric}/${staticBiometric}`);

if (exists('dist/index.html')) {
    const assets = fs.readdirSync(path.join(ROOT, 'dist/assets'));
    const nativeChunk = assets.find((n) => /^native-plugins-.*\.js$/.test(n));
    ok('build មាន chunk native ដាច់ដោយឡែក', !!nativeChunk);
    const html = read('dist/index.html');
    const entry = (html.match(/src="\.\/assets\/(index-[^"]+\.js)"/) || [])[1];
    const entrySrc = entry ? read(`dist/assets/${entry}`) : '';
    ok('ជាន់អប្បបរមា ៖ អាន entry chunk បាន', entrySrc.length > 10000, entrySrc.length);
    ok('index.html មិនផ្ទុក chunk native', !!nativeChunk && !html.includes(nativeChunk));
    const staticImports = [...entrySrc.matchAll(/(?:^|;)import\s*\{[^}]*\}\s*from\s*"\.\/([^"]+)"/g)].map((m) => m[1]);
    ok('entry មិន import chunk native ដោយ static', !!nativeChunk && !staticImports.includes(nativeChunk), staticImports.join(', '));
    ok('Service Worker មិន cache chunk native', !!nativeChunk && !read('dist/sw.js').includes(nativeChunk));
}

/* ── ៧. config build Android ↔ template របស់ Capacitor ─────────────────
 * ⛔ plugin Capacitor ទាំងអស់ត្រូវបានសាកជាមួយ AGP · Gradle · SDK · AndroidX ដែល template របស់
 *    Capacitor កំណែនោះប្រកាស។ ការឡើងលើសខ្សែនោះ (ឧ. AGP 9 · compileSdk 37 · androidx.core 1.19 ដែល
 *    ទាមទារ AGP 9.1) ធ្លាក់តែពេល **build ក្នុង Android Studio** — ម៉ាស៊ីននេះគ្មាន Android SDK ➜ វាស់មិនបាន។
 *    ទិសផ្ទុយ ៖ ឡើង Capacitor major តែភ្លេច config Android ➜ ក៏ធ្លាក់ដែរ (template ប្រែ)។ */
function readTarGz(rel) {
    const out = new Map();
    let buf;
    try { buf = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, rel))); } catch { return out; }
    for (let off = 0; off + 512 <= buf.length;) {
        const header = buf.subarray(off, off + 512);
        if (header.every((x) => x === 0)) break;
        const str = (a, n) => header.subarray(a, a + n).toString('utf8').replace(/\0.*$/s, '');
        const name = (str(345, 155) ? str(345, 155) + '/' : '') + str(0, 100);
        const size = parseInt(str(124, 12).trim() || '0', 8);
        out.set(name.replace(/^(\.\/|package\/)/, ''), buf.subarray(off + 512, off + 512 + size).toString('utf8'));
        off += 512 + Math.ceil(size / 512) * 512;
    }
    return out;
}
const extOf = (src) => Object.fromEntries([...((src.match(/ext\s*\{([\s\S]*?)\}/) || [])[1] || '').matchAll(/(\w+)\s*=\s*'?([\w.]+)'?/g)].map((m) => [m[1], m[2]]));
const verOf = (src, re) => ((src.match(re) || [])[1] || '').split('.').map(Number);
const sameLine = (mine, tpl) => tpl.length >= 2 && mine.length >= 2 && mine[0] === tpl[0] && mine[1] === tpl[1] && (mine[2] || 0) >= (tpl[2] || 0);
const tpl = readTarGz('node_modules/@capacitor/cli/assets/android-template.tar.gz');
const tplExt = extOf(tpl.get('variables.gradle') || '');
const myExt = extOf(read('android/variables.gradle'));
ok('ជាន់អប្បបរមា ៖ អាន template Android របស់ Capacitor ដែលដំឡើង (ext >= 10)', Object.keys(tplExt).length >= 10, Object.keys(tplExt).length);
const extDrift = Object.keys(tplExt).filter((k) => myExt[k] !== tplExt[k]).map((k) => `${k}=${myExt[k]} (template ${tplExt[k]})`);
ok('variables.gradle (SDK · AndroidX) ស្មើ template របស់ Capacitor', Object.keys(tplExt).length >= 10 && !extDrift.length, extDrift.join(', '));
const AGP_RE = /com\.android\.tools\.build:gradle:([\d.]+)/;
const GMS_RE = /com\.google\.gms:google-services:([\d.]+)/;
const GRADLE_RE = /gradle-([\d.]+)-(?:all|bin)\.zip/;
const rootGradle = read('android/build.gradle');
const wrapper = read('android/gradle/wrapper/gradle-wrapper.properties');
for (const [label, mineSrc, tplSrc, re] of [
    ['Android Gradle Plugin', rootGradle, tpl.get('build.gradle') || '', AGP_RE],
    ['google-services', rootGradle, tpl.get('build.gradle') || '', GMS_RE],
    ['Gradle wrapper', wrapper, tpl.get('gradle/wrapper/gradle-wrapper.properties') || '', GRADLE_RE]
]) {
    const mine = verOf(mineSrc, re);
    const want = verOf(tplSrc, re);
    ok(`${label} ស្ថិតក្នុងខ្សែ ${want.slice(0, 2).join('.')}.x របស់ template (patch >= ${want.join('.')})`, sameLine(mine, want), mine.join('.'));
}
const capMajor = (name) => Number((JSON.parse(read(`node_modules/${name}/package.json`) || '{}').version || '').split('.')[0]);
const majors = ['@capacitor/core', '@capacitor/android', '@capacitor/cli'].map(capMajor);
ok('@capacitor/core · android · cli ជា major ដដែល', majors.every((m) => m > 0 && m === majors[0]), majors.join(' · '));

for (const line of oks) console.log('   ok   ' + line);
for (const line of fails) console.log('   FAIL ' + line);
console.log(`\n${fails.length ? '❌' : '✅'} android:check — ${oks.length} ok, ${fails.length} FAIL`);
process.exitCode = fails.length ? 1 : 0;
