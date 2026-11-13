import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { afterEach, expect, it, vi } from 'vitest';
import { PageEntry } from '../../../../ZoeW/src/app/components/PageEntry';
import { firebaseState, dataState, uiState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { acceptServerClockOffset, resetServerClock, serverClockIsTrustworthy } from '../../../../ZoeW/src/core/clock';
import { sessionUserActionAllowed } from '../../../../ZoeW/src/core/session-verification';
import { renderEntryList } from '../../../../ZoeW/src/ui/entry-list';
import { getFormattedDate } from '../../../../ZoeW/src/core/timezone';
import { mount, step, unmount } from './native/react-harness';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const require = createRequire(import.meta.url);
const acorn = require('acorn');
const { CLOCK_FIXTURE } = require('../../browser-clock-fixture.cjs');
const EPOCH = Date.UTC(2026, 8, 22, 6);
const nativeDate = Date;

// រត់នាឡិកាដែល Playwright ដំឡើងពិត ដោយមិនបើក browser។
function playwrightClock(method: string) {
    const bundle = fs.readFileSync(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'lib/coreBundle.js'), 'utf8');
    const marker = '    source = ';
    const at = bundle.indexOf(marker, bundle.indexOf('var init_clockSource'));
    expect(at).toBeGreaterThan(0);
    const injected = acorn.parseExpressionAt(bundle, at + marker.length, { ecmaVersion: 'latest' }).value;
    expect(injected).toContain('packages/injected/src/clock.ts');
    const module = { exports: {} as any };
    vm.runInNewContext(injected, { module });
    const createClock = module.exports.createClock();
    const { clock, api } = createClock({ Date: nativeDate, performance, setTimeout, clearTimeout, setInterval, clearInterval });
    clock[method](EPOCH);
    vi.stubGlobal('Date', api.Date);
    vi.stubGlobal('performance', api.performance);
    return (ms: number) => clock.runFor(ms);
}

function panelClock(freeze = false) {
    let ticks = 0;
    vi.stubGlobal('performance', { now: () => ticks });
    const source = fs.readFileSync(path.join(ROOT, 'tools/audit-tools/panel-motion-test.js'), 'utf8');
    const ast = acorn.parse(source, { ecmaVersion: 'latest' });
    const declaration = ast.body.find((n: any) => n.type === 'FunctionDeclaration' && n.id.name === 'pinPanelFixtureClock');
    expect(declaration).toBeDefined();
    let fixture = source.slice(declaration.start, declaration.end);
    if (freeze) fixture = fixture.replace(/const wallNow = \(\) => [^;]+;/, 'const wallNow = () => now;');
    new Function(fixture + ';pinPanelFixtureClock(' + EPOCH + ');')();
    return async (ms: number) => { ticks += ms; };
}

async function prepare() {
    resetServerClock();
    firebaseState.db = {} as any;
    firebaseState.auth = null;
    (window as any).ZoeLicense = {};
    new Function(CLOCK_FIXTURE)();
    await (window as any).ZoeLicense.syncServerTime();
    const sample = (window as any).ZoeLicense.getServerTimeSample();
    expect(acceptServerClockOffset(0, sample, false)).toBe(true);
    firebaseState.auth = { currentUser: { uid: 'entry-search-clock' } } as any;
    firebaseState.sessionExpiryCheck = 'live';
    uiState.currentAppPage = 'entry';
    uiState.entryPanelCollapsed = false;
    uiState.entrySearchActive = false;
    uiState.entryScanMode = 'parcel';
    viewState.entryModeShown = 'parcel';
    dataState.scanHistory = [{ id: 'today-row', scanDate: getFormattedDate(new Date(EPOCH)), createdAt: EPOCH,
        phone: '012345678', cod: 1, dod: 0, barcodes: [{ code: 'ROW1', cod: 1, dod: 0 }] }] as any;
    mount(<PageEntry />);
    step(() => renderEntryList());
    expect(document.getElementById('entryListEmptyState')!.classList.contains('hidden')).toBe(true);
    expect(document.querySelectorAll('#entryListTableBody tr').length).toBe(1);
    expect(sessionUserActionAllowed('renderEntryList')).toBe(true);
}

