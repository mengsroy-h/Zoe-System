import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { build as esbuildBuild } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/** chunk តែមួយដែលផ្ទុក plugin native ទាំងអស់ (មើល `manualChunks`) */
const NATIVE_CHUNK = 'native-plugins';
const NATIVE_CHUNK_RE = new RegExp('^\\./assets/' + NATIVE_CHUNK + '-[^/]+\\.js$');

function readAppVersion(): string {
    const src = readFileSync(path.join(ROOT, 'src/core/version.ts'), 'utf8');
    const m = src.match(/APP_VERSION\s*=\s*'([^']+)'/);
    if (!m) throw new Error('APP_VERSION not found in src/core/version.ts');
    return m[1];
}

function readCacheVersion(): string {
    const src = readFileSync(path.join(ROOT, 'src/sw/cache-version.ts'), 'utf8');
    const m = src.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
    if (!m) throw new Error('CACHE_VERSION not found in src/core/version.ts');
    return m[1];
}

function walk(dir: string, base = dir): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) out.push(...walk(full, base));
        else out.push('./' + path.relative(base, full).split(path.sep).join('/'));
    }
    return out;
}

/**
 * ⛔ CORE_SHELL ក្នុង App ចាស់ត្រូវសរសេរដោយដៃ ➜ ឯកសារថ្មីដែលភ្លេចដាក់
 * ធ្វើឲ្យការស្កេនស្លាប់ស្ងាត់ៗពេលក្រៅបណ្តាញ។ ទីនេះវា **ដេរីវេពី build ពិត**។
 */
function serviceWorkerPlugin(): Plugin {
    let outDir = 'dist';
    return {
        name: 'zoew-service-worker',
        apply: 'build',
        configResolved(cfg) {
            outDir = cfg.build.outDir;
        },
        async closeBundle() {
            const dist = path.resolve(ROOT, outDir);
            if (!existsSync(dist)) return;
            // ⛔ `.map` មិនចូល cache ៖ វាធំ (រាប់ MB) ហើយអ្នកប្រើមិនដែលទាញវា
            //    — មានតែ devtools ទេដែលសុំ ➜ ការដាក់វាក្នុងសំបក ស៊ីកូតា។
            // ⛔ chunk របស់ plugin native (Capacitor) មិនចូល cache ៖ web មិនដែល
            //    ផ្ទុកវា (`import()` តែលើ native) ហើយលើ native ឯកសារទាំងអស់
            //    ស្ថិតក្នុង APK រួចហើយ ➜ Service Worker មិនត្រូវចុះឈ្មោះសោះ។
            const emitted = walk(dist).filter((p) => p !== './sw.js' && !p.endsWith('.map') && !NATIVE_CHUNK_RE.test(p));

            // សំបកស្នូល ៖ អ្វីដែល App **មិនអាចដើរដោយគ្មាន** (atomic addAll)
            const core = emitted.filter((p) =>
                p === './index.html' ||
                p === './guide.html' ||
                p === './boot-flags.js' ||
                p === './firebase-loader.js' ||
                p === './license-verify.js' ||
                p === './error-reporting.js' ||
                p === './vendor/zxing-wasm.js' ||
                p === './vendor/zxing_reader.wasm' ||
                /^\.\/assets\/.*\.(js|css)$/.test(p)
            );
            const optional = emitted.filter((p) => !core.includes(p));

            const result = await esbuildBuild({
                entryPoints: [path.join(ROOT, 'src/sw/sw.ts')],
                bundle: true,
                format: 'iife',
                target: 'es2020',
                minify: true,
                write: false,
                define: {
                    __CACHE_VERSION__: JSON.stringify(readCacheVersion()),
                    __CORE_SHELL__: JSON.stringify(['./', ...core]),
                    __OPTIONAL_SHELL__: JSON.stringify(optional)
                }
            });
            mkdirSync(dist, { recursive: true });
            writeFileSync(path.join(dist, 'sw.js'), result.outputFiles[0].text);

            // manifest.json ៖ កំណែដេរីវេពី APP_VERSION ពិត (កុំចាក់ literal ២ កន్లែង)
            const manifestPath = path.join(dist, 'manifest.json');
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
            manifest.version = readAppVersion();
            writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
        }
    };
}

