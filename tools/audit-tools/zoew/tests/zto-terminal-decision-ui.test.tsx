import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ table: {} as Record<string, any> }));
vi.mock('../../../../ZoeW/src/core/action-registry', () => ({
    ACTION_REGISTRY: actions.table, ACTION_NAMES: [],
    lookupAction: (name: string) => actions.table[name] || null
}));

import { RecentlyDeletedModal } from '../../../../ZoeW/src/app/components/modals/RecentlyDeletedModal';
import { dataState, uiState } from '../../../../ZoeW/src/core/state';
import { expandedTrashGroups } from '../../../../ZoeW/src/features/locker';
import { buildTrashGroups, openRecentlyDeletedModal, renderRecentlyDeleted, toggleTrashGroup, toggleTrashReasonFilter } from '../../../../ZoeW/src/features/trash';
import { explainZtoRestoreBlock, ZTO_RESTORE_BLOCK_TEXT } from '../../../../ZoeW/src/features/zto-final-marks';
import { dropOldestToast } from '../../../../ZoeW/src/ui/toast';
import { mount, step, unmount } from './native/react-harness';

// Real React projections of synchronized A/B/C read snapshots. This test does
// not claim independent devices, backend Rules/RLS or realtime transport.
class FakeIo { observe() {} disconnect() {} }
const NOW = Date.UTC(2026, 10, 14, 8);
const labels = { signed: 'ZTO ហាមស្តារ', returned: 'ZTO ហាមស្តារ៖ ត្រឡប់' };
const observedLabels = { signed: 'ZTO Sign រួច', returned: 'ZTO ត្រឡប់' };
const originLabels = { remove: 'ដក', delete: 'លុប', pickup: 'យករួច' };
const clone = <T,>(value: T): T => structuredClone(value);

function source(reason: 'remove' | 'delete' | 'pickup', id = 'source') {
    return { id, phone: '012345678', scanDate: '2026-11-14', time: '08:00:00', createdAt: NOW - 3600000,
        deletedAt: NOW, trashMode: 'cookie', trashReason: reason, isFromDeletion: reason !== 'remove',
        isClosed: reason === 'pickup', count: 1, cod: 10, dod: 2, price: 12,
        barcodes: [{ code: 'PARCEL_' + id, createdAt: NOW - 3600000, cod: 10, dod: 2,
            isClosed: reason === 'pickup', isDeducted: reason === 'remove', isFromDeletion: reason !== 'remove' }] };
}
const rows = () => Array.from(document.querySelectorAll<HTMLTableRowElement>('#deletedTableBody .trash-group-row'));
const badges = (root: ParentNode) => Array.from(root.querySelectorAll('[data-zto-terminal]')).map(node => node.textContent);
function show(items: any[]) {
    step(() => { dataState.deletedItems = clone(items); renderRecentlyDeleted(); });
}
function financialView() {
    return { summary: clone(uiState.trashSummary), groups: buildTrashGroups(dataState.deletedItems).map(group => ({
        key: group.key, reason: group.reason, codes: clone(group.codes), count: group.count, cod: group.cod, dod: group.dod, total: group.total
    })) };
}

actions.table.toggleTrashReasonFilter = toggleTrashReasonFilter;
actions.table.toggleTrashGroup = toggleTrashGroup;
actions.table.explainZtoRestoreBlock = explainZtoRestoreBlock;

beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeIo);
    expandedTrashGroups.clear();
    dataState.exchangeRateRiel = 4000;
    dataState.deletedItems = [];
    uiState.deletedSearchQuery = ''; uiState.trashReasonFilter = '';
    mount(<RecentlyDeletedModal />);
    step(() => { openRecentlyDeletedModal(); });
});
afterEach(() => {
    unmount(); vi.unstubAllGlobals(); expandedTrashGroups.clear();
    dataState.deletedItems = []; uiState.trashView = null; uiState.trashSummary = null; uiState.trashReasonFilter = '';
    while (uiState.toasts.length) dropOldestToast();
});

