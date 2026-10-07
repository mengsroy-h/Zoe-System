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
 *   ៨. Release APK (`.github/workflows/android-release.yml`) ៖ ឈ្មោះ env របស់ keystore ស្មើនឹងអ្វីដែល
 *      `build.gradle` អាន · គ្មានផ្លូវធ្លាក់ចុះទៅ debug key · keystore មិនចូល repo · វិញ្ញាបនបត្រ APK
 *      ត្រូវស្មើ pin `android/release-cert.sha256` មុន Release
 *
 *   node scripts/android-check.mjs   (ANDROIDCHECK_ROOT=<ថត> ដើម្បីចង្អុលទៅ tree ផ្សេង)
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splashIconVector, splashPlateGeometry, parseIconSvg, SPLASH_ICON_DP, SPLASH_SAFE_DIAMETER_DP } from './android-splash-vector.mjs';

const ROOT = process.env.ANDROIDCHECK_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const oks = [];
const ok = (label, cond, got) => { (cond ? oks : fails).push(cond ? label : `${label}${got !== undefined ? '  ➜ ' + got : ''}`); };
const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
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
/* ⛔ ល្បឿនអេក្រង់ ៖ ROM ជាច្រើនឲ្យ Chrome រត់ 90/120Hz តែកំណត់ App ផ្សេងត្រឹម 60Hz បើ App មិនស្នើ ➜ APK ត្រូវស្នើ mode ល្បឿនខ្ពស់បំផុត
      (ទំហំដដែល) រាល់ onCreate និង onResume ហើយការបរាជ័យមិនត្រូវធ្វើឲ្យ App គាំង */
