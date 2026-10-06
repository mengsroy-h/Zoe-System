/**
 * ⛔ ប្រអប់ «⚙️ ភ្ជាប់ប្រព័ន្ធ» (សំណើម្ចាស់គម្រោង) ៖ ជ្រើស Firebase/Supabase · វាល Supabase · បិទភ្ជាប់ Setup Link · QR ពីរូបភាព។
 * ⛔ ផ្លូវ Setup Link ទាំង ៤ (URL `?setup=` · កាមេរ៉ា · រូបភាព · បិទភ្ជាប់) ឆ្លង `applySetupPayload()` តែមួយ ➜ `invite` ត្រូវចងចាំ
 *    ហើយ `dsn` ចូលវាល Sentry — ⛔ មិនមែនដាក់ក្នុង textarea (ពេលរក្សាទុក `normalizeFirebaseConfig()` បោះវាលក្រៅបញ្ជីចោល ➜
 *    កូដអញ្ជើញបាត់ ៖ ផ្លូវកាមេរ៉ាធ្លាប់ធ្វើបែបនេះ)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/firebase-init', () => ({ initFirebase: vi.fn() }));
vi.mock('../src/services/scan-engine', async (orig) => {
    const real: any = await orig();
    return Object.assign({}, real, {
        scanEngineReady: () => true,
        decodeBarcodeFromCanvasManual: vi.fn(async () => (globalThis as any).__qrText || '')
    });
});
vi.mock('../src/platform/document-io', async (orig) => {
    const real: any = await orig();
    return Object.assign({}, real, {
        loadScratchImage: (_url: string, onLoad: (img: any) => void) => { onLoad({ naturalWidth: 3000, naturalHeight: 2000 }); return {}; },
        createScratchCanvas: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: () => {} }) })
    });
});

import { ConfigModal } from '../src/app/components/modals/ConfigModal';
import { LoginModal } from '../src/app/components/modals/LoginModal';
import { ActivationModal } from '../src/app/components/modals/ActivationModal';
import { APP_LOCK_EXCUSE_SELECTOR } from '../src/features/app-lock';
import { INTENTIONAL_UI } from '../scripts/snapshot.mjs';
import { viewState } from '../src/core/view-state';
import { securityState, uiState } from '../src/core/state';
import { fieldValue } from '../src/app/refs';
import { appLocalStore } from '../src/core/storage';
import { applySetupLinkText, openConfigModal, parseSetupLinkText, saveFirebaseConfig, selectConfigBackend } from '../src/features/config';
import { decodeConfigQrDataUrl, handleConfigQrResult } from '../src/features/config-qr';
import { clearPendingInvite, hasPendingInvite } from '../src/features/account';
import { openModalHelper } from '../src/ui/modal';
import { initFirebase } from '../src/services/firebase-init';
import { byId, mount, step, unmount } from './native/react-harness';

const SB = { supabaseUrl: 'https://abcd1234.supabase.co', supabaseKey: 'sb_publishable_' + 'k'.repeat(24) };
const FB = { apiKey: 'A', databaseURL: 'https://x.firebaseio.com', projectId: 'p' };
const enc = (o: object) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
const link = (o: object) => 'https://zoew.example/?setup=' + encodeURIComponent(enc(o));
const toastTexts = () => uiState.toasts.map((t: any) => t.msg);

beforeEach(() => {
    if (appLocalStore) appLocalStore.clear();
    clearPendingInvite();
    viewState.backendKind = 'firebase';
    viewState.configBackend = 'firebase';
    uiState.toasts = [];
    (window as any).ZoeErrors = { setDsn: vi.fn(), init: vi.fn(), getDsn: () => '', capture: vi.fn() };
    mount(<ConfigModal />);
});

afterEach(() => {
    unmount();
    delete (globalThis as any).__qrText;
});

describe('ប្រអប់ Config ៖ ជ្រើស Firebase / Supabase', () => {
    it('Firebase (លំនាំដើម) ៖ textarea បង្ហាញ · វាល Supabase លាក់ · ការជ្រើស Supabase ប្តូរ', () => {
        step(() => openConfigModal());
        expect(byId('firebaseConfigInput').className).not.toContain('hidden');
        expect(byId('sbUrlInput').closest('.cfg-supabase')!.className).toContain('hidden');
        step(() => selectConfigBackend('supabase'));
        expect(byId('firebaseConfigInput').className).toContain('hidden');
        expect(byId('sbUrlInput').closest('.cfg-supabase')!.className).not.toContain('hidden');
        const radios = Array.from(document.querySelectorAll('input[name="configBackend"]')) as HTMLInputElement[];
        expect(radios.map((r) => r.checked)).toEqual([false, true]);
    });

    it('Supabase ៖ រក្សាទុកពីវាល ➜ Config Supabase ក្នុង storage · បើកម្តងទៀតបំពេញវាលវិញ', () => {
        step(() => { openConfigModal(); selectConfigBackend('supabase'); });
        step(() => {
            (byId('sbUrlInput') as HTMLInputElement).value = SB.supabaseUrl + '/';
            (byId('sbKeyInput') as HTMLInputElement).value = SB.supabaseKey;
        });
        step(() => saveFirebaseConfig());
        expect(JSON.parse(appLocalStore!.getItem('zoew_firebase_config')!)).toEqual(SB);
        step(() => { selectConfigBackend('firebase'); (byId('sbUrlInput') as HTMLInputElement).value = ''; });
        step(() => openConfigModal());
        expect(viewState.configBackend).toBe('supabase');
        expect(fieldValue('sbUrlInput')).toBe(SB.supabaseUrl);
    });

    it('Supabase ៖ វាលទទេ ➜ សារ Supabase (មិនមែន «apiKey») · Secret key ➜ បដិសេធ', () => {
        const alerts: string[] = [];
        (window as any).alert = (m: any) => { alerts.push(String(m)); };
        step(() => { openConfigModal(); selectConfigBackend('supabase'); });
        step(() => saveFirebaseConfig());
        step(() => {
            (byId('sbUrlInput') as HTMLInputElement).value = SB.supabaseUrl;
            (byId('sbKeyInput') as HTMLInputElement).value = 'sb_secret_' + 'z'.repeat(30);
        });
        step(() => saveFirebaseConfig());
        expect(alerts[0]).toMatch(/supabaseUrl និង supabaseKey/);
        expect(alerts[1]).toMatch(/Rotate/);
        expect(appLocalStore!.getItem('zoew_firebase_config')).toBe(null);
    });

    it('ទិសផ្ទុយ ៖ Firebase ដូចមុន (textarea ➜ storage)', () => {
        step(() => openConfigModal());
        step(() => { (byId('firebaseConfigInput') as HTMLTextAreaElement).value = 'const firebaseConfig = ' + JSON.stringify(FB) + ';'; });
        step(() => saveFirebaseConfig());
        expect(JSON.parse(appLocalStore!.getItem('zoew_firebase_config')!)).toEqual(FB);
    });
});

describe('ទំនាក់ទំនងបង្កើតគណនី (Telegram @mengsroyhun) ក្នុងប្រអប់ Config', () => {
    // សំណើម្ចាស់គម្រោង (Deep audit ជុំ ៣) ៖ អ្នកដែលមិនទាន់មានគណនី/Setup Link ត្រូវឃើញផ្លូវទាក់ទងក្នុងប្រអប់ «⚙️ ភ្ជាប់ប្រព័ន្ធ»
    const contactLinks = () => Array.from(document.querySelectorAll('#configModal a[href="https://t.me/mengsroyhun"]')) as HTMLAnchorElement[];
    const visible = (el: Element) => !el.closest('.hidden');

    for (const backend of ['firebase', 'supabase'] as const) {
        it(`${backend} ៖ តំណ Telegram មួយ ឃើញ (មិននៅក្រោម .hidden) · អត្ថបទប្រាប់ «បង្កើតគណនី»`, () => {
            step(() => { openConfigModal(); selectConfigBackend(backend); });
            const links = contactLinks();
            expect(links.length).toBe(1);
            expect(visible(links[0])).toBe(true);
            expect(links[0].textContent).toBe('@mengsroyhun');
            const line = links[0].closest('p')!;
            expect(line.textContent).toMatch(/បង្កើតគណនី/);
            expect(line.textContent).toMatch(/Telegram/);
        });
    }

    it('⛔ បើកក្នុងផ្ទាំងថ្មី (noopener) ➜ ការចាកចេញទៅ Telegram ជាការចាកចេញដោយចេតនា (App lock មិនសួរ PIN ពេលត្រឡប់)', () => {
        step(() => openConfigModal());
        const a = contactLinks()[0];
        expect(a.target).toBe('_blank');
        expect(a.rel.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
        expect(a.matches(APP_LOCK_EXCUSE_SELECTOR)).toBe(true);
    });

    it('⛔ ប្រភពតែមួយ ៖ តំណក្នុង Config ដូចតំណក្នុងប្រអប់ Activation បេះបិទ', () => {
        unmount();
        mount(<><ConfigModal /><ActivationModal /></>);
        const act = document.querySelector('#activationModal a[href^="https://t.me/"]')!;
        expect(act).not.toBe(null);
        expect(contactLinks()[0].outerHTML).toBe(act.outerHTML);
    });

    it('parity ៖ បន្ទាត់ទំនាក់ទំនងជាផ្ទៃបន្ថែមដែល INTENTIONAL_UI រំលង (App ដើមគ្មាន) · ធាតុដើមនៅប្រៀបធៀប', () => {
        const line = contactLinks()[0].closest('p')!;
        expect(line.matches(INTENTIONAL_UI.skip)).toBe(true);
        expect(byId('firebaseConfigInput').matches(INTENTIONAL_UI.skip)).toBe(false);
        expect(byId('configSaveBtn').matches(INTENTIONAL_UI.skip)).toBe(false);
    });
});

describe('⛔ រក្សាទុក Config ➜ ប្រអប់ចូលប្រព័ន្ធរបស់ប្រព័ន្ធចាស់មិនលេចមួយភ្លែត', () => {
    // ម្ចាស់គម្រោងរាយការណ៍ ៖ Config ចាស់ Firebase (មិនទាន់ចូល ➜ ប្រអប់ចូលប្រព័ន្ធបើកនៅខាងក្រោម) ➜ បើក Setup Link/⚙️ ➜ រក្សាទុក
    // Config Supabase ➜ ប្រអប់ «អ៊ីមែល/User ID» លេចមួយភ្លែត (ខណៈ chunk Supabase កំពុងផ្ទុក) រួចបាត់ពេល session ស្តារ។ ប្រអប់នោះជារបស់
    // ប្រព័ន្ធចាស់ ➜ ត្រូវបិទពេលរក្សាទុក · auth របស់ប្រព័ន្ធថ្មីជាអ្នកសម្រេចបើកវាវិញ (គ្មាន session ➜ `showLoginModalWithPrefill()`)
    it('រក្សាទុក Config Supabase ពីលើប្រអប់ចូលប្រព័ន្ធ ➜ បិទទាំង ២ ភ្លាម មុន initFirebase', () => {
        vi.mocked(initFirebase).mockClear();
        let loginAtInit = '';
        vi.mocked(initFirebase).mockImplementation((() => { loginAtInit = String(uiState.modalDisplay.loginModal); return Promise.resolve(true); }) as any);
        unmount();
        mount(<><ConfigModal /><LoginModal /></>);
        step(() => openModalHelper('loginModal'));
        expect(uiState.modalDisplay.loginModal).toBe('flex');
        step(() => { openConfigModal(); selectConfigBackend('supabase'); });
        step(() => {
            (byId('sbUrlInput') as HTMLInputElement).value = SB.supabaseUrl;
            (byId('sbKeyInput') as HTMLInputElement).value = SB.supabaseKey;
        });
        step(() => saveFirebaseConfig());
        expect(initFirebase).toHaveBeenCalledTimes(1);
        expect(loginAtInit).toBe('none');
        expect(uiState.modalDisplay.loginModal).toBe('none');
        expect(uiState.modalDisplay.configModal).toBe('none');
        vi.mocked(initFirebase).mockReset();
    });

    it('ទិសផ្ទុយ ៖ Config ខុស ➜ មិនរក្សាទុក ➜ ប្រអប់ចូលប្រព័ន្ធនៅដដែល', () => {
        (window as any).alert = () => {};
        vi.mocked(initFirebase).mockClear();
        unmount();
        mount(<><ConfigModal /><LoginModal /></>);
        step(() => openModalHelper('loginModal'));
        step(() => { openConfigModal(); selectConfigBackend('supabase'); });
        step(() => saveFirebaseConfig());
        expect(initFirebase).not.toHaveBeenCalled();
        expect(uiState.modalDisplay.loginModal).toBe('flex');
    });
});

describe('Setup Link ៖ បិទភ្ជាប់ · កាមេរ៉ា · រូបភាព ➜ ផ្លូវតែមួយ', () => {
    it('បិទភ្ជាប់ Link Supabase (+ invite + dsn) ➜ វាល Supabase · invite ចងចាំ · dsn ចូលវាល Sentry', () => {
        step(() => openConfigModal());
        step(() => { applySetupLinkText(link(Object.assign({ invite: 'INV-CODE-1', dsn: 'https://k@o1.ingest.sentry.io/2' }, SB))); });
        expect(viewState.configBackend).toBe('supabase');
        expect(fieldValue('sbUrlInput')).toBe(SB.supabaseUrl);
        expect(hasPendingInvite()).toBe(true);
        expect(fieldValue('sentryDsnInput')).toBe('https://k@o1.ingest.sentry.io/2');
        expect(fieldValue('setupLinkInput')).toBe('');
    });

    it('⛔ កាមេរ៉ា ៖ invite មិនត្រូវបាត់ (មិនដាក់ក្នុង textarea)', () => {
        step(() => { openConfigModal(); securityState.configQrScanActive = true; });
        step(() => handleConfigQrResult(link(Object.assign({ invite: 'INV-CODE-2' }, SB))));
        expect(hasPendingInvite()).toBe(true);
        expect(fieldValue('firebaseConfigInput')).not.toContain('INV-CODE-2');
        expect(viewState.configBackend).toBe('supabase');
    });

    it('QR ពីរូបភាព ៖ Link Firebase ➜ textarea · QR មិនមែន Link ➜ សារ · គ្មាន QR ➜ សារ', () => {
        step(() => openConfigModal());
        (globalThis as any).__qrText = link(FB);
        return new Promise<void>((resolve) => {
            step(() => decodeConfigQrDataUrl('data:image/png;base64,AAAA'));
            setTimeout(() => {
                step(() => {});
                expect(JSON.parse(fieldValue('firebaseConfigInput'))).toEqual(FB);
                expect(viewState.configBackend).toBe('firebase');
                expect(toastTexts().some((t) => /QR ពីរូបភាពជោគជ័យ/.test(t))).toBe(true);
                (globalThis as any).__qrText = 'hello';
                step(() => decodeConfigQrDataUrl('data:image/png;base64,AAAA'));
                setTimeout(() => {
                    (globalThis as any).__qrText = '';
                    step(() => decodeConfigQrDataUrl('data:image/png;base64,AAAA'));
                    setTimeout(() => {
                        step(() => {});
                        expect(toastTexts().some((t) => /មិនមែនជា Setup Link/.test(t))).toBe(true);
                        expect(toastTexts().some((t) => /រកមិនឃើញ QR/.test(t))).toBe(true);
                        resolve();
                    }, 0);
                }, 0);
            }, 0);
        });
    });

    it('parseSetupLinkText ៖ URL · payload ទទេៗ · មិនមែន Link · payload ខូច', () => {
        expect((parseSetupLinkText(link(SB)) as any).parsed.supabaseUrl).toBe(SB.supabaseUrl);
        expect((parseSetupLinkText(enc(FB)) as any).parsed.apiKey).toBe('A');
        expect(parseSetupLinkText('hello')).toEqual({ error: 'not-link' });
        expect(parseSetupLinkText('https://x.example/?setup=' + enc({ nope: 1 }))).toEqual({ error: 'bad' });
    });

    it('⛔ អត្ថបទមាន % ខូច ➜ សារ «មិនត្រឹមត្រូវ» (មិនបោះ URIError ចេញពី handler)', () => {
        for (const bad of ['%'.repeat(20), 'setup=%E0%A4%A' + 'A'.repeat(20), 'AAAAAAAAAAAAAAAA%zz']) {
            expect(() => parseSetupLinkText(bad)).not.toThrow();
            expect((parseSetupLinkText(bad) as any).parsed).toBeUndefined();
        }
        step(() => openConfigModal());
        uiState.toasts = [];
        let ok: any;
        expect(() => { ok = applySetupLinkText('%'.repeat(20)); }).not.toThrow();
        expect(ok).toBe(false);
        expect(toastTexts().some((t) => /Setup Link មិនត្រឹមត្រូវ/.test(t))).toBe(true);
    });

    it('⛔ QR ពីរូបភាព ២ ជាន់គ្នា ៖ រូបចាស់ដែលឌិកូដចប់ក្រោយ មិនសរសេរជាន់រូបថ្មី · បិទប្រអប់ ➜ គ្មានសារ', async () => {
        const scan: any = await import('../src/services/scan-engine');
        const release: Array<() => void> = [];
        const texts = [link(Object.assign({}, FB, { apiKey: 'OLD' })), link(Object.assign({}, FB, { apiKey: 'NEW' }))];
        scan.decodeBarcodeFromCanvasManual.mockImplementation(() => {
            const text = texts[release.length];
            return new Promise((resolve) => { release.push(() => resolve(text)); });
        });
        try {
            step(() => openConfigModal());
            step(() => decodeConfigQrDataUrl('data:image/png;base64,AAAA'));
            step(() => decodeConfigQrDataUrl('data:image/png;base64,BBBB'));
            release[1]();
            await new Promise((r) => setTimeout(r, 0));
            release[0]();
            await new Promise((r) => setTimeout(r, 0));
            step(() => {});
            expect(JSON.parse(fieldValue('firebaseConfigInput')).apiKey).toBe('NEW');
            uiState.toasts = [];
            step(() => decodeConfigQrDataUrl('data:image/png;base64,CCCC'));
            step(() => { uiState.modalDisplay = Object.assign({}, uiState.modalDisplay, { configModal: false }); });
            texts.push('');
            release[2]();
            await new Promise((r) => setTimeout(r, 0));
            expect(toastTexts()).toEqual([]);
        } finally {
            scan.decodeBarcodeFromCanvasManual.mockImplementation(async () => (globalThis as any).__qrText || '');
        }
    });
});
