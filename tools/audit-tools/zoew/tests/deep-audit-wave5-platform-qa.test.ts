import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../../..');

describe('Deep Audit Wave 5: SW, ZoeKeyGen, CDP, Android & QA Checkers', () => {
    it('W5-1: First-install tab flips hadController=true on first controllerchange and notifies on subsequent deploy', () => {
        for (const rel of ['ZoeW/src/app/lifecycle/boot.ts', 'ZoeKeyGen/app.js']) {
            const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            expect(src).toMatch(/let hadController = !!navigator\.serviceWorker\.controller;/);
            expect(src).toMatch(/if \(hadController\) showUpdateAvailableBanner\(\);\s*else hadController = true;/);
        }

        const listeners: Record<string, Array<() => void>> = {};
        const navSw = {
            controller: null as any,
            addEventListener(type: string, fn: () => void) {
                (listeners[type] ||= []).push(fn);
            }
        };
        let updates = 0;
        let hadController = !!navSw.controller;
        navSw.addEventListener('controllerchange', () => {
            if (!hadController) {
                hadController = true;
                return;
            }
            updates++;
        });
        navSw.controller = { scriptURL: '/sw.js' };
        listeners.controllerchange.forEach((fn) => fn());
        expect(updates).toBe(0);
        listeners.controllerchange.forEach((fn) => fn());
        expect(updates).toBe(1);
    });

    it('W5-2: ZoeW sw.ts & ZoeKeyGen sw.js delete partial cache on install failure and skip trailing-slash keys in revalidateShell', async () => {
        const zoewSw = fs.readFileSync(path.join(ROOT, 'ZoeW/src/sw/sw.ts'), 'utf8');
        expect(zoewSw).toContain('.catch((err) => (typeof caches.delete === \'function\' ? caches.delete(CACHE_VERSION).catch(() => {}) : Promise.resolve()).then(() => Promise.reject(err)))');
        expect(zoewSw).toContain('if (/\\.(?:html|js|css|wasm)$/i.test(key) || /\\/$/.test(key)) return Promise.resolve();');

        const keygenSwPath = path.join(ROOT, 'ZoeKeyGen/sw.js');
        const keygenSw = fs.readFileSync(keygenSwPath, 'utf8');
        const events: Record<string, (ev: any) => void> = {};
        const deleted: string[] = [];
        const fetchUrls: string[] = [];
        const fakeCache = {
            addAll: async () => { throw new Error('network-fail'); },
            put: async () => {},
            match: async () => null
        };
        const ctx: any = vm.createContext({
            URL,
            Request: class FakeRequest {
                url: string;
                constructor(u: string) { this.url = u; }
            },
            Response: class FakeResponse {
                ok = true;
                redirected = false;
                headers = { get: () => 'application/javascript' };
                clone() { return this; }
            },
            navigator: { onLine: true },
            caches: {
                open: async () => fakeCache,
                delete: async (k: string) => { deleted.push(k); return true; },
                keys: async () => [],
                match: async () => null
            },
            fetch: async (u: any) => {
                fetchUrls.push(String(u));
                return new ctx.Response();
            },
            setTimeout,
            clearTimeout,
            Date,
            Promise,
            Set,
            self: {
                location: { href: 'https://keygen.test.invalid/sw.js', origin: 'https://keygen.test.invalid' },
                addEventListener(type: string, fn: (ev: any) => void) { events[type] = fn; },
                skipWaiting: async () => {},
                clients: { claim: async () => {} }
            }
        });
        ctx.globalThis = ctx;
        vm.runInContext(keygenSw + '\nthis.__test = { CACHE_VERSION, revalidateShell };', ctx);

        let installPromise: Promise<any> | null = null;
        events.install({ waitUntil(p: Promise<any>) { installPromise = p; } });
        await expect(installPromise).rejects.toThrow('network-fail');
        expect(deleted).toContain(ctx.__test.CACHE_VERSION);

        await ctx.__test.revalidateShell(fakeCache, { url: 'https://keygen.test.invalid/' }, './');
        await ctx.__test.revalidateShell(fakeCache, { url: 'https://keygen.test.invalid/' }, '/');
        expect(fetchUrls).toEqual([]);
    });

    it('W5-3: ZoeKeyGen index.html loads license-seat-config.js before client/verify and app.js uses Asia/Phnom_Penh timezone', () => {
        const html = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen/index.html'), 'utf8');
        const idxConfig = html.indexOf('./license-seat-config.js');
        const idxClient = html.indexOf('./license-seat-client.js');
        const idxVerify = html.indexOf('./license-verify.js');
        expect(idxConfig).toBeGreaterThan(0);
        expect(idxClient).toBeGreaterThan(idxConfig);
        expect(idxVerify).toBeGreaterThan(idxClient);

        const appJs = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen/app.js'), 'utf8');
        expect(appJs).toContain("timeZone: 'Asia/Phnom_Penh'");
    });

    it('W5-4: android-cdp-capture.js merges ExtraInfo headers case-insensitively without duplicate case-variant keys', () => {
        const src = fs.readFileSync(path.join(ROOT, 'tools/zto-cookie-sync-windows/android-cdp-capture.js'), 'utf8');
        const fnMatch = src.match(/const mergeHeaders = \(base, extra\) => \{[\s\S]*?\n {8}\};/);
        expect(fnMatch).toBeTruthy();
        const mergeHeaders = new Function(`${fnMatch![0]}; return mergeHeaders;`)();
        const mergedReq = mergeHeaders(
            { Cookie: 'OLD=1', 'User-Agent': 'Chrome' },
            { cookie: 'SESSION=fresh; JSESSIONID=xyz' }
        );
        expect(Object.keys(mergedReq).filter((k) => k.toLowerCase() === 'cookie')).toHaveLength(1);
        expect(mergedReq.cookie).toBe('SESSION=fresh; JSESSIONID=xyz');
        expect(mergedReq['User-Agent']).toBe('Chrome');

        const mergedRes = mergeHeaders(
            { 'Content-Type': 'text/plain', 'Set-Cookie': 'a=1' },
            { 'content-type': 'application/json; charset=utf-8', 'set-cookie': 'a=2' }
        );
        expect(Object.keys(mergedRes).filter((k) => k.toLowerCase() === 'content-type')).toHaveLength(1);
        expect(mergedRes['content-type']).toBe('application/json; charset=utf-8');
        expect(Object.keys(mergedRes).filter((k) => k.toLowerCase() === 'set-cookie')).toHaveLength(1);
        expect(mergedRes['set-cookie']).toBe('a=2');
    });

    it('W5-5: ApkUpdatePlugin & ScanBeepPlugin harden redirect validation, busy/apkMatches install guard, empty audio route, and zero comments', () => {
        const apkSrc = fs.readFileSync(path.join(ROOT, 'ZoeW/android/app/src/main/java/com/zoesystem/zoew/ApkUpdatePlugin.java'), 'utf8');
        const beepSrc = fs.readFileSync(path.join(ROOT, 'ZoeW/android/app/src/main/java/com/zoesystem/zoew/ScanBeepPlugin.java'), 'utf8');
        expect(apkSrc).toMatch(/try\s*\{\s*probes\.execute\(/);
        expect(apkSrc).toMatch(/for\s*\(int hop = 0; hop < 5; hop\+\+\)[\s\S]*?setInstanceFollowRedirects\(false\)[\s\S]*?if \(!assetLocation\(location\)\)/);
        expect(apkSrc).toMatch(/if \(!apkMatches\(target, version\)\)\s*\{\s*target\.delete\(\);/);
        expect(apkSrc).toMatch(/public void install\(PluginCall call\)[\s\S]*?if \(busy\.get\(\)\)[\s\S]*?if \(!apkMatches\(apk, version\)\)/);
        expect(beepSrc).toMatch(/if \(devices == null \|\| devices\.length == 0\) return false;/);

        for (const [name, src] of [['ApkUpdatePlugin.java', apkSrc], ['ScanBeepPlugin.java', beepSrc]]) {
            const stripped = src.replace(/"(?:[^"\\]|\\.)*"/g, '""');
            expect(stripped, name + ' must have zero comments').not.toMatch(/\/\/|\/\*/);
        }
    });

    it('W5-6: QA checkers eliminate false-green loopholes (offline-shell, sw-shell-latency, exit-code-integrity process.exitCode)', () => {
        const offlineSrc = fs.readFileSync(path.join(ROOT, 'tools/audit-tools/offline-shell-test.js'), 'utf8');
        expect(offlineSrc).not.toContain('|| true');
        expect(offlineSrc).toContain('engine.built && !engine.err && !bootError');

        const latencySrc = fs.readFileSync(path.join(ROOT, 'tools/audit-tools/sw-shell-latency-test.js'), 'utf8');
        expect(latencySrc).toContain('offline.hasShell && offline.appJs && !bootError');

        const eciSrc = fs.readFileSync(path.join(ROOT, 'tools/audit-tools/exit-code-integrity.js'), 'utf8');
        expect(eciSrc).toContain('process\\.exitCode\\s*=\\s*([^;\\n]+)');
        const fnStart = eciSrc.indexOf('const POISON = [');
        const fnEnd = eciSrc.indexOf('\n// ⛔ ថវិកាកូនពុល', fnStart);
        expect(fnStart).toBeGreaterThan(0);
        expect(fnEnd).toBeGreaterThan(fnStart);
        const poisonFn = new Function('acorn', `${eciSrc.slice(fnStart, fnEnd)}; return poisonSource;`)(null);
        const sample = `
let failed = 0;
function check() { failed += 0; }
check();
process.exitCode = failed ? 1 : 0;
`;
        const poisoned = poisonFn(sample);
        expect(poisoned).toBeTruthy();
        expect(poisoned).toContain('ZOE_EXITCODE_POISON_REACHED');
        const proc: any = { exitCode: 0, stderr: { write: () => {} }, once: () => {} };
        new Function('process', poisoned)(proc);
        expect(proc.exitCode).toBe(1);
    });
});
