import { act as reactAct } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ prints: [] as any[], shares: [] as any[], canvases: 0 }));
vi.mock('../src/platform/file-output', async (original) => ({
    ...(await original<Record<string, unknown>>()),
    printCurrentView: () => { h.prints.push(JSON.parse(JSON.stringify(uiState.pdfExportView))); },
    shareImageFiles: async (files: any) => { h.shares.push(files); return 'saved'; }
}));
vi.mock('../src/features/label-image', () => ({
    drawLabelImage: () => { h.canvases++; return { toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' }; }
}));

import { dataState, firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { appLocalStore } from '../src/core/storage';
import { buildExportRows, restoreAfterPdfExport } from '../src/features/export';
import { saveEditedBarcodePrice } from '../src/features/barcode-ops';
import { openLabelPrintModal, printLabelsFromModal, resetLabelPrint, saveLabelImagesFromModal, updateLabelPrintPreview } from '../src/features/label-print';
import { moreMenuPrintItemLabels } from '../src/ui/more-menu';
import { modalIsOpen } from '../src/core/modals';
import { closeModal } from '../src/ui/modal';
import { PageData } from '../src/app/components/PageData';
import { GlobalMoreMenu } from '../src/app/components/GlobalMoreMenu';
import { ViewListModal } from '../src/app/components/modals/ViewListModal';
import { EditBarcodePriceModal } from '../src/app/components/modals/EditBarcodePriceModal';
import { LabelPrintModal } from '../src/app/components/modals/LabelPrintModal';
import { mount, step, unmount } from './native/react-harness';

const DAY = '2026-10-30', NOW = Date.UTC(2026, 9, 30, 9), HISTORY = 'zoew_scan_history_cod_dod';
const copy = (v: any) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const ordinary = () => ({ id: 'row', phone: '012000001', scanDate: DAY, time: 't', createdAt: NOW - 3600000, count: 1, cod: 5, dod: 0, price: 5, isClosed: false, barcodes: [{ code: 'OUTPUT1', cod: 5, dod: 0, createdAt: NOW - 3600000, isClosed: false, isDeducted: false, locker: 'A1' }] });
const marker = (phase: string, outcome?: string) => ({ token: 'price_' + 'a'.repeat(32), actorUid: 'output-user', code: 'OUTPUT1', slot: '0', birth: NOW - 3600000, rowBirth: NOW - 3600000, scanDate: DAY, priorCod: 5, priorDod: 0, wantCod: 17.25, wantDod: 0, phase, ...(outcome ? { outcome } : {}) });
let tree: any, holdHistory: boolean, rejectHistory: (reason: any) => void, entered: Promise<void>, enter: () => void;

function at(path: string) { return copy(path.split('/').filter(Boolean).reduce((node, key) => node?.[key], tree) ?? null); }
function put(path: string, value: any) {
    const keys = path.split('/').filter(Boolean);
    let node = tree;
    for (const key of keys.slice(0, -1)) node = node[key] ||= {};
    if (value == null) delete node[keys.at(-1)!];
    else node[keys.at(-1)!] = copy(value);
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    dbListenerFailedPaths.clear();
    dbListenerPendingPaths.clear();
    appLocalStore.clear();
    h.prints.length = 0; h.shares.length = 0; h.canvases = 0;
    uiState.currentFilterMode = 'all';
    uiState.pdfExportOriginalTitle = null;
    uiState.pdfExportView = null;
    uiState.historyView = null;
    uiState.currentAppPage = 'data';
    uiState.modalDisplay = {}; uiState.modalStack = []; uiState.isModalOpen = false; uiState.toasts = [];
    dataState.scanHistory = [ordinary()]; dataState.deletedItems = [];
    dataState.dailyRevenueData = { [DAY]: { codDollar: 5, dodDollar: 0, totalCount: 1 } };
    dataState.monthlyRevenueData = { '2026-10': { codDollar: 5, dodDollar: 0, totalCount: 1 } };
    dataState.dailyCollectedData = {};
    firebaseState.authGeneration++;
    firebaseState.isInitializingFirebase = false;
    firebaseState.isDatabaseConnected = true;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    const options = { supabaseUrl: 'https://synthetic-output.invalid' };
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(options));
    firebaseState.auth = { app: { options }, currentUser: { uid: 'output-user' } } as any;
    firebaseState.db = { app: { options } } as any;
    tree = { [HISTORY]: { row: ordinary() }, zoew_daily_revenue_cod_dod: copy(dataState.dailyRevenueData), zoew_monthly_revenue_cod_dod: copy(dataState.monthlyRevenueData) };
    holdHistory = false;
    entered = new Promise((resolve) => { enter = resolve; });
    firebaseState.fb = {
        __supabase: true, tenantScope: () => 'output-tenant', ref: (_db: any, path = '') => ({ path }),
        get: async (ref: any) => ({ val: () => at(ref.path) }),
        runTransaction: async (ref: any, update: any) => {
            const next = update(at(ref.path));
            if (next === undefined) return { committed: false, snapshot: { val: () => at(ref.path) } };
            if (holdHistory && ref.path === HISTORY + '/row' && next.pricePending?.phase === 'history') {
                enter();
                return new Promise((_resolve, reject) => { rejectHistory = reject; });
            }
            put(ref.path, next);
            return { committed: true, snapshot: { val: () => at(ref.path) } };
        },
        update: async (ref: any, values: any) => { for (const [key, value] of Object.entries(values)) put([ref.path, key].filter(Boolean).join('/'), value); }
    } as any;
    for (const [name, path] of Object.entries({ dbRefHistory: HISTORY, dbRefDailyRevenue: 'zoew_daily_revenue_cod_dod', dbRefMonthlyRevenue: 'zoew_monthly_revenue_cod_dod', dbRefDailyCollected: 'zoew_daily_collected_cod_dod' })) (firebaseState as any)[name] = { path };
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => {});
    mount(<><PageData /><GlobalMoreMenu /><ViewListModal /><EditBarcodePriceModal /><LabelPrintModal /></>);
});

