/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ App Android (APK) មិនទាញកំណែថ្មីដោយខ្លួនឯងទេ (web bundle នៅក្នុង APK) ➜ ពេល feed ប្រាប់កំណែថ្មីជាង `APP_VERSION`
 *    ផ្ទាំង 🔔 «📱 កំណែ App» បង្ហាញ link ទាញយក APK កំណែនោះពី GitHub Release (repo public)។
 * ⛔ URL ដេរីវេពី workflow ពិត (`.github/workflows/android-release.yml` ៖ ស្លាក `zoew-android-v<កំណែ>` · ឯកសារ `ZoeW-<កំណែ>.apk` លើ `main`)
 *    ➜ ការប្តូរឈ្មោះមួយខាងធ្វើឲ្យតេស្តនេះក្រហម (ថ្នេររវាង ២ ឯកសារ) · កំណែពី feed (បណ្តាញ) ត្រូវជាទម្រង់ X.Y.Z ទើបចូល URL ·
 *    web/PWA ទាញកំណែថ្មីដោយខ្លួនឯង ➜ គ្មាន link APK។
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { uiState } from '../src/core/state';
import { APP_VERSION } from '../src/core/version';
import * as notifications from '../src/features/notifications';
import { NotifyDrawer } from '../src/app/components/NotifyDrawer';
import { mount, step, unmount } from './native/react-harness';

const apkDownloadUrl: (v: unknown) => string | null = (notifications as any).apkDownloadUrl || (() => null);
const WORKFLOW = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'android-release.yml'), 'utf8');

function releaseUrlFromWorkflow(version: string) {
    const main = WORKFLOW.slice(WORKFLOW.indexOf('refs/heads/main'), WORKFLOW.indexOf('else', WORKFLOW.indexOf('refs/heads/main')));
    const tag = (/TAG="([^"]+)"/.exec(main) || [])[1];
    const file = (/FILE="([^"]+)"/.exec(main) || [])[1];
    expect(tag && file).toBeTruthy();
    const sub = (t: string) => t.replace(/\$\{VERSION\}/g, version);
    return 'https://github.com/mengsroy-h/Zoe-System/releases/download/' + sub(tag!) + '/' + sub(file!);
}

const [a, b, c] = APP_VERSION.split('.').map(Number);
const NEWER = a + '.' + b + '.' + (c + 1);

beforeEach(() => {
    step(() => {
        uiState.notifyFeed = [];
        uiState.notifySellerFeed = [];
        uiState.updateReady = false;
        uiState.notifyDrawerOpen = true;
    });
});

afterEach(() => {
    unmount();
    document.body.innerHTML = '';
    delete (window as any).Capacitor;
});

const apkLink = () => document.querySelector('#notifyVersionSection a.notify-apk-link') as HTMLAnchorElement | null;

describe('🔔 កំណែ App ៖ link ទាញយក APK ថ្មី', () => {
    it('URL = ស្លាក + ឈ្មោះឯកសារដែល workflow Release ពិតបង្កើត', () => {
        expect(apkDownloadUrl('2.50.99')).toBe(releaseUrlFromWorkflow('2.50.99'));
    });

    it('⛔ APK + feed មានកំណែថ្មីជាង ➜ link ទាញយក APK កំណែនោះ (បើកក្រៅ App)', () => {
        (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
        step(() => { uiState.notifyFeed = [{ id: NEWER, kind: 'update', version: NEWER, title: 't', body: 'b', date: '2026-10-08', points: [] }] as any; });
        mount(<NotifyDrawer />);
        const link = apkLink();
        expect(link).not.toBe(null);
        expect(link!.getAttribute('href')).toBe(releaseUrlFromWorkflow(NEWER));
        expect(link!.getAttribute('target')).toBe('_blank');
        expect(link!.textContent).toContain(NEWER);
    });

    it('ទិសផ្ទុយ ៖ web/PWA (ទាញកំណែថ្មីដោយខ្លួនឯង) ➜ គ្មាន link APK', () => {
        step(() => { uiState.notifyFeed = [{ id: NEWER, kind: 'update', version: NEWER, title: 't', body: 'b', date: '2026-10-08', points: [] }] as any; });
        mount(<NotifyDrawer />);
        expect(apkLink()).toBe(null);
    });

    it('ទិសផ្ទុយ ៖ APK ប្រើកំណែចុងក្រោយរួច ➜ គ្មាន link · កំណែពី feed មិនមែនទម្រង់ X.Y.Z ➜ គ្មាន URL', () => {
        (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
        step(() => { uiState.notifyFeed = [{ id: APP_VERSION, kind: 'update', version: APP_VERSION, title: 't', body: 'b', date: '2026-10-08', points: [] }] as any; });
        mount(<NotifyDrawer />);
        expect(apkLink()).toBe(null);
        expect(apkDownloadUrl('9.9.9"><b')).toBe(null);
        expect(apkDownloadUrl('../../x')).toBe(null);
        expect(apkDownloadUrl(undefined)).toBe(null);
    });
});
