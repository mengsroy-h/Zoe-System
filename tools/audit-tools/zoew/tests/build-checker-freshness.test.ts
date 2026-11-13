import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lab = vi.hoisted(() => ({ files: new Map<string, string>(), served: [] as string[], runBrowser: false, info: {} as any }));
vi.mock('node:fs', async (original) => {
    const actual = await original<typeof import('node:fs')>();
    const readFileSync = (file: any) => {
        const key = String(file).replace(/\\/g, '/');
        for (const [suffix, text] of lab.files) if (key.endsWith(suffix)) return text;
        throw new Error('ENOENT fixture ' + key);
    };
    return { ...actual, readFileSync, default: { ...actual, readFileSync } };
});
vi.mock('../scripts/serve.mjs', () => ({ serveDir: (dir: string) => {
    lab.served.push(dir.replace(/\\/g, '/'));
    if (lab.runBrowser) return { server: { close() {} }, port: 42424 };
    throw new Error('BrowserStart');
} }));
vi.mock('playwright-core', () => ({ chromium: { launch: async () => ({ close: async () => {}, newPage: async () => ({
    route: async () => {}, goto: async () => {}, waitForTimeout: async () => {}, waitForFunction: async () => {},
    evaluate: async () => lab.info
}) }) } }));

const run = (script: string) => script === 'smoke' ? import('../scripts/smoke.mjs') : import('../scripts/sw-check.mjs');
beforeEach(() => {
    vi.resetModules();
    lab.served.length = 0;
    lab.runBrowser = false;
    lab.files = new Map([
        ['/src/core/version.ts', "export const APP_VERSION = '2.50.162';"],
        ['/src/sw/cache-version.ts', "export const CACHE_VERSION = 'zoew-v426';"],
        ['/dist/manifest.json', '{"version":"2.50.162"}'],
        ['/dist/sw.js', 'const cache="zoew-v426";']
    ]);
    vi.stubEnv('DIST_DIR', '');
});
afterEach(() => { vi.unstubAllEnvs(); });

describe.each(['smoke', 'sw-check'])('%s checks current artifacts before starting the browser', (script) => {
    it.each(['manifest', 'worker', 'mixed-worker', 'missing-worker', 'invalid-manifest'])('rejects %s mismatch with a build instruction', async (kind) => {
        if (kind === 'manifest') lab.files.set('/dist/manifest.json', '{"version":"2.50.151"}');
        if (kind === 'worker') lab.files.set('/dist/sw.js', 'const cache="zoew-v415";');
        if (kind === 'mixed-worker') lab.files.set('/dist/sw.js', 'const old="zoew-v415",current="zoew-v426";');
        if (kind === 'missing-worker') lab.files.delete('/dist/sw.js');
        if (kind === 'invalid-manifest') lab.files.set('/dist/manifest.json', '{}');
        await expect(run(script)).rejects.toThrow(/Stale build.*npm run build/);
        expect(lab.served).toEqual([]);
    });

    it('allows current source, manifest and worker to reach browser startup', async () => {
        await expect(run(script)).rejects.toThrow('BrowserStart');
        expect(lab.served).toHaveLength(1);
    });
});

it('sw-check validates and serves the requested custom audit directory', async () => {
    vi.stubEnv('DIST_DIR', 'C:/audit/current');
    lab.files.delete('/dist/manifest.json');
    lab.files.delete('/dist/sw.js');
    lab.files.set('/audit/current/manifest.json', '{"version":"2.50.162"}');
    lab.files.set('/audit/current/sw.js', 'const cache=`zoew-v426`;');
    await expect(run('sw-check')).rejects.toThrow('BrowserStart');
    expect(lab.served).toEqual(['C:/audit/current']);
});

it.each([['zoew-v415', 1], ['zoew-v426', 0]])('sw-check live cache %s with eight entries exits %i', async (cache, exitCode) => {
    lab.runBrowser = true;
    lab.info = { registered: true, active: true, cacheNames: [cache], cachedCount: 8, cached: [] };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code: number) => { throw new Error('Exit:' + code); }) as any);
    await expect(run('sw-check')).rejects.toThrow('Exit:' + exitCode);
});
