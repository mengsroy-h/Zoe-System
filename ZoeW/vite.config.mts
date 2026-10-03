import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { build as esbuildBuild } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const NATIVE_CHUNK = 'native-plugins';
const NATIVE_CHUNK_RE = new RegExp('^\\./assets/' + NATIVE_CHUNK + '-[^/]+\\.js$');
const BACKEND_CHUNK_RE = /^\.\/assets\/supabase-backend-[^/]+\.js$/;

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

const NETWORK_ONLY = new Set(['./announcements.json']);

function serviceWorkerPlugin(): Plugin {
    let outDir = 'dist';
    const staticallyImported = new Set<string>();
    return {
        name: 'zoew-service-worker',
        apply: 'build',
        configResolved(cfg) {
            outDir = cfg.build.outDir;
        },
        generateBundle(_options, bundle) {
            staticallyImported.clear();
            for (const item of Object.values(bundle)) {
                if (item.type === 'chunk') for (const name of item.imports) staticallyImported.add('./' + name);
            }
        },
        async closeBundle() {
            const dist = path.resolve(ROOT, outDir);
            if (!existsSync(dist)) return;
            const emitted = walk(dist).filter((p) => p !== './sw.js' && !NETWORK_ONLY.has(p) && !p.endsWith('.map') && !NATIVE_CHUNK_RE.test(p));

            const backend = emitted.filter((p) => BACKEND_CHUNK_RE.test(p) && !staticallyImported.has(p));
            const core = emitted.filter((p) => !backend.includes(p)).filter((p) =>
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
            const optional = emitted.filter((p) => !core.includes(p) && !backend.includes(p));

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
                    __OPTIONAL_SHELL__: JSON.stringify(optional),
                    __BACKEND_SHELL__: JSON.stringify(backend)
                }
            });
            mkdirSync(dist, { recursive: true });
            writeFileSync(path.join(dist, 'sw.js'), result.outputFiles[0].text);

            const manifestPath = path.join(dist, 'manifest.json');
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
            manifest.version = readAppVersion();
            writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
        }
    };
}

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
        __CACHE_VERSION__: JSON.stringify(readCacheVersion()),
        __FCM_CONFIGURED__: JSON.stringify(existsSync(path.join(ROOT, 'android/app/google-services.json')))
    },
    build: {
        target: 'es2020',
        outDir: 'dist',
        emptyOutDir: true,
        assetsInlineLimit: 0,
        cssCodeSplit: false,
        cssMinify: 'esbuild',
        sourcemap: false,
        modulePreload: { polyfill: false },
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        { name: 'preload-helper', test: /vite[\\/]preload-helper/, priority: 3 },
                        { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 2 },
                        { name: NATIVE_CHUNK, test: /node_modules[\\/]@(capacitor|capgo)[\\/]|[\\/]src[\\/]platform[\\/]native-biometric/, priority: 1 }
                    ]
                }
            }
        }
    },
    server: { port: 5173, host: true }
});