afterEach(() => {
    step(() => { resetLabelPrint(); restoreAfterPdfExport(); });
    unmount();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
});

it('header Print រារាំងតម្លៃ optimistic រហូត definitive rejection ផ្ទៀង compensation', async () => {
    (document.getElementById('editBcCodInput') as HTMLInputElement).value = '17.25';
    (document.getElementById('editBcDodInput') as HTMLInputElement).value = '0';
    uiState.activeParentItemId = 'row'; uiState.activeEditingBarcode = 'OUTPUT1'; holdHistory = true;
    let changing: any;
    await reactAct(async () => { changing = saveEditedBarcodePrice(); await entered; });
    step(() => {});
    expect(dataState.scanHistory[0].pricePending.phase).toBe('admitted');
    expect(dataState.scanHistory[0].barcodes[0].cod).toBe(17.25);
    expect(tree[HISTORY].row.barcodes[0].cod).toBe(5);
    expect(() => buildExportRows()).toThrow(/Export/);
    step(() => (document.querySelector('#viewListModal .btn-cancel') as HTMLButtonElement).click());
    const header = document.querySelector('.header-more-btn') as HTMLButtonElement;
    expect(header.disabled).toBe(false);
    step(() => header.click());
    const menu = document.querySelector('#globalMoreMenu [data-act=moreMenuPrintLabels]') as HTMLButtonElement;
    expect(menu.disabled).toBe(false);
    step(() => menu.click());
    const pendingModal = modalIsOpen('labelPrintModal');
    const pendingPreview = copy(viewState.labelPrintPreview);
    let printed: any, saved: any;
    step(() => { printed = printLabelsFromModal(); saved = saveLabelImagesFromModal(); });
    saved = await saved;
    const outputs = [h.prints.length, h.shares.length, h.canvases];
    await reactAct(async () => {
        rejectHistory(Object.assign(new Error('synthetic definitive rejection'), { txOutcome: 'not-applied' }));
        await changing;
    });
    expect(tree[HISTORY].row.barcodes[0].cod).toBe(5);
    expect(tree[HISTORY].row.pricePending.outcome).toBe('compensated');
    expect(tree.zoew_daily_revenue_cod_dod[DAY].codDollar).toBe(5);
    expect(tree.zoew_daily_revenue_cod_dod[DAY].totalCount).toBe(1);
    expect.soft(pendingModal).toBe(false);
    expect.soft(pendingPreview?.rows || []).toEqual([]);
    expect.soft(printed).toBe(false);
    expect.soft(saved).toBe(false);
    expect.soft(outputs).toEqual([0, 0, 0]);
    step(() => moreMenuPrintItemLabels('row'));
    expect(printLabelsFromModal()).toBe(true);
    expect(h.prints.at(-1).labels[0].cod).toBe(5);
});