it.each((['remove', 'delete', 'pickup'] as const).flatMap(reason => (['signed', 'returned'] as const).map(decision => ({ reason, decision }))))(
    '$reason keeps its financial origin while synchronized A/B/C views display restore-deny $decision once', ({ reason, decision }) => {
        const initial = source(reason);
        show([initial]);
        const before = financialView();
        expect(rows()).toHaveLength(1);
        expect(rows()[0].querySelector('.trash-tag')?.textContent).toBe(originLabels[reason]);
        expect(badges(rows()[0])).toEqual([]);
        const synchronized = { ...initial, ztoTerminalDecision: decision };
        for (const replica of ['A', 'B', 'C']) {
            show([synchronized]);
            expect(financialView(), replica + ': decision must not alter grouping, money, filters or counts').toEqual(before);
            expect(rows(), replica + ': no duplicate record after sync').toHaveLength(1);
            expect(rows()[0].querySelectorAll('.trash-tag')).toHaveLength(1);
            expect(rows()[0].querySelector('.trash-tag')?.textContent).toBe(originLabels[reason]);
            expect(badges(rows()[0]), replica + ': one separate terminal badge').toEqual([labels[decision]]);
            const restore = rows()[0].querySelector<HTMLButtonElement>('.trash-restore-btn')!;
            expect(restore.classList.contains('is-zto-final')).toBe(true);
            expect(restore.title).toBe('មិនអាចស្តារបាន');
            expect(restore.textContent).toBe('🔒');
            expect(dataState.deletedItems).toEqual([synchronized]);
            expect(dataState.deletedItems[0].barcodes[0].ztoSignedAt).toBeUndefined();
            expect(dataState.deletedItems[0].barcodes[0].ztoReturnedAt).toBeUndefined();
        }
    }
);

it('mixed terminal decisions remain source-specific in a grouped row and never change the original financial filter', () => {
    const initial = [source('remove', 'signed'), source('remove', 'returned'), source('remove', 'normal')];
    show(initial);
    const before = financialView();
    const synchronized = initial.map(item => item.id === 'normal' ? item : { ...item, ztoTerminalDecision: item.id });
    show(synchronized);
    expect(financialView()).toEqual(before);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].querySelector('.trash-tag')?.textContent).toBe('ដក');
    expect(new Set(badges(rows()[0]))).toEqual(new Set([labels.signed, labels.returned]));
    expect(badges(rows()[0])).toHaveLength(2);
    const key = buildTrashGroups(dataState.deletedItems)[0].key;
    step(() => { toggleTrashGroup(key); });
    const subRows = Array.from(document.querySelectorAll<HTMLTableRowElement>('.trash-sub-row'));
    expect(subRows).toHaveLength(3);
    for (const item of synchronized) {
        const subRow = subRows.find(row => row.textContent?.includes(item.barcodes[0].code))!;
        expect(badges(subRow)).toEqual(item.id === 'normal' ? [] : [labels[item.id as keyof typeof labels]]);
        expect(subRow.querySelector('.trash-restore-btn')?.classList.contains('is-zto-final')).toBe(item.id !== 'normal');
    }
    step(() => { toggleTrashReasonFilter('kept'); });
    expect(rows()).toHaveLength(0);
    step(() => { toggleTrashReasonFilter('kept'); toggleTrashReasonFilter('deducted'); });
    expect(rows()).toHaveLength(1);
    expect(rows()[0].querySelector('.count-badge')?.textContent).toContain('3');
    expect(uiState.trashSummary.deducted).toMatchObject({ total: 36, count: 3 });
    expect(uiState.trashSummary.kept).toMatchObject({ total: 0, count: 0 });
    expect(dataState.deletedItems).toEqual(synchronized);
});

it.each(['actual-signed', 'restore-blocked'] as const)('%s outranks a returned decision without turning a restore ban into provider Sign proof', basis => {
    const item: any = { ...source('delete'), ztoTerminalDecision: 'returned' };
    if (basis === 'actual-signed') item.barcodes[0].ztoSignedAt = NOW - 1000;
    else item.restoreBlocked = true;
    show([item]);
    expect(badges(rows()[0])).toEqual([basis === 'actual-signed' ? observedLabels.signed : labels.signed]);
    expect(rows()[0].querySelector('.trash-tag')?.textContent).toBe('លុប');
    expect(uiState.trashView.rows[0].singleBlock).toBe('signed');
    expect(dataState.deletedItems).toEqual([item]);
    expect(dataState.deletedItems[0].barcodes[0].ztoReturnedAt).toBeUndefined();
});

