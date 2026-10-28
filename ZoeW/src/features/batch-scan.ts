import { fieldValue, focusField, setFieldValue } from '../app/refs';
import { modalIsOpen } from '../core/modals';
import { latinDigits } from '../core/text';
import { firebaseState, scanState, uiState } from '../core/state';
import { viewState } from '../core/view-state';
import { isBarcodeAlreadyUsed } from '../domain/registry';
import { triggerScanAction } from './scan-action';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';

export const BATCH_SCAN_MAX = 200;

export const SCAN_FLOW_MODALS = ['phoneModal', 'scanRemoveModal', 'locationWarningModal'];

interface BatchRun {
    queue: string[];
    index: number;
    saved: number;
    skipped: number;
    existing: number;
    current: string;
    waiting: boolean;
    scanner: boolean;
    mode: string;
    db: unknown;
    auth: number;
    unsubscribe: (() => void) | null;
}

let batchRun: BatchRun | null = null;

export function parseBatchBarcodes(text) {
    const seen = new Set<string>();
    const codes: string[] = [];
    String(text || '').split(/[\s,;]+/).forEach((raw) => {
        const code = latinDigits(raw).trim();
        if (!code) return;
        const key = code.toUpperCase();
        if (seen.has(key)) return;
        seen.add(key);
        codes.push(code);
    });
    return codes;
}

export function batchScanIsRunning() {
    return batchRun !== null;
}

function batchScanStatusText(run: BatchRun) {
    const done = run.index;
    return (run.scanner ? '📥 ការស្កេនតាមជួរ ' : '📋 កំពុងបញ្ចូល ') + done + '/' + run.queue.length + (run.current ? ' · ' + run.current : '');
}

function renderBatchScanStatus() {
    viewState.batchScanStatus = batchRun ? batchScanStatusText(batchRun) : '';
}

export function updateBatchScanCount() {
    const n = parseBatchBarcodes(fieldValue('batchBarcodeInput')).length;
    viewState.batchScanCountText = n ? n + ' Barcode' : '';
}

export function openBatchScanModal() {
    if (uiState.isModalOpen || batchScanIsRunning()) return;
    if (uiState.entryScanMode !== 'parcel') {
        showToast('⚠️ ការបញ្ចូលច្រើនប្រើបានតែក្នុងរបៀប «បញ្ចូលកញ្ចប់»។');
        return;
    }
    updateBatchScanCount();
    openModalHelper('batchScanModal');
    setTimeout(() => focusField('batchBarcodeInput'), 150);
}

function endBatchScan(reason: 'done' | 'stopped' | 'session' | 'mode' | 'offline') {
    const run = batchRun;
    if (!run) return;
    batchRun = null;
    if (run.unsubscribe) run.unsubscribe();
    viewState.batchScanStatus = '';
    if (reason === 'session') return;
    const left = run.queue.length - run.index;
    if (run.scanner) {
        if (reason === 'done') return;
        const rest = left > 0 ? ' ៖ មិនទាន់ស្កេន ' + left + ' (' + run.queue.slice(run.index).join(', ') + ')' : '';
        showToast((reason === 'mode' ? '⚠️ ការស្កេនតាមជួរឈប់ (ប្តូររបៀបស្កេន)' : 'ℹ️ បានបញ្ឈប់ការស្កេនតាមជួរ') + rest + '។');
        return;
    }
    const parts = ['បញ្ចូល ' + run.saved];
    if (run.existing) parts.push('មានរួច ' + run.existing);
    if (run.skipped) parts.push('រំលង ' + run.skipped);
    if (left > 0) parts.push('មិនទាន់បញ្ចូល ' + left);
    const head = reason === 'done' ? '✅ បញ្ចូលច្រើនចប់ ៖ ' : (reason === 'mode' ? '⚠️ ការបញ្ចូលច្រើនឈប់ (ប្តូររបៀបស្កេន) ៖ ' : (reason === 'offline' ? '⚠️ ការបញ្ចូលច្រើនឈប់ (ក្រៅបណ្ដាញ — ភ្ជាប់វិញ រួចចាប់ផ្តើមម្តងទៀត) ៖ ' : 'ℹ️ បានបញ្ឈប់ការបញ្ចូលច្រើន ៖ '));
    showToast(head + parts.join(' · '));
}

function batchSessionIsCurrent(run: BatchRun) {
    return run.db === firebaseState.db && run.auth === firebaseState.authGeneration;
}

function settleCurrent(run: BatchRun) {
    if (!run.current) return;
    if (run.scanner) {
        run.current = '';
        return;
    }
    if (isBarcodeAlreadyUsed(run.current)) run.saved++;
    else run.skipped++;
    run.current = '';
}

function currentIsOpen(run: BatchRun) {
    return run.scanner ? uiState.isModalOpen : modalIsOpen('phoneModal');
}

function scanPathBusy() {
    return uiState.isModalOpen || !!uiState.scanRemoveInFlight;
}