it.each(['admitted', 'history', 'cancelling', 'malformed'])('modal ដែលបើករួច ផ្ទៀង %s នៅ preview និង print/PNG handler ទោះលាក់ប្រាក់', async (phase) => {
    step(() => { expect(openLabelPrintModal({ kind: 'filter' })).toBe(true); });
    dataState.scanHistory[0].barcodes[0].cod = 17.25;
    dataState.scanHistory[0].pricePending = phase === 'malformed' ? { phase: 'settled' } : marker(phase);
    step(() => { (document.getElementById('labelShowMoney') as HTMLInputElement).checked = false; updateLabelPrintPreview(); });
    expect.soft(viewState.labelPrintPreview.rows).toEqual([]);
    expect.soft(viewState.labelPrintSummary).toContain('ផ្ទៀង');
    let printed: any;
    step(() => { printed = printLabelsFromModal(); });
    const saved = await saveLabelImagesFromModal();
    expect.soft(printed).toBe(false);
    expect.soft(saved).toBe(false);
    expect.soft(h.prints).toEqual([]);
    expect.soft(h.shares).toEqual([]);
    expect.soft(h.canvases).toBe(0);
});

it.each(['committed', 'compensated', 'ordinary'])('%s ដែល settle អនុញ្ញាត preview · print · PNG', async (outcome) => {
    if (outcome !== 'ordinary') dataState.scanHistory[0].pricePending = marker('settled', outcome);
    step(() => { expect(openLabelPrintModal({ kind: 'item', id: 'row' })).toBe(true); });
    expect(viewState.labelPrintPreview.rows[0].cod).toBe(5);
    step(() => { expect(printLabelsFromModal()).toBe(true); });
    expect(h.prints[0].labels[0].cod).toBe(5);
    expect(await saveLabelImagesFromModal()).toBe(true);
    expect(h.shares).toHaveLength(1);
});

it.each(['print', 'PNG'])('handler %s ផ្ទៀងតម្លៃថ្មី ទោះ preview មុននៅមានតម្លៃ settle', async (output) => {
    step(() => { expect(openLabelPrintModal({ kind: 'filter' })).toBe(true); });
    expect(viewState.labelPrintPreview.rows[0].cod).toBe(5);
    step(() => {
        dataState.scanHistory[0].barcodes[0].cod = 17.25;
        dataState.scanHistory[0].pricePending = marker('admitted');
    });
    expect(viewState.labelPrintPreview.rows[0].cod).toBe(5);
    let result: any;
    step(() => { result = output === 'print' ? printLabelsFromModal() : saveLabelImagesFromModal(); });
    expect(await result).toBe(false);
    expect(viewState.labelPrintPreview.rows).toEqual([]);
    expect([h.prints.length, h.shares.length, h.canvases]).toEqual([0, 0, 0]);
});

it('price pending នៅក្រៅតម្រង មិនរារាំងស្លាកដែល settle ក្នុងតម្រង', () => {
    dataState.scanHistory.push({ ...ordinary(), id: 'outside', scanDate: '2026-10-29', pricePending: marker('admitted') });
    uiState.currentFilterMode = 'custom'; uiState.customFilterDate = DAY;
    step(() => { expect(openLabelPrintModal({ kind: 'filter' })).toBe(true); });
    expect(viewState.labelPrintPreview.total).toBe(1);
    expect(printLabelsFromModal()).toBe(true);
    expect(h.prints[0].labels).toHaveLength(1);
});