it.each(['signed', 'returned'] as const)('%s changes from a restore-deny label to provider truth only after the source stamp syncs', kind => {
    const initial: any = { ...source('remove'), ztoTerminalDecision: kind };
    show([initial]);
    const before = financialView();
    expect(badges(rows()[0])).toEqual([labels[kind]]);
    expect(initial.barcodes[0].ztoSignedAt).toBeUndefined();
    expect(initial.barcodes[0].ztoReturnedAt).toBeUndefined();
    const observed = clone(initial);
    observed.barcodes[0][kind === 'signed' ? 'ztoSignedAt' : 'ztoReturnedAt'] = NOW - 1000;
    for (const replica of ['A', 'B', 'C']) {
        show([observed]);
        expect(badges(rows()[0]), replica + ': source stamp is the provider fact').toEqual([observedLabels[kind]]);
        expect(financialView()).toEqual(before);
        expect(rows()).toHaveLength(1);
        expect(dataState.deletedItems).toEqual([observed]);
    }
});

it.each(['sent-equal', 'sent-later', 'misplaced-equal', 'misplaced-later', 'before-birth'] as const)('%s keeps a returned restore-deny label instead of asserting a current provider Return', later => {
    const item: any = { ...source('delete'), ztoTerminalDecision: 'returned' };
    item.barcodes[0].ztoReturnedAt = later === 'before-birth' ? item.barcodes[0].createdAt - 1 : NOW - 2000;
    if (later !== 'before-birth') item.barcodes[0][later.startsWith('sent') ? 'ztoSentOutAt' : 'ztoMisplacedAt'] = NOW - (later.endsWith('equal') ? 2000 : 1000);
    show([item]);
    expect(badges(rows()[0])).toEqual([labels.returned]);
    expect(rows()[0].querySelector('.trash-tag')?.textContent).toBe('លុប');
    expect(rows()[0].querySelector('.trash-restore-btn')?.textContent).toBe('🔒');
    expect(dataState.deletedItems).toEqual([item]);
});

it.each(['signed', 'returned'] as const)('%s grouped summary does not promote every source when only one has provider proof', kind => {
    const observed: any = { ...source('remove', 'observed'), ztoTerminalDecision: kind };
    observed.barcodes[0][kind === 'signed' ? 'ztoSignedAt' : 'ztoReturnedAt'] = NOW - 1000;
    const decisionOnly = { ...source('remove', 'decisionOnly'), ztoTerminalDecision: kind };
    show([observed, decisionOnly]);
    const before = financialView();
    expect(rows()).toHaveLength(1);
    expect(badges(rows()[0])).toEqual([labels[kind]]);
    const key = buildTrashGroups(dataState.deletedItems)[0].key;
    step(() => { toggleTrashGroup(key); });
    const subRows = Array.from(document.querySelectorAll<HTMLTableRowElement>('.trash-sub-row'));
    expect(subRows).toHaveLength(2);
    expect(badges(subRows.find(row => row.textContent?.includes(observed.barcodes[0].code))!)).toEqual([observedLabels[kind]]);
    expect(badges(subRows.find(row => row.textContent?.includes(decisionOnly.barcodes[0].code))!)).toEqual([labels[kind]]);
    expect(financialView()).toEqual(before);
    expect(dataState.deletedItems).toEqual([observed, decisionOnly]);
});

it('a terminal decision with an existing restore claim remains locked instead of showing half-restored action', () => {
    const item = { ...source('remove'), ztoTerminalDecision: 'returned', restoreClaim: { token: 'business-attempt', targetId: 'target', claimedAt: NOW } };
    show([item]);
    const restore = rows()[0].querySelector<HTMLButtonElement>('.trash-restore-btn')!;
    expect(badges(rows()[0])).toEqual([labels.returned]);
    expect(restore.classList.contains('is-half')).toBe(false);
    expect(restore.textContent).toBe('🔒');
    expect(uiState.trashView.rows[0].singleHalf).toBe(false);
    expect(dataState.deletedItems).toEqual([item]);
});

