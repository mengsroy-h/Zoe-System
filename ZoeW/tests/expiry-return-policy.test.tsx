/**
 * ⛔ គោលការណ៍ក្រុមហ៊ុន (សំណើម្ចាស់គម្រោង) ៖ កញ្ចប់មិនទាន់យកលើស ៧ ថ្ងៃ ត្រូវត្រឡប់ទៅសាខាកណ្តាល ➜ «ការជូនដំណឹងត្រូវរាយការណ៍ថា
 *    កញ្ចប់ជិតដល់ពេលត្រឡប់ទៅសាខាកណ្តាលវិញ សូមធ្វើការស្កេនត្រឡប់» ៖ 🔔 «📦» (សេចក្តីសង្ខេប · ជួរដល់ពេល) · 🔔 «📤» · ការរំលឹក 📲 ម៉ោង ៨ ព្រឹក · សៀវភៅណែនាំ។
 * ⛔ «៧ ថ្ងៃ» នៃគោលការណ៍ = ព្រំដែនសម្អាតដដែល (`ABANDON_AGE_MS`) ➜ ពេល App ដកកញ្ចប់ចេញ = ពេលក្រុមហ៊ុនទាមទារឲ្យត្រឡប់ (មិនមែនលេខទីពីរ)។
 * ⛔ អត្ថបទតែមួយកន្លែង (`NOTIFY_RETURN_*` ក្នុង `notifications.ts`) ៖ Function push (server) មិន import ពី App បាន ➜ តេស្តនេះបង្ខំឲ្យដូចគ្នា។
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { ABANDON_AGE_MS, EXPIRED_TRASH_RETENTION_MS } from '../src/features/session';
import * as notifications from '../src/features/notifications';
import { openNotifyDrawer } from '../src/features/notifications';
import { closeSideDrawer } from '../src/ui/page-nav';
import { NotifyDrawer } from '../src/app/components/NotifyDrawer';
import { createPushService, PUSH_BODY_MAX, PUSH_EXPIRY_WINDOW_MS, PUSH_TITLE_MAX } from '../netlify/lib/push-core.mjs';
import { mount, step, unmount } from './native/react-harness';

const DAY_MS = 24 * 60 * 60 * 1000;
const KHMER = '០១២៣៤៥៦៧៨៩';
const kh = (n: number) => String(n).replace(/[0-9]/g, (d) => KHMER[Number(d)]);
const N = notifications as any;

const policyText = () => N.NOTIFY_RETURN_POLICY_TEXT as string;
const stepText = () => N.NOTIFY_RETURN_STEP_TEXT as string;
const dueText = () => N.NOTIFY_RETURN_DUE_TEXT as string;
const soonText = () => N.NOTIFY_RETURN_SOON_TEXT as string;

beforeEach(() => {
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    try { localStorage.clear(); } catch {}
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }))));
    const now = Date.now();
    step(() => {
        uiState.notifyFeed = [];
        uiState.notifySellerFeed = [];
        uiState.notifySeenIds = [];
        uiState.notifyView = null;
        (uiState as any).notifyRemovedView = null;
        (uiState as any).notifyRemovedSeenIds = [];
        uiState.updateReady = false;
        uiState.notifyFeedFetchedAt = 0;
        uiState.notifyFeedInFlight = false;
        viewState.drawerGroupsOpen = [];
        dataState.scanHistory = [
            { id: 'DUE', phone: '0961000001', createdAt: now - ABANDON_AGE_MS - 60 * 1000, barcodes: [{ code: 'KH0000000001', isClosed: false, locker: 'A-1' }] },
            { id: 'SOON', phone: '0961000002', createdAt: now - ABANDON_AGE_MS + 5 * 60 * 60 * 1000, barcodes: [{ code: 'KH0000000002', isClosed: false }] }
        ];
        dataState.deletedItems = [
            { id: 'BACK', phone: '0972000004', deletedAt: now - 30 * 1000, barcodes: [{ code: 'KH0000000004', locker: 'B-3' }], trashReason: 'returned', isFromDeletion: false },
            { id: 'GONE', phone: '0972000003', deletedAt: now - 60 * 1000, barcodes: [{ code: 'KH0000000003', locker: 'B-2' }], trashReason: 'returned', isFromDeletion: false }
        ];
        firebaseState.isDatabaseInitialized = true;
    });
    mount(<NotifyDrawer />);
});

afterEach(() => {
    step(() => closeSideDrawer());
    unmount();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('គោលការណ៍ ៧ ថ្ងៃ ៖ ជិតផុតកំណត់ ➜ ស្កេនត្រឡប់ទៅសាខាកណ្តាល', () => {
    it('អត្ថបទគោលការណ៍ ៖ ៧ ថ្ងៃ = ABANDON_AGE_MS · សាខាកណ្តាល · ស្កេន «ត្រឡប់» ក្នុង ZTO', () => {
        expect(ABANDON_AGE_MS % DAY_MS).toBe(0);
        expect(typeof policyText()).toBe('string');
        expect(policyText()).toContain('លើស ' + kh(ABANDON_AGE_MS / DAY_MS) + ' ថ្ងៃ');
        expect(policyText()).toContain('សាខាកណ្តាល');
        expect(stepText()).toContain('ស្កេន «ត្រឡប់»');
        expect(stepText()).toContain('ZTO');
        expect(dueText()).toContain('ស្កេនត្រឡប់');
        expect(soonText()).toBe('ជិតដល់ពេលត្រឡប់ទៅសាខាកណ្តាលវិញ សូមធ្វើការស្កេនត្រឡប់');
    });

    it('🔔 «📦» ៖ សេចក្តីសង្ខេបប្រាប់គោលការណ៍ និងការស្កេនត្រឡប់ · ជួរដល់ពេល ➜ «ស្កេនត្រឡប់» · ជួរមិនទាន់ដល់ ➜ ម៉ោងនៅសល់', () => {
        step(() => openNotifyDrawer());
        step(() => (document.getElementById('notifyExpiryHead') as HTMLButtonElement).click());
        expect(uiState.notifyView!.packages).toBe(2);
        expect(document.getElementById('notifyExpiryHead')!.textContent).toContain('កញ្ចប់ជិតដល់ពេលត្រឡប់');
        const summary = document.getElementById('notifyExpirySummary')!.textContent || '';
        expect(summary).toContain(soonText());
        expect(summary).toContain(policyText());
        expect(summary).toContain(stepText());
        expect(summary).toContain('ដកលុយ');
        const rows = Array.from(document.querySelectorAll('#notifyExpiryList .notify-expiry-row'));
        expect(rows.length).toBe(2);
        const left = rows.map((r) => (r.querySelector('.notify-expiry-left') as HTMLElement).textContent);
        expect(left[0]).toBe(dueText());
        expect(rows[0].querySelector('.notify-expiry-left')!.classList.contains('is-due')).toBe(true);
        expect(left[1]).toMatch(/^≤ \d+ ម៉ោង$/);
    });

    it('🔔 «📤» ៖ កញ្ចប់ដែលដករួច ➜ «ត្រឡប់» · ប្រាប់ឲ្យស្កេនត្រឡប់ផ្ញើទៅសាខាកណ្តាល (បើមិនទាន់) · គ្មាន «ផុតកំណត់»', () => {
        step(() => openNotifyDrawer());
        step(() => (document.getElementById('notifyRemovedHead') as HTMLButtonElement).click());
        const summary = document.getElementById('notifyRemovedSummary')!.textContent || '';
        expect(summary).toContain(stepText());
        expect(summary).toContain('សាខាកណ្តាល');
        expect(summary).toContain('ដកលុយ');
        expect(summary).toContain('ត្រឡប់ (លើស ៧ ថ្ងៃ ឬ ZTO ស្កេនត្រឡប់)');
        expect(document.getElementById('notifyRemovedSection')!.textContent).not.toContain('ផុតកំណត់');
        expect(document.querySelectorAll('#notifyRemovedList .notify-expiry-row')).toHaveLength(2);
    });

    it('📲 ការរំលឹកម៉ោង ៨ ៖ ចំណងជើង «ត្រូវស្កេនត្រឡប់» · តួអត្ថបទ = គោលការណ៍ + ការស្កេន + ពេលទិន្នន័យ · មិនលើសពិដាន push', () => {
        const svc: any = createPushService({ env: {}, store: {} });
        const at = Date.UTC(2026, 9, 17, 0, 2, 0);
        const msg = svc.expiryMessage(3, at);
        expect(msg.kind).toBe('expiry');
        expect(msg.title).toBe('📦 3 កញ្ចប់ជិតដល់ពេលត្រឡប់ទៅសាខាកណ្តាលវិញ');
        expect(msg.body).toContain('សូមធ្វើការស្កេនត្រឡប់');
        expect(msg.body).toContain(policyText());
        expect(msg.body).toContain(stepText());
        expect(msg.body).toContain(kh(PUSH_EXPIRY_WINDOW_MS / (60 * 60 * 1000)) + ' ម៉ោង');
        expect(msg.body).toContain('តាមទិន្នន័យម៉ោង 07:02');
        expect(msg.title.length).toBeLessThanOrEqual(PUSH_TITLE_MAX);
        expect(msg.body.length).toBeLessThanOrEqual(PUSH_BODY_MAX);
        expect(PUSH_EXPIRY_WINDOW_MS).toBe(notifications.NOTIFY_EXPIRY_HOURS_MAX * notifications.NOTIFY_HOUR_MS);
    });

    it('📖 សៀវភៅណែនាំ ៖ ជំហានតាមលំដាប់ (រង់ចាំ ➜ 🔔 ➜ ស្កេនត្រឡប់ ➜ ZoeW ដក ➜ 📤 · ធុងសំរាម) · លេខដេរីវេពីកូដ', () => {
        const html = readFileSync(path.join(__dirname, '..', 'public', 'guide.html'), 'utf8');
        const head = html.indexOf('<h3>កញ្ចប់មិនទាន់យក ៖ គោលការណ៍ ' + kh(ABANDON_AGE_MS / DAY_MS) + ' ថ្ងៃ</h3>');
        expect(head).toBeGreaterThan(0);
        const olStart = html.indexOf('<ol>', head);
        const olEnd = html.indexOf('</ol>', olStart);
        expect(olStart).toBeGreaterThan(head);
        expect(html.slice(html.indexOf('</h3>', head), olStart)).not.toMatch(/<h[23][ >]/);
        const items = html.slice(olStart, olEnd).split('<li>').slice(1).map((li) => li.replace(/<[^>]+>/g, ''));
        expect(items.length).toBe(5);
        expect(items[0]).toContain('ទូ Locker');
        expect(items[0]).toContain(kh(ABANDON_AGE_MS / DAY_MS) + ' ថ្ងៃ');
        expect(items[1]).toContain('🔔');
        expect(items[1]).toContain(kh(notifications.NOTIFY_EXPIRY_HOURS_MAX) + ' ម៉ោង');
        expect(items[1]).toContain('ម៉ោង ៨');
        expect(items[2]).toContain('សាខាកណ្តាល');
        expect(items[2]).toContain('ស្កេន «ត្រឡប់»');
        expect(items[3]).toContain('«ត្រឡប់»');
        expect(items[3]).toContain('ថ្ងៃទី ' + kh(ABANDON_AGE_MS / DAY_MS + 1));
        expect(items.join(' '), 'ម្ចាស់គម្រោង ៖ «ដកមុខងារ ផុតកំណត់ចេញ»').not.toContain('ផុតកំណត់');
        expect(items[3]).toContain('ដកលុយ');
        expect(items[3]).toContain('បិទតាម ZTO ស្វ័យប្រវត្តិ');
        expect(items[4]).toContain('📤');
        expect(items[4]).toContain(kh(EXPIRED_TRASH_RETENTION_MS / DAY_MS) + ' ថ្ងៃ');
    });
});
