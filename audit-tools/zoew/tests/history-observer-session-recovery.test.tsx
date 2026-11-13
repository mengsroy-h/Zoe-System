/**
 * គូរ HistoryTableBody ពិត ហើយប្រើ act/session guard/clock ពិត។
 * ក្លែងតែ IntersectionObserver ព្រោះ happy-dom មិនមាន layout របស់ browser។
 * sentinel ដែលនៅតែមើលឃើញមិនទទួល event ថ្មីដោយសារវគ្គផ្លាស់ប្ដូរទេ៖
 * មានតែ observer ថ្មីទើបទទួល initial observation ថ្មី។
 */
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { MemoHistoryTableBody } from '../../../ZoeW/src/app/components/history/HistoryTableBody';
import { firebaseState, uiState, dataState } from '../../../ZoeW/src/core/state';
import { resetServerClock, acceptServerClockOffset } from '../../../ZoeW/src/core/clock';
import { sessionUserActionAllowed } from '../../../ZoeW/src/core/session-verification';
import { renderHistory, HISTORY_PAGE_ROWS } from '../../../ZoeW/src/ui/history-render';
import { mount, step, unmount } from './native/react-harness';

class Observer {
    static active = new Set<Observer>();
    static initial = new Set<Observer>();
    callback: IntersectionObserverCallback;
    target: Element | null = null;
    constructor(callback: IntersectionObserverCallback) { this.callback = callback; }
    observe(target: Element) { this.target = target; Observer.active.add(this); Observer.initial.add(this); }
    disconnect() { Observer.active.delete(this); Observer.initial.delete(this); }
    emit(visible = true) {
        this.callback([{ isIntersecting: visible, target: this.target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
}
const count = () => document.querySelectorAll('#historyTableBody tr[data-id]').length;
const button = () => document.querySelector('.history-more-btn') as HTMLButtonElement;
function initialObservations() {
    const pending = [...Observer.initial]; Observer.initial.clear();
    step(() => { pending.forEach(observer => observer.emit()); });
}
function ready() {
    step(() => { firebaseState.sessionExpiryCheck = 'live'; });
    expect(sessionUserActionAllowed('showMoreHistoryRows')).toBe(true);
}
function renderRows() {
    dataState.exchangeRateRiel = 4100;
    mount(<div id="tableResponsive" className="table-responsive"><table><tbody id="historyTableBody"><MemoHistoryTableBody /></tbody></table></div>);
    step(() => renderHistory(Array.from({ length: 1200 }, (_, i) => ({
        id: 'row-' + i, phone: '012345678', cod: 1, dod: 0, count: 1,
        createdAt: Date.now(), time: '09:00', isClosed: false,
        barcodes: [{ code: 'barcode-' + i, cod: 1, dod: 0, isClosed: false }]
    })), 'filter|all|'));
    expect(count()).toBe(HISTORY_PAGE_ROWS);
    expect(button()).not.toBeNull();
}
beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', Observer);
    Observer.active.clear(); Observer.initial.clear();
    resetServerClock();
    firebaseState.auth = null;
    firebaseState.db = {} as any;
    expect(acceptServerClockOffset(0, Object.freeze({ epochMs: Date.now(), wallMs: Date.now(),
        monotonicMs: performance.now(), uncertaintyMs: 0, source: 'nonce', generation: 0 }), false)).toBe(true);
    firebaseState.auth = { currentUser: { uid: 'observer-test' } } as any;
    firebaseState.sessionExpiryCheck = 'unverified';
    uiState.historyView = null; uiState.historyViewKey = ''; uiState.historyRenderLimit = HISTORY_PAGE_ROWS;
});
afterEach(() => {
    unmount(); resetServerClock(); firebaseState.auth = null;
    firebaseState.sessionExpiryCheck = 'unverified';
    uiState.historyView = null; uiState.historyViewKey = ''; uiState.historyRenderLimit = HISTORY_PAGE_ROWS;
    vi.unstubAllGlobals();
});
it('វគ្គ live មុនគូរ៖ observer ពិតហៅ action ហើយ DOM កើនពី ៥០ ទៅ ១០០', () => {
    ready(); renderRows();
    expect(Observer.active.size).toBe(1);
    initialObservations();
    expect(count()).toBe(100);
});
it('វគ្គមិនទាន់ផ្ទៀងផ្ទាត់៖ observer និងប៊ូតុងមិនអាចជុំវិញ guard បាន', () => {
    renderRows(); initialObservations();
    step(() => button().click());
    expect(sessionUserActionAllowed('showMoreHistoryRows')).toBe(false);
    expect(count()).toBe(50);
});
it('ក្រោយផ្ទៀងផ្ទាត់៖ ប៊ូតុងនៅធ្វើការពិត ទោះ observer ធ្លាប់បរាជ័យ', () => {
    renderRows(); initialObservations(); ready();
    step(() => button().click());
    expect(count()).toBe(100);
});
it('sentinel មើលឃើញរហូត៖ ផ្ទៀងផ្ទាត់រួចត្រូវបន្តទាញ ដោយមិនចាំអ្នកប្រើរមូរចេញចូល', () => {
    renderRows(); initialObservations();
    expect(count()).toBe(50);
    ready();
    initialObservations();
    expect(count()).toBe(100);
});
it('sentinel ចេញចូលក្រោយផ្ទៀងផ្ទាត់៖ event ដែលបដិសេធមិនត្រូវចាក់សោ observer ជារៀងរហូត', () => {
    renderRows(); initialObservations(); ready();
    step(() => { [...Observer.active].forEach(observer => observer.emit(false)); });
    step(() => { [...Observer.active].forEach(observer => observer.emit(true)); });
    expect(count()).toBe(100);
});
it('វគ្គប្ដូរមុន React គូរឡើងវិញ៖ callback ពិនិត្យសិទ្ធិថ្មី ហើយមិនចាក់សោ latch ពេលបដិសេធ', () => {
    ready(); renderRows();
    const observer = [...Observer.active][0];
    step(() => {
        firebaseState.sessionExpiryCheck = 'unverified';
        observer.emit();
        expect(uiState.historyRenderLimit).toBe(50);
        firebaseState.sessionExpiryCheck = 'live';
        observer.emit();
    });
    expect(count()).toBe(100);
});
it('វគ្គបាត់សុពលភាពរួច៖ callback ចាស់មិនអាចទាញបន្ថែម ហើយវគ្គថ្មីអាចស្ដារ observer', () => {
    ready(); renderRows();
    const oldObserver = [...Observer.active][0];
    step(() => { firebaseState.sessionExpiryCheck = 'unverified'; });
    step(() => oldObserver.emit());
    expect(count()).toBe(50);
    ready(); initialObservations();
    expect(count()).toBe(100);
});
it.each(['session', 'page', 'unmount'])('callback ដែលជាប់ជួរក្រោយ cleanup ដោយ %s មិនអាចប្ដូរពិដានទៀត', reason => {
    ready(); renderRows();
    const oldObserver = [...Observer.active][0];
    if (reason === 'session') {
        step(() => { firebaseState.sessionExpiryCheck = 'unverified'; });
        ready();
    }
    if (reason === 'page') step(() => button().click());
    if (reason === 'unmount') unmount();
    const cap = uiState.historyRenderLimit;
    step(() => oldObserver.emit());
    expect(uiState.historyRenderLimit).toBe(cap);
    if (reason !== 'unmount') expect(count()).toBe(cap);
});
it('នាឡិកាបាត់ trust ពិត៖ sample ថ្មី និងវគ្គ live ស្ដារការទាញបន្ថែម', () => {
    ready(); renderRows();
    const oldObserver = [...Observer.active][0];
    step(() => { resetServerClock(); oldObserver.emit(); });
    expect(count()).toBe(50);
    expect(sessionUserActionAllowed('showMoreHistoryRows')).toBe(false);
    step(() => {
        expect(acceptServerClockOffset(0, Object.freeze({ epochMs: Date.now(), wallMs: Date.now(),
            monotonicMs: performance.now(), uncertaintyMs: 0, source: 'nonce', generation: 1 }), false)).toBe(true);
        firebaseState.sessionExpiryCheck = 'live';
    });
    initialObservations();
    expect(count()).toBe(100);
});
it('callback ស្ទួនក្នុងជំនាន់ observer ដដែល៖ ទាញបន្ថែមតែមួយទំព័រ', () => {
    ready(); renderRows();
    const observer = [...Observer.active][0];
    step(() => { observer.emit(); observer.emit(); });
    expect(count()).toBe(100);
});