it.each(['decision-signed', 'restore-blocked', 'actual-signed'] as const)('%s lock explanation separates a permanent restore ban from actual provider Sign', basis => {
    const item: any = { ...source('delete'), ztoTerminalDecision: basis === 'decision-signed' ? 'signed' : 'returned' };
    if (basis === 'restore-blocked') item.restoreBlocked = true;
    if (basis === 'actual-signed') item.barcodes[0].ztoSignedAt = NOW - 1000;
    show([item]);
    const before = financialView();
    step(() => { rows()[0].querySelector<HTMLButtonElement>('.trash-restore-btn')!.click(); });
    expect(uiState.toasts).toHaveLength(1);
    const message = uiState.toasts[0].msg;
    if (basis === 'actual-signed') expect(message).toBe(ZTO_RESTORE_BLOCK_TEXT.signed);
    else {
        expect(message).toContain('មិនអាចស្តារ');
        expect(message).not.toContain('Sign');
    }
    expect(rows()[0].querySelector('.trash-tag')?.textContent).toBe('លុប');
    expect(rows()[0].querySelector('.trash-restore-btn')?.textContent).toBe('🔒');
    expect(uiState.trashView.rows[0].singleBlock).toBe('signed');
    expect(financialView()).toEqual(before);
    expect(dataState.deletedItems).toEqual([item]);
});

it.each(['decision-signed', 'restore-blocked'] as const)('%s preserves the generic restore ban and independently displays an actual Return on A/B/C', basis => {
    const item: any = { ...source('remove'), ztoTerminalDecision: basis === 'decision-signed' ? 'signed' : 'returned' };
    if (basis === 'restore-blocked') item.restoreBlocked = true;
    item.barcodes[0].ztoReturnedAt = NOW - 1000;
    show([item]);
    const before = financialView();
    for (const replica of ['A', 'B', 'C']) {
        show([item]);
        expect(badges(rows()[0]), replica + ': independent policy denial and Return fact').toEqual([labels.signed, observedLabels.returned]);
        expect(rows()[0].querySelectorAll('.trash-tag')).toHaveLength(1);
        expect(rows()[0].querySelector('.trash-tag')?.textContent).toBe('ដក');
        expect(rows()[0].querySelector('.trash-restore-btn')?.textContent).toBe('🔒');
        expect(uiState.trashView.rows[0].singleBlock).toBe('signed');
        expect(financialView()).toEqual(before);
        expect(dataState.deletedItems).toEqual([item]);
        expect(dataState.deletedItems[0].barcodes[0].ztoSignedAt).toBeUndefined();
    }
});

it.each(['decision-signed', 'restore-blocked'] as const)('%s grouped source keeps truthful Return and denial badges with a generic lock explanation', basis => {
    const observed: any = { ...source('remove', 'actualReturn'), ztoTerminalDecision: basis === 'decision-signed' ? 'signed' : 'returned' };
    if (basis === 'restore-blocked') observed.restoreBlocked = true;
    observed.barcodes[0].ztoReturnedAt = NOW - 1000;
    const decisionOnly: any = { ...source('remove', 'decisionOnly'), ztoTerminalDecision: 'signed' };
    show([observed, decisionOnly]);
    const before = financialView();
    expect(rows()).toHaveLength(1);
    expect(badges(rows()[0])).toEqual([labels.signed, observedLabels.returned]);
    const key = buildTrashGroups(dataState.deletedItems)[0].key;
    step(() => { toggleTrashGroup(key); });
    const subRows = Array.from(document.querySelectorAll<HTMLTableRowElement>('.trash-sub-row'));
    expect(subRows).toHaveLength(2);
    const observedRow = subRows.find(row => row.textContent?.includes(observed.barcodes[0].code))!;
    const decisionRow = subRows.find(row => row.textContent?.includes(decisionOnly.barcodes[0].code))!;
    expect(badges(observedRow)).toEqual([labels.signed, observedLabels.returned]);
    expect(badges(decisionRow)).toEqual([labels.signed]);
    step(() => { observedRow.querySelector<HTMLButtonElement>('.trash-restore-btn')!.click(); });
    expect(uiState.toasts).toHaveLength(1);
    expect(uiState.toasts[0].msg).not.toContain('Sign');
    expect(uiState.toasts[0].msg).toContain('មិនអាចស្តារ');
    expect(financialView()).toEqual(before);
    expect(dataState.deletedItems).toEqual([observed, decisionOnly]);
});