function pumpBatchScan() {
    const run = batchRun;
    if (!run) return;
    if (!batchSessionIsCurrent(run)) { endBatchScan('session'); return; }
    if (run.waiting) {
        if (currentIsOpen(run)) return;
        run.waiting = false;
        settleCurrent(run);
        renderBatchScanStatus();
    }
    if (scanPathBusy()) return;
    if (uiState.entryScanMode !== run.mode) { endBatchScan('mode'); return; }
    if (!run.scanner && (navigator.onLine as boolean) === false) { endBatchScan('offline'); return; }
    while (run.index < run.queue.length) {
        const code = run.queue[run.index];
        run.index++;
        if (!run.scanner && isBarcodeAlreadyUsed(code)) { run.existing++; continue; }
        run.current = code;
        renderBatchScanStatus();
        triggerScanAction(code);
        if (currentIsOpen(run)) { run.waiting = true; return; }
        settleCurrent(run);
        if (scanPathBusy()) return;
    }
    endBatchScan('done');
}

function beginRun(codes: string[], scanner: boolean) {
    const run: BatchRun = {
        queue: codes, index: 0, saved: 0, skipped: 0, existing: 0, current: '', waiting: false,
        scanner, mode: scanner ? String(uiState.entryScanMode || 'parcel') : 'parcel',
        db: firebaseState.db, auth: firebaseState.authGeneration, unsubscribe: null
    };
    batchRun = run;
    run.unsubscribe = uiState.subscribe(() => { if (batchRun === run) pumpBatchScan(); });
    renderBatchScanStatus();
    pumpBatchScan();
}

export function queueScannedCode(raw: string): boolean {
    const code = latinDigits(String(raw || '')).trim();
    if (!code) return false;
    const key = code.toUpperCase();
    if (uiState.currentAppPage !== 'entry') {
        showToast(`⚠️ Barcode (${code}) មិនបានបញ្ចូល — សូមស្កេននៅទំព័រស្កេន។`);
        return false;
    }
    const shown = modalIsOpen('phoneModal') ? scanState.pendingBarcode : (modalIsOpen('scanRemoveModal') && uiState.pendingScannedRemoval ? uiState.pendingScannedRemoval.barcodeCode : '');
    if (String(shown || '').trim().toUpperCase() === key) {
        showToast(`ℹ️ Barcode (${code}) កំពុងបើកនៅផ្ទាំងនេះរួចហើយ។`);
        return false;
    }
    const run = batchRun;
    const open = Array.isArray(uiState.modalStack) ? uiState.modalStack : [];
    if (!run && open.length && !open.some((id) => SCAN_FLOW_MODALS.indexOf(id) !== -1)) {
        showToast(`⚠️ Barcode (${code}) មិនបានបញ្ចូល — បិទផ្ទាំងនេះ រួចស្កេនម្ដងទៀត។`);
        return false;
    }
    if (run) {
        const waiting = run.queue.slice(run.index).concat(run.current ? [run.current] : []);
        if (waiting.some((c) => c.toUpperCase() === key)) {
            showToast(`ℹ️ Barcode (${code}) នៅក្នុងជួររួចហើយ។`);
            return false;
        }
        if (run.queue.length - run.index >= BATCH_SCAN_MAX) {
            showToast(`⚠️ ជួររង់ចាំពេញ (${BATCH_SCAN_MAX}) — Barcode (${code}) មិនបានបញ្ចូល។ សូមស្កេនម្ដងទៀតក្រោយ។`);
            return false;
        }
        run.queue.push(code);
        renderBatchScanStatus();
        showToast(`⏳ 📥 Barcode (${code}) នៅក្នុងជួរ — នឹងបើកតាមលំដាប់ (នៅសល់ ${run.queue.length - run.index})។`);
        pumpBatchScan();
        return true;
    }
    showToast(`⏳ 📥 Barcode (${code}) នៅក្នុងជួរ — នឹងបើកក្រោយផ្ទាំងនេះបិទ។`);
    beginRun([code], true);
    return true;
}

export function startBatchScan() {
    if (batchRun) return;
    const codes = parseBatchBarcodes(fieldValue('batchBarcodeInput'));
    if (!codes.length) {
        showToast('⚠️ សូមវាយ ឬស្កេន Barcode យ៉ាងតិចមួយ (មួយជួរមួយ Barcode)។');
        return;
    }
    if (codes.length > BATCH_SCAN_MAX) {
        showToast('⚠️ បញ្ចូលបានយ៉ាងច្រើន ' + BATCH_SCAN_MAX + ' Barcode ក្នុងមួយលើក (មាន ' + codes.length + ')។');
        return;
    }
    setFieldValue('batchBarcodeInput', '');
    viewState.batchScanCountText = '';
    closeModal('batchScanModal');
    beginRun(codes, false);
}

export function stopBatchScan() {
    if (!batchRun) return;
    if (!batchRun.scanner && batchRun.waiting && modalIsOpen('phoneModal')) {
        batchRun.queue.length = batchRun.index;
        renderBatchScanStatus();
        showToast('ℹ️ នឹងបញ្ឈប់ក្រោយកញ្ចប់នេះ។');
        return;
    }
    endBatchScan('stopped');
}

export function resetBatchScan() {
    const run = batchRun;
    batchRun = null;
    if (run && run.unsubscribe) run.unsubscribe();
    viewState.batchScanStatus = '';
    viewState.batchScanCountText = '';
    setFieldValue('batchBarcodeInput', '');
}