it.each(['committed', 'compensated'].flatMap((outcome) => ['replace', 'touch', 'history'].map((change) => ({ outcome, change }))))('C02 UI $outcome/$change ស្ដារ preview និង public output ក្រោយ listener ផ្ទៀងបញ្ចប់', async ({ outcome, change }) => {
    step(() => { expect(openLabelPrintModal({ kind: 'filter' })).toBe(true); });
    const printButton = () => document.querySelector('#labelPrintModal .btn-confirm') as HTMLButtonElement;
    const imageButton = () => document.getElementById('labelImageBtn') as HTMLButtonElement;
    expect(printButton().disabled).toBe(false);
    await reactAct(async () => { step(() => {
        if (change === 'replace') dataState.scanHistory = [{ ...ordinary(), barcodes: [{ ...ordinary().barcodes[0], cod: 17.25 }], pricePending: marker('admitted') }];
        else {
            dataState.scanHistory[0].barcodes[0].cod = 17.25;
            dataState.scanHistory[0].pricePending = marker('admitted');
            if (change === 'touch') dataState.touch();
            else uiState.historyRenderSeq++;
        }
    }); });
    step(() => printButton().click());
    expect(h.prints).toEqual([]);
    expect(printButton().disabled).toBe(true);
    expect(imageButton().disabled).toBe(true);
    const price = outcome === 'committed' ? 17.25 : 5;
    await reactAct(async () => { step(() => {
        if (change === 'replace') dataState.scanHistory = [{ ...ordinary(), barcodes: [{ ...ordinary().barcodes[0], cod: price }], pricePending: marker('settled', outcome) }];
        else {
            dataState.scanHistory[0].barcodes[0].cod = price;
            dataState.scanHistory[0].pricePending = marker('settled', outcome);
            if (change === 'touch') dataState.touch();
            else uiState.historyRenderSeq++;
        }
    }); });
    expect.soft(printButton().disabled).toBe(false);
    expect.soft(imageButton().disabled).toBe(false);
    expect.soft(viewState.labelPrintPreview.rows[0]?.cod).toBe(price);
    expect.soft(viewState.labelPrintSummary).not.toContain('មិនទាន់ផ្ទៀងបញ្ចប់');
    step(() => printButton().click());
    expect.soft(h.prints.at(-1)?.labels[0].cod).toBe(price);
});

it('C02 UI preview តាម current filter ពេល scope ដែល pending ចូល ឬចេញពីតម្រង', async () => {
    dataState.scanHistory.push({ ...ordinary(), id: 'outside', scanDate: '2026-10-29', pricePending: marker('admitted') });
    uiState.currentFilterMode = 'custom'; uiState.customFilterDate = DAY;
    step(() => { expect(openLabelPrintModal({ kind: 'filter' })).toBe(true); });
    expect(viewState.labelPrintPreview.total).toBe(1);
    await reactAct(async () => { step(() => { uiState.currentFilterMode = 'all'; }); });
    expect.soft(viewState.labelPrintPreview.total).toBe(0);
    expect.soft((document.querySelector('#labelPrintModal .btn-confirm') as HTMLButtonElement).disabled).toBe(true);
    await reactAct(async () => { step(() => { uiState.currentFilterMode = 'custom'; }); });
    expect(viewState.labelPrintPreview.total).toBe(1);
    expect((document.querySelector('#labelPrintModal .btn-confirm') as HTMLButtonElement).disabled).toBe(false);
    step(() => { expect(printLabelsFromModal()).toBe(true); });
    expect(h.prints.at(-1).labels).toHaveLength(1);
});

it('C02 UI store notification ក្រោយ close/reset មិនស្ដារ preview របស់ session ចាស់', () => {
    step(() => { expect(openLabelPrintModal({ kind: 'filter' })).toBe(true); });
    step(() => { closeModal('labelPrintModal'); resetLabelPrint(); });
    step(() => { dataState.scanHistory = [{ ...ordinary(), barcodes: [{ ...ordinary().barcodes[0], cod: 17.25 }] }]; });
    expect(viewState.labelPrintPreview).toBeNull();
    expect(viewState.labelPrintSummary).toBe('');
    expect(modalIsOpen('labelPrintModal')).toBe(false);
    expect(h.prints).toEqual([]);
});