/**
 * ⛔ build វាស់តែប៉ុណ្ណោះ (`VITE_EXPOSE_GLOBALS=1`) — **មិនដែលចូលផលិតកម្ម**។
 * App ដើមជា script សកល ➜ checker ជំនួស `window.fetchWithTimeout = stub` ហើយការហៅ **ខាងក្នុង** ក៏ឆ្លង stub នោះដែរ។
 * ក្នុង ESM ការហៅខាងក្នុងឆ្លង binding របស់ module មិនមែន `window` ➜ stub គ្មានឥទ្ធិពល ➜ checker វាស់ «០ ការហៅ»។
 * ➜ module នីមួយៗទទួល `__auditRebind(name, value)` ដែលសរសេរ binding នៃ `export function` ឡើងវិញ (ESM live binding ៖
 *    អ្នក import ទាំងអស់ និងការហៅក្នុង module ឃើញតម្លៃថ្មី) ហើយ `expose-globals.ts` ភ្ជាប់វាទៅ setter នៃ `window.<name>`។
 */
const AUDIT_REBIND_RE = /[\\/]src[\\/](core|domain|features|services|ui|app[\\/]behaviors)[\\/].*\.ts$|[\\/]src[\\/]app[\\/](lifecycle[\\/]layers|refs|flush)\.ts$/;

function auditRebindPlugin(): Plugin {
    return {
        name: 'zoew-audit-rebind',
        enforce: 'pre',
        transform(code, id) {
            if (!AUDIT_REBIND_RE.test(id.split('?')[0])) return null;
            const names = [...code.matchAll(/^export (?:async )?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
            if (!names.length) return null;
            const cases = names.map((n) => `        case ${JSON.stringify(n)}: ${n} = value; return true;`).join('\n');
            return {
                code: code + `\nexport function __auditRebind(name: string, value: any): boolean {\n    switch (name) {\n${cases}\n    }\n    return false;\n}\n`,
                map: null
            };
        }
    };
}

const AUDIT_BUILD = process.env.VITE_EXPOSE_GLOBALS === '1';

export default defineConfig({
    base: './',
    plugins: [react(), serviceWorkerPlugin(), ...(AUDIT_BUILD ? [auditRebindPlugin()] : [])],
    resolve: {
        alias: { '@': path.resolve(ROOT, 'src') }
    },
    define: {
        __APP_VERSION__: JSON.stringify(readAppVersion()),
        __CACHE_VERSION__: JSON.stringify(readCacheVersion())
    },
    build: {
        target: 'es2020',
        outDir: 'dist',
        emptyOutDir: true,
        assetsInlineLimit: 0,
        cssCodeSplit: false,
        sourcemap: false,
        // ⛔ CSP គ្មាន 'unsafe-inline' ➜ polyfill ដែល Vite ចាក់ជា inline script
        //    ត្រូវបិទ បើមិនដូច្នេះ browser បដិសេធវាស្ងាត់ៗលើផលិតកម្ម។
        modulePreload: { polyfill: false },
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
                    // ⛔ plugin native ផ្ទុកតាម `import()` តែលើ Android ➜ ប្រមូលវា
                    //    ចូល chunk តែមួយដែល Service Worker រំលង (web មិនធំឡើង)។
                    //    ⛔ helper `__vitePreload` របស់ Vite ត្រូវមាន chunk ផ្ទាល់ខ្លួន ៖
                    //    បើអត់ Rollup ដាក់វាចូល chunk native ➜ `index` import វាដោយ
                    //    **static** ➜ web ផ្ទុក chunk native គ្រប់ពេល ហើយក្រៅបណ្តាញ App
                    //    ចាប់ផ្តើមមិនកើត (chunk នោះមិននៅក្នុង cache)។
                    if (id.includes('vite/preload-helper')) return 'preload-helper';
                    if (/node_modules[\\/]@(capacitor|capgo)[\\/]/.test(id) || id.includes('/src/platform/native-biometric')) return NATIVE_CHUNK;
                    return undefined;
                }
            }
        }
    },
    server: { port: 5173, host: true }
});