const javaMethodBody = (src, signature) => {
    const at = src.indexOf(signature);
    if (at === -1) return '';
    const open = src.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
    }
    return '';
};
ok('MainActivity ៖ onCreate ស្នើល្បឿនអេក្រង់ខ្ពស់បំផុត', /preferHighestRefreshRate\(\)/.test(javaMethodBody(mainActivity, 'void onCreate(')));
ok('MainActivity ៖ onResume ស្នើម្តងទៀត (ត្រឡប់ពី App ផ្សេង)', /preferHighestRefreshRate\(\)/.test(javaMethodBody(mainActivity, 'void onResume(')));
const refreshBody = javaMethodBody(mainActivity, 'void preferHighestRefreshRate(');
ok('MainActivity ៖ កំណត់ preferredDisplayModeId តាម mode ដែលជ្រើស', /preferredDisplayModeId\s*=\s*best\.getModeId\(\)/.test(refreshBody) && /setAttributes\(/.test(refreshBody));
ok('MainActivity ៖ ការបរាជ័យមិនគាំង App (catch RuntimeException)', /catch\s*\(\s*RuntimeException/.test(refreshBody));
const pickBody = javaMethodBody(mainActivity, 'Display.Mode highestRefreshMode(');
ok('MainActivity ៖ ជ្រើសតែ mode ទំហំដដែល ហើយ refresh ខ្ពស់ជាង',
    /boolean sameSize = mode\.getPhysicalWidth\(\) == current\.getPhysicalWidth\(\)\s*&& mode\.getPhysicalHeight\(\) == current\.getPhysicalHeight\(\);/.test(pickBody) &&
    /if \(sameSize && mode\.getRefreshRate\(\) > best\.getRefreshRate\(\)\) best = mode;/.test(pickBody));
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
const pushSrc = read('src/features/push.ts');
const fcmChannel = (pushSrc.match(/export const FCM_CHANNEL_ID = '([a-z_]+)';/) || [])[1] || '';
ok('សិទ្ធិ POST_NOTIFICATIONS (Android 13+ ៖ ជូនដំណឹង FCM)', manifest.includes('android.permission.POST_NOTIFICATIONS'));
ok('FCM ៖ channel លំនាំដើមក្នុង manifest = FCM_CHANNEL_ID ក្នុង push.ts', !!fcmChannel &&
    new RegExp('default_notification_channel_id"\\s+android:value="' + fcmChannel + '"').test(manifest), fcmChannel);
ok('FCM ៖ រូបតំណាងតូច (monochrome vector) មានពិត', /default_notification_icon"\s+android:resource="@drawable\/ic_stat_notify"/.test(manifest) &&
    /<vector[\s\S]*android:fillColor="#FFFFFFFF"/.test(read('android/app/src/main/res/drawable/ic_stat_notify.xml')));
ok('google-services.json មិនចូល repo (android/.gitignore)', /^app\/google-services\.json$/m.test(read('android/.gitignore')));
const manifestPermissions = new Set([...manifest.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((m) => m[1]));
const listFiles = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []));
const onlineUsers = listFiles('src').filter((f) => /navigator\.onLine|['"](online|offline)['"]/.test(read(f)));
ok('⛔ សិទ្ធិ ACCESS_NETWORK_STATE ៖ WebView ផ្តល់ navigator.onLine · online/offline តែពេលមានសិទ្ធិនេះ (បើអត់ ➜ onLine = true ជានិច្ច)',
    onlineUsers.length > 0 && manifestPermissions.has('android.permission.ACCESS_NETWORK_STATE'),
    'ឯកសារដែលពឹង onLine ' + onlineUsers.length + ' · សិទ្ធិ ' + [...manifestPermissions].join(','));

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

/* ── ៤ខ. Splash ពេលបើក (launch theme) ────────────────────────────────────
 * ⛔ `android:background` ក្នុង theme ជា background លំនាំដើមរបស់ **គ្រប់ View** (មិនមែនតែ window) ➜ អេក្រង់ចាប់ផ្តើម
 *    គូរ splash.png ពង្រីក/ច្របាច់ក្នុងរាល់ View (រួមរបា «ZoeW») ➜ វាស់បានលើ tablet 11.5" (រូបថតម្ចាស់គម្រោង)។
 * ⛔ `postSplashScreenTheme` លំនាំដើមរបស់ core-splashscreen គឺ `?android:attr/theme` ➜ ត្រូវចង្អុលទៅ theme ដែល
 *    `BridgeActivity` ប្រើ (ដេរីវេពីប្រភព Capacitor ដែលដំឡើង) មិនមែនធ្លាក់ទៅ `AppTheme` ដែលមាន ActionBar។ */
function styleItems(xml, name) {
    const m = xml.match(new RegExp(`<style\\s+name="${name.replace(/\./g, '\\.')}"[^>]*>([\\s\\S]*?)</style>`));
    if (!m) return null;
    const items = new Map();
    for (const it of m[1].matchAll(/<item\s+name="([^"]+)"\s*>\s*([^<]*?)\s*<\/item>/g)) items.set(it[1], it[2]);
    return items;
}
const stylesXml = read('android/app/src/main/res/values/styles.xml');
const manifestXml = read('android/app/src/main/AndroidManifest.xml');
const launchTheme = ((manifestXml.match(/<activity[\s\S]*?android:theme="@style\/([^"]+)"[\s\S]*?android\.intent\.category\.LAUNCHER/) || [])[1]) || '';
ok('Activity ចាប់ផ្តើមមាន launch theme', !!launchTheme, launchTheme || 'អវត្តមាន');
const launch = styleItems(stylesXml, launchTheme) || new Map();
ok(`${launchTheme} ៖ parent Theme.SplashScreen`, new RegExp(`name="${launchTheme.replace(/\./g, '\\.')}"\\s+parent="Theme\\.SplashScreen"`).test(stylesXml));
ok(`${launchTheme} ៖ ⛔ គ្មាន android:background (វាលាតចូលគ្រប់ View)`, !launch.has('android:background'), launch.get('android:background'));
ok(`${launchTheme} ៖ គ្មាន title (android:windowNoTitle · windowNoTitle = true)`,
    launch.get('android:windowNoTitle') === 'true' && launch.get('windowNoTitle') === 'true',
    [launch.get('android:windowNoTitle'), launch.get('windowNoTitle')].join(' · '));
ok(`${launchTheme} ៖ គ្មាន ActionBar (android:windowActionBar · windowActionBar = false)`,
    launch.get('android:windowActionBar') === 'false' && launch.get('windowActionBar') === 'false',
    [launch.get('android:windowActionBar'), launch.get('windowActionBar')].join(' · '));
const bridgeSrc = read('node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/BridgeActivity.java');
const bridgeTheme = ((bridgeSrc.match(/setTheme\(R\.style\.(\w+)\)/) || [])[1] || '').replace(/_/g, '.');
ok('ជាន់អប្បបរមា ៖ theme ដែល BridgeActivity ប្រើ (ពីប្រភព Capacitor)', !!bridgeTheme && !!styleItems(stylesXml, bridgeTheme), bridgeTheme || 'អវត្តមាន');
ok(`${launchTheme} ៖ postSplashScreenTheme = @style/${bridgeTheme}`, launch.get('postSplashScreenTheme') === `@style/${bridgeTheme}`, launch.get('postSplashScreenTheme'));
const capSplashBg = ((read('capacitor.config.ts').match(/SplashScreen:\s*\{[\s\S]*?backgroundColor:\s*'([^']+)'/) || [])[1] || '').toLowerCase();
const bgRef = launch.get('windowSplashScreenBackground') || '';
const bgName = (bgRef.match(/^@color\/(\w+)$/) || [])[1];
const colorsXml = fs.existsSync(path.join(ROOT, 'android/app/src/main/res/values')) ?
    fs.readdirSync(path.join(ROOT, 'android/app/src/main/res/values')).map((f) => read(`android/app/src/main/res/values/${f}`)).join('\n') : '';
const bgValue = bgName ? (((colorsXml.match(new RegExp(`<color\\s+name="${bgName}"\\s*>\\s*([^<\\s]+)\\s*</color>`)) || [])[1]) || '').toLowerCase() : '';
ok(`${launchTheme} ៖ windowSplashScreenBackground ស្មើ SplashScreen.backgroundColor (${capSplashBg || '?'})`,
    !!capSplashBg && bgValue === capSplashBg, bgRef + ' = ' + (bgValue || 'អវត្តមាន'));
const bodyBg = ((read('src/styles/app.css').match(/--body-bg:\s*(#[0-9a-fA-F]{3,8})/) || [])[1] || '').toLowerCase();
const bridgeItems = styleItems(stylesXml, bridgeTheme) || new Map();
const windowBgRef = bridgeItems.get('android:windowBackground') || '';
const windowBgName = (windowBgRef.match(/^@color\/(\w+)$/) || [])[1];
const windowBgValue = windowBgName ? (((colorsXml.match(new RegExp(`<color\\s+name="${windowBgName}"\\s*>\\s*([^<\\s]+)\\s*</color>`)) || [])[1]) || '').toLowerCase() : '';
ok(`${bridgeTheme} ៖ android:windowBackground ស្មើ --body-bg របស់ App (${bodyBg || '?'}) ➜ ផ្ទៃក្រោម WebView ពេល keyboard កំពុងឡើង មិនមែនស/ខ្មៅ`,
    !!bodyBg && windowBgValue === bodyBg, windowBgRef + ' = ' + (windowBgValue || 'អវត្តមាន'));
const iconRef = launch.get('windowSplashScreenAnimatedIcon') || '';
ok(`${launchTheme} ៖ windowSplashScreenAnimatedIcon = @drawable/splash_icon (vector · មិនមែន PNG/mipmap ដែលព្រិលពេលពង្រីក ឬ sym_def_app_icon លំនាំដើម)`,
    iconRef === '@drawable/splash_icon', iconRef || 'អវត្តមាន');
const splashXml = read('android/app/src/main/res/drawable/splash_icon.xml');
const iconSvg = read('resources/icon.svg');
let splashWant;
let splashGeo = null;
try { splashWant = splashIconVector(iconSvg); splashGeo = splashPlateGeometry(parseIconSvg(iconSvg)); } catch (e) { splashWant = 'ERROR ' + e.message; }
ok('splash_icon.xml ជា <vector> ទំហំ ' + SPLASH_ICON_DP + 'dp', /^<\?xml[^>]*>\s*<vector\b/.test(splashXml) &&
    splashXml.includes(`android:width="${SPLASH_ICON_DP}dp"`) && splashXml.includes(`android:height="${SPLASH_ICON_DP}dp"`));
ok('splash_icon.xml ដេរីវេពី resources/icon.svg (logo ប្តូរ ➜ `npm run android:icons`)', !!splashXml && splashXml === splashWant,
    splashXml ? (splashWant.startsWith('ERROR') ? splashWant : 'ខុសពីលទ្ធផលរបស់ android-splash-vector.mjs') : 'អវត្តមាន');
ok(`ប្រអប់ splash ស្ថិតក្នុងរង្វង់សុវត្ថិភាព ${SPLASH_SAFE_DIAMETER_DP}dp (ROM បិទជ្រុង ឬមិនបិទ ➜ រូបដដែល)`,
    !!splashGeo && splashGeo.reach <= SPLASH_SAFE_DIAMETER_DP / 2, splashGeo ? splashGeo.reach.toFixed(1) + 'dp ពីកណ្តាល' : 'វាស់មិនបាន');

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
for (const want of ['@capacitor/app', '@capgo/capacitor-native-biometric', '@capacitor/filesystem', '@capacitor/share', '@capgo/capacitor-printer', '@capacitor/push-notifications']) {
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

/* ── ៨. Release APK ↔ keystore ────────────────────────────────────────────
 * ⛔ APK ត្រូវ sign ដោយ keystore **ដដែលជានិច្ច** ៖ keystore ផ្សេង ➜ Android បដិសេធការដំឡើងជាន់ ➜ អ្នកប្រើលុប App
 *    ➜ បាត់ PIN · ការចូលប្រព័ន្ធ · កៅអី License (Device ID ថ្មី)។ debug key របស់ runner ប្រែរាល់ការរត់ ➜ ហាមជាដាច់ខាត។ */
const releaseWf = read('../.github/workflows/android-release.yml');
ok('ជាន់អប្បបរមា ៖ អាន workflow release APK បាន', releaseWf.length > 1000, releaseWf.length);
const signEnv = [...new Set([...gradle.matchAll(/System\.getenv\('([A-Z0-9_]+)'\)/g)].map((m) => m[1]))];
ok('build.gradle អាន env របស់ keystore យ៉ាងតិច ៤', signEnv.length >= 4, signEnv.join(' · '));
const unset = signEnv.filter((n) => !new RegExp('\\b' + n + '\\b').test(releaseWf));
ok('workflow កំណត់ env ទាំងអស់ដែល build.gradle អាន (ស្នាមភ្ជាប់ ២ ឯកសារ)', signEnv.length >= 4 && !unset.length, unset.join(' · '));
ok('build.gradle ដាក់ signingConfig តែពេលមាន keystore (Android Studio នៅដើរធម្មតា)',
    /if \(System\.getenv\('ZOEW_KEYSTORE_FILE'\)\)\s*\{\s*signingConfig signingConfigs\.release/.test(gradle));
ok('workflow គ្មានផ្លូវ debug/unsigned (assembleDebug · debug.keystore)', releaseWf.length > 1000 && !/assembleDebug|debug\.keystore/.test(releaseWf));
const gradleStep = (releaseWf.match(/- name: Build APK[\s\S]*?(?=\n {6}- )/) || [''])[0];
ok('ជំហាន gradle រត់តែពេល secret keystore គ្រប់', /assembleRelease/.test(gradleStep) && /if: steps\.keystore\.outputs\.ready == 'true'/.test(gradleStep));
ok('workflow ផ្ទៀងហត្ថលេខា (apksigner verify) មុន Release', /apksigner"? verify/i.test(releaseWf) && releaseWf.indexOf('apksigner') < releaseWf.indexOf('gh release create'));
ok('កំណែ Release ដេរីវេពី src/core/version.ts', releaseWf.includes('ZoeW/src/core/version.ts'));
const gsjAt = releaseWf.indexOf('ZoeW/android/app/google-services.json');
const webBuildAt = releaseWf.indexOf('npm run android:sync');
ok('FCM ៖ workflow សរសេរ google-services.json **មុន** build web (បើក __FCM_CONFIGURED__) ហើយផ្ទៀង package',
    gsjAt > 0 && webBuildAt > gsjAt && releaseWf.includes('ZOEW_GOOGLE_SERVICES_JSON') && releaseWf.includes("package_name==='com.zoesystem.zoew'"));
ok('FCM ៖ vite ដេរីវេ __FCM_CONFIGURED__ ពីវត្តមាន android/app/google-services.json',
    /__FCM_CONFIGURED__:\s*JSON\.stringify\(existsSync\(path\.join\(ROOT, 'android\/app\/google-services\.json'\)\)\)/.test(read('vite.config.mts')));
const certPin = read('android/release-cert.sha256').trim();
ok('វិញ្ញាបនបត្រ keystore pin ក្នុង android/release-cert.sha256 (SHA-256 · 64 hex)', /^[0-9a-f]{64}$/.test(certPin), certPin.slice(0, 12) + '…');
const pinAt = releaseWf.indexOf('if ! GOT=$(node ZoeW/scripts/apk-cert-check.mjs apk-certs.txt ZoeW/android/release-cert.sha256');
const pinGate = releaseWf.slice(pinAt, releaseWf.indexOf('gh release create'));
ok('workflow ប្រៀបវិញ្ញាបនបត្រ APK នឹង pin តាម apk-cert-check.mjs ហើយធ្លាក់មុន Release',
    pinAt > 0 && releaseWf.indexOf('apksigner') < pinAt && /^if ! GOT=\$\(node ZoeW\/scripts\/apk-cert-check\.mjs[^\n]*then\s*\n[^\n]*\n\s*exit 1/.test(pinGate) &&
    !/grep[^\n]*SHA-256 digest/.test(releaseWf));
/* ⛔ ការស្រង់វិញ្ញាបនបត្រត្រូវរត់លើ output **ពិត** របស់ apksigner ទាំង ២ ទម្រង់ — ទម្រង់ `V2 Signer:` ជាអ្វីដែល runner
 *    GitHub សរសេរ (ការធ្លាក់ Release លើ main 2026-10-01) · `Signer #1` ជាទម្រង់ v1+v2+v3 · ករណីបដិសេធត្រូវបដិសេធ */
const { apkCertVerdict } = await import('./apk-cert-check.mjs');
const certOut = (lines) => ['Verifies', 'Verified using v1 scheme (JAR signing): false', 'Verified using v2 scheme (APK Signature Scheme v2): true', ...lines].join('\n');
const otherDigest = certPin.split('').reverse().join('');
const certCases = [
    ['ទម្រង់ `V2 Signer:` (runner GitHub)', certOut(['Number of signers: 1', 'V2 Signer: certificate DN: CN=ZoeW, O=Zoe System, C=KH', 'V2 Signer: certificate SHA-256 digest: ' + certPin, 'V2 Signer: public key SHA-256 digest: ' + otherDigest]), true],
    ['ទម្រង់ `Signer #1` (v1+v2+v3)', certOut(['Number of signers: 1', 'Signer #1 certificate DN: CN=ZoeW', 'Signer #1 certificate SHA-256 digest: ' + certPin, 'Signer #1 public key SHA-256 digest: ' + otherDigest]), true],
    ['scheme ២ វិញ្ញាបនបត្រដដែល', certOut(['Number of signers: 1', 'V2 Signer: certificate SHA-256 digest: ' + certPin, 'V3 Signer: certificate SHA-256 digest: ' + certPin]), true],
    ['digest ផ្សេង ➜ បដិសេធ', certOut(['Number of signers: 1', 'V2 Signer: certificate SHA-256 digest: ' + otherDigest]), false],
    ['signer ២ ➜ បដិសេធ', certOut(['Number of signers: 2', 'Signer #1 certificate SHA-256 digest: ' + certPin, 'Signer #2 certificate SHA-256 digest: ' + otherDigest]), false],
    ['scheme ខុសគ្នា ➜ បដិសេធ', certOut(['Number of signers: 1', 'V2 Signer: certificate SHA-256 digest: ' + certPin, 'V3 Signer: certificate SHA-256 digest: ' + otherDigest]), false],
    ['public key ស្មើ pin តែវិញ្ញាបនបត្រផ្សេង ➜ បដិសេធ', certOut(['Number of signers: 1', 'V2 Signer: certificate SHA-256 digest: ' + otherDigest, 'V2 Signer: public key SHA-256 digest: ' + certPin]), false],
    ['គ្មាន «Verifies» ➜ បដិសេធ', certOut(['Number of signers: 1', 'V2 Signer: certificate SHA-256 digest: ' + certPin]).replace('Verifies\n', 'DOES NOT VERIFY\n'), false],
    ['គ្មាន digest ➜ បដិសេធ', certOut(['Number of signers: 1']), false]
];
const certBad = certCases.filter(([, text, want]) => apkCertVerdict(text, certPin).ok !== want).map(([n]) => n);
ok('apk-cert-check ៖ ទទួល output ពិត ២ ទម្រង់ · បដិសេធ ' + certCases.filter((c) => !c[2]).length + ' ករណី', certBad.length === 0, certBad.join(' · '));
ok('keystore ត្រូវលុបចេញពី runner ជានិច្ច (if: always())', /if: always\(\)\s*\n\s*run: rm -f "\$RUNNER_TEMP\/zoew-release\.jks"/.test(releaseWf));
const keystoreFiles = [];
(function walkKs(dir) {
    let entries;
    try { entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
        if (['node_modules', 'build', '.gradle', 'dist', 'dist-audit', '.original'].includes(e.name)) continue;
        const rel = dir ? dir + '/' + e.name : e.name;
        if (e.isDirectory()) walkKs(rel);
        else if (/\.(jks|keystore)$/i.test(e.name)) keystoreFiles.push(rel);
    }
})('');
ok('គ្មាន keystore ក្នុង tree របស់ ZoeW', !keystoreFiles.length, keystoreFiles.join(' · '));
ok('android/.gitignore ហាម *.jks · *.keystore', /^\*\.jks$/m.test(read('android/.gitignore')) && /^\*\.keystore$/m.test(read('android/.gitignore')));

for (const line of oks) console.log('   ok   ' + line);
for (const line of fails) console.log('   FAIL ' + line);
console.log(`\n${fails.length ? '❌' : '✅'} android:check — ${oks.length} ok, ${fails.length} FAIL`);
process.exitCode = fails.length ? 1 : 0;