function searchEmpty() {
    step(() => {
        const input = document.getElementById('entryListSearchInput') as HTMLInputElement;
        input.value = 'zz-no-such-row';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return !document.getElementById('entryListEmptyState')!.classList.contains('hidden');
}

afterEach(() => {
    unmount();
    resetServerClock();
    firebaseState.auth = null;
    firebaseState.sessionExpiryCheck = 'unverified';
    delete (window as any).ZoeLicense;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it('panel fixture៖ Date និង monotonic ឆ្លង២វិនាទីរួមគ្នា ហើយ input ពិតបង្ហាញសារទទេ', async () => {
    const advance = panelClock();
    await prepare();
    await advance(3001);
    expect(searchEmpty()).toBe(true);
    expect(serverClockIsTrustworthy()).toBe(true);
});

it('native history fixture៖ នាឡិកា Playwright ពិតរក្សាផ្លូវ input ក្រោយ៣វិនាទី', async () => {
    const source = fs.readFileSync(path.join(ROOT, 'tools/audit-tools/zoew/scripts/history-window-check.mjs'), 'utf8');
    const methods = [...source.matchAll(/await page\.clock\.(\w+)\(HARNESS_CLOCK_START\)/g)].map(m => m[1]);
    expect(methods).toHaveLength(1);
    const advance = playwrightClock(methods[0]);
    await prepare();
    await advance(3001);
    expect(searchEmpty()).toBe(true);
    expect(serverClockIsTrustworthy()).toBe(true);
});

it.each(['panel', 'playwright'])('ទិសផ្ទុយ៖ %s បង្កកតែ Date ត្រូវបដិសេធ input មិនមែនបន្ធូរ guard', async kind => {
    const advance = kind === 'panel' ? panelClock(true) : playwrightClock('setFixedTime');
    await prepare();
    await advance(3001);
    expect(searchEmpty()).toBe(false);
    expect(serverClockIsTrustworthy()).toBe(false);
});

it('ទិសផ្ទុយ៖ clock មានសុពលភាពតែ session មិនទាន់ផ្ទៀង ក៏មិនអាចជុំវិញ action guard', async () => {
    playwrightClock('setSystemTime');
    await prepare();
    firebaseState.sessionExpiryCheck = 'unverified';
    expect(searchEmpty()).toBe(false);
    expect(serverClockIsTrustworthy()).toBe(true);
});

it('panel seed និង clock ប្រើថ្ងៃថេរដែលនៅឆ្ងាយពីអធ្រាត្រ ទោះ runner ចាប់ផ្ដើមមុន/ក្រោយអធ្រាត្រ', () => {
    const source = fs.readFileSync(path.join(ROOT, 'tools/audit-tools/panel-motion-test.js'), 'utf8');
    const ast = acorn.parse(source, { ecmaVersion: 'latest' });
    const declaration = ast.body.find((node: any) => node.declarations?.some((d: any) => d.id.name === 'FIXTURE_NOW'));
    expect(declaration).toBeDefined();
    for (const wall of [Date.UTC(2026, 10, 9, 16, 59, 59), Date.UTC(2026, 10, 9, 17, 0, 1)]) {
        class RunnerDate extends nativeDate { static now() { return wall; } }
        const anchor = vm.runInNewContext(source.slice(declaration.start, declaration.end) + '\nFIXTURE_NOW', { Date: RunnerDate });
        const day = getFormattedDate(new nativeDate(anchor));
        expect(getFormattedDate(new nativeDate(anchor - 80 * 1000))).toBe(day);
        expect(getFormattedDate(new nativeDate(anchor + 30 * 60 * 1000))).toBe(day);
    }
});
