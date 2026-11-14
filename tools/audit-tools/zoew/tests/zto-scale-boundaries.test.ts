import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../../../../ZoeW/src/core/state';
import { fetchZtoSignedPages, fetchZtoListAllPages } from '../../../../ZoeW/src/features/zto-list-sync';
import { ztoSweepLaneOf } from '../../../../ZoeW/src/services/zto-sweep-lane';
import { acceptFixtureSession, configureFixtureBackend } from './helpers/accepted-session';

const require = createRequire(import.meta.url);
const acorn = require('acorn');
const source = readFileSync(path.resolve(__dirname, '../../../../ZoeW/netlify/functions/_shared/zto-order-detail-core.cjs'), 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest' });
const names = new Set(['readProjectEntries', 'PROJECT_ID_RE', 'PROJECT_ID_MAX', 'PROJECT_BRANCHES_MAX', 'LIST_SITE_CODE_RE']);
const code = ast.body.filter((n: any) => names.has(n.id?.name || n.declarations?.[0]?.id?.name)).map((n: any) => source.slice(n.start, n.end)).join('\n');
const entries = runInNewContext(code + '\nreadProjectEntries') as (env: any) => { ids: string[]; branches: Record<string, string[]> };

beforeEach(() => {
    configureFixtureBackend('zto-scale-boundaries');
    firebaseState.auth = { currentUser: { uid: 'test' } } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'test-token' }) } as any;
    acceptFixtureSession();
});
afterEach(() => { vi.unstubAllGlobals(); firebaseState.auth = null as any; firebaseState.fb = null as any; firebaseState.firebaseConfig = null as any; });

it('គម្រោងទី១៧ និងទី១០០០ នៅផ្ទៀងបាន · ពិដាននៅមាន', () => {
    const ids = Array.from({ length: 1000 }, (_, i) => 'shop-' + i);
    expect(entries({ FIREBASE_PROJECT_IDS: ids.join(',') }).ids).toEqual(ids);
    expect(entries({ FIREBASE_PROJECT_IDS: Array.from({ length: 2000 }, (_, i) => 'shop-' + i).join(',') }).ids.length).toBeLessThan(2000);
});

it('entry ខុសបិទតែ project នោះ · duplicate ខុសមិនត្រឡប់ទៅជឿ email', () => {
    const got = entries({ FIREBASE_PROJECT_IDS: 'shop-good:123,shop-bad,shop-bad:bad code,???,shop-good:456,shop-bad:789' });
    expect(got.ids).toEqual(['shop-good']);
    expect(got.branches).toEqual({ 'shop-good': ['123', '456'] });
});

it.each([4, 10, 20])('អាន Sign %i pages តាមពិដាន server', async (pages) => {
    const requests: number[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        const u = new URL(url, window.location.origin);
        const page = Number(u.searchParams.get('page'));
        requests.push(page);
        return new Response(JSON.stringify({ success: true, enabled: true, list: true, rows: [], signed: ['ZT' + page], signedOk: true, pages, maxPages: pages }));
    }));
    const got = await fetchZtoSignedPages({ url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }, '2026-11-01', '2026-11-01');
    expect(got?.codes.length).toBe(pages);
    expect(got?.truncated).toBe(false);
    expect(requests).toHaveLength(pages);
});

it('server កាត់នៅ page១០ ក្នុង២៥ ➜ នៅ truncated · arrival ប្រើពិដានដូចគ្នា', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, enabled: true, list: true, rows: [], signed: [], signedOk: true, signedPages: 25, pages: 25, maxPages: 10, returned: null, returnedOk: false }))));
    const cfg = { url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' };
    expect((await fetchZtoSignedPages(cfg, '2026-11-01', '2026-11-01'))?.truncated).toBe(true);
    expect((await fetchZtoListAllPages(cfg, '2026-11-01', '2026-11-01')).pageLimit).toBe(10);
});

it('Cookie សាខាច្រើនក្នុង project តែមួយប្រើ lane តែមួយ · Palm រក្សាតាមសាខា', () => {
    firebaseState.firebaseConfig = { databaseURL: 'https://shop.firebaseio.com', projectId: 'shop-project' } as any;
    firebaseState.auth = { currentUser: { uid: 'a', email: 'staff@zoew123.com' } } as any;
    const first = ztoSweepLaneOf({}, false);
    firebaseState.auth.currentUser.email = 'staff@zoew456.com';
    expect(ztoSweepLaneOf({}, false)).toBe(first);
    expect(first).toBe('cookie_shop-project');
    expect(ztoSweepLaneOf({ palmAccount: { siteCode: '123' } }, true)).not.toBe(ztoSweepLaneOf({ palmAccount: { siteCode: '456' } }, true));
});