it('actual provider Sign still wins over an actual Return when policy also denies restoration', () => {
    const item: any = { ...source('pickup'), ztoTerminalDecision: 'returned', restoreBlocked: true };
    item.barcodes[0].ztoReturnedAt = NOW - 2000;
    item.barcodes[0].ztoSignedAt = NOW - 1000;
    show([item]);
    const before = financialView();
    expect(badges(rows()[0])).toEqual([observedLabels.signed]);
    step(() => { rows()[0].querySelector<HTMLButtonElement>('.trash-restore-btn')!.click(); });
    expect(uiState.toasts).toHaveLength(1);
    expect(uiState.toasts[0].msg).toBe(ZTO_RESTORE_BLOCK_TEXT.signed);
    expect(rows()[0].querySelector('.trash-tag')?.textContent).toBe('យករួច');
    expect(uiState.trashView.rows[0].singleBlock).toBe('signed');
    expect(financialView()).toEqual(before);
    expect(dataState.deletedItems).toEqual([item]);
});

it.each((['cookie', 'palm'] as const).flatMap(mode => (['remove', 'delete', 'pickup'] as const).map(reason => ({ mode, reason }))))(
    '$mode $reason displays a persisted actual Return without requiring a new restore-deny marker', ({ mode, reason }) => {
        const item: any = { ...source(reason), trashMode: mode };
        item.barcodes[0].ztoReturnedAt = NOW - 1000;
        show([item]);
        const before = financialView();
        const expected = mode === 'palm' && reason === 'pickup' ? [labels.signed, observedLabels.returned] : [observedLabels.returned];
        for (const replica of ['A', 'B', 'C']) {
            show([item]);
            expect(badges(rows()[0]), replica + ': stored Return fact is independent of decision-field rollout').toEqual(expected);
            expect(rows()).toHaveLength(1);
            expect(rows()[0].querySelector('.trash-tag')?.textContent).toBe(originLabels[reason]);
            expect(rows()[0].querySelectorAll('.trash-tag')).toHaveLength(1);
            expect(financialView()).toEqual(before);
            expect(dataState.deletedItems).toEqual([item]);
            expect(dataState.deletedItems[0]).not.toHaveProperty('ztoTerminalDecision');
            expect(dataState.deletedItems[0].barcodes[0].ztoSignedAt).toBeUndefined();
        }
    }
);

it.each(['cookie', 'palm'] as const)('%s keeps a no-field restoreBlocked denial beside an independently stored Return', mode => {
    const item: any = { ...source('delete'), trashMode: mode, restoreBlocked: true };
    item.barcodes[0].ztoReturnedAt = NOW - 1000;
    show([item]);
    const before = financialView();
    expect(badges(rows()[0])).toEqual([labels.signed, observedLabels.returned]);
    expect(rows()[0].querySelector('.trash-tag')?.textContent).toBe('លុប');
    expect(rows()[0].querySelector('.trash-restore-btn')?.textContent).toBe('🔒');
    expect(uiState.trashView.rows[0].singleBlock).toBe('signed');
    expect(financialView()).toEqual(before);
    expect(dataState.deletedItems).toEqual([item]);
    expect(dataState.deletedItems[0]).not.toHaveProperty('ztoTerminalDecision');
});

it.each(['cookie', 'palm'] as const)('%s no-field actual Sign outranks an earlier actual Return without changing the original trash origin', mode => {
    const item: any = { ...source('remove'), trashMode: mode };
    item.barcodes[0].ztoReturnedAt = NOW - 2000;
    item.barcodes[0].ztoSignedAt = NOW - 1000;
    show([item]);
    const before = financialView();
    expect(badges(rows()[0])).toEqual([observedLabels.signed]);
    expect(rows()[0].querySelector('.trash-tag')?.textContent).toBe('ដក');
    expect(rows()[0].querySelector('.trash-restore-btn')?.textContent).toBe('🔒');
    expect(uiState.trashView.rows[0].singleBlock).toBe('signed');
    expect(financialView()).toEqual(before);
    expect(dataState.deletedItems).toEqual([item]);
    expect(dataState.deletedItems[0]).not.toHaveProperty('ztoTerminalDecision');
});
