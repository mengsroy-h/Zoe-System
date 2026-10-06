/**
 * ⛔ ប្រអប់ «⚙️ ភ្ជាប់ប្រព័ន្ធ» (សំណើម្ចាស់គម្រោង) ៖ ជ្រើស Firebase/Supabase · វាល Supabase · បិទភ្ជាប់ Setup Link · QR ពីរូបភាព។
 * ⛔ ផ្លូវ Setup Link ទាំង ៤ (URL `?setup=` · កាមេរ៉ា · រូបភាព · បិទភ្ជាប់) ឆ្លង `applySetupPayload()` តែមួយ ➜ `invite` ត្រូវចងចាំ
 *    ហើយ `dsn` ចូលវាល Sentry — ⛔ មិនមែនដាក់ក្នុង textarea (ពេលរក្សាទុក `normalizeFirebaseConfig()` បោះវាលក្រៅបញ្ជីចោល ➜
 *    កូដអញ្ជើញបាត់ ៖ ផ្លូវកាមេរ៉ាធ្លាប់ធ្វើបែបនេះ)។
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { applySetupLinkFromUrl, applySetupLinkText, openConfigModal, parseSetupLinkText, saveFirebaseConfig, selectConfigBackend, toggleConfigManual } from '../src/features/config';
import { decodeConfigQrDataUrl, handleConfigQrResult } from '../src/features/config-qr';
import { clearPendingInvite, hasPendingInvite } from '../src/features/account';
import { openModalHelper } from '../src/ui/modal';
import { initFirebase } from '../src/services/firebase-init';
import { clearSensitiveModalFields } from '../src/features/session';
import { closeModal } from '../src/ui/modal';
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
    (window as any).alert = vi.fn();
    vi.mocked(initFirebase).mockReset();
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

    it('parity ៖ ខ្លឹមសារប្រអប់ Config ទាំងមូលជាផ្ទៃរចនាឡើងវិញ (INTENTIONAL_UI រំលង) · ប្រអប់ខ្លួនវា និងប្រអប់ផ្សេងនៅប្រៀបធៀប', () => {
        expect(document.querySelector('#configModal .modal-content')!.matches(INTENTIONAL_UI.skip)).toBe(true);
        expect(byId('configModal').matches(INTENTIONAL_UI.skip)).toBe(false);
        unmount();
        mount(<><ConfigModal /><ActivationModal /></>);
        expect(document.querySelector('#activationModal .modal-content')!.matches(INTENTIONAL_UI.skip)).toBe(false);
    });
});

describe('ពណ៌ + logo តាម backend (សំណើម្ចាស់គម្រោង)', () => {
    const css = readFileSync(resolve(__dirname, '..', 'src', 'styles', 'react-root.css'), 'utf8');
    const rule = (sel: string) => {
        const at = css.indexOf(sel + ' {');
        return at === -1 ? '' : css.slice(at, css.indexOf('}', at));
    };

    it('ជម្រើសនីមួយៗមាន logo របស់ខ្លួន (SVG ក្នុងកូដ · aria-hidden · គ្មានធនធានខាងក្រៅ) · is-on ប្តូរតាមការជ្រើស', () => {
        step(() => openConfigModal());
        const fb = document.querySelector('#configModal .cfg-choice-item.cfg-fb')!;
        const sb = document.querySelector('#configModal .cfg-choice-item.cfg-sb')!;
        for (const [chip, name] of [[fb, 'Firebase'], [sb, 'Supabase']] as const) {
            const mark = chip.querySelector('svg.cfg-mark')!;
            expect(mark).not.toBeNull();
            expect(mark.getAttribute('aria-hidden')).toBe('true');
            expect(mark.querySelector('path')!.getAttribute('d')!.length).toBeGreaterThan(40);
            expect(chip.innerHTML).not.toMatch(/https?:\/\//);
            expect(chip.textContent!.trim()).toBe(name);
        }
        expect(fb.className).toContain('is-on');
        expect(sb.className).not.toContain('is-on');
        step(() => selectConfigBackend('supabase'));
        expect(fb.className).not.toContain('is-on');
        expect(sb.className).toContain('is-on');
    });

    it('CSS ៖ Firebase = ពណ៌លឿង/ទឹកក្រូច · Supabase = ពណ៌បៃតង លើជម្រើស · ប៊ូតុងរក្សាទុក · ខ្សែលើប្រអប់ (តាម :has ➜ DOM parity មិនប្រែ)', () => {
        expect(rule('#configModal .cfg-choice-item.cfg-fb.is-on')).toMatch(/border-color:\s*#FFA000/i);
        expect(rule('#configModal .cfg-choice-item.cfg-sb.is-on')).toMatch(/border-color:\s*#3ECF8E/i);
        expect(rule('#configModal:has(.cfg-fb.is-on) #configSaveBtn')).toMatch(/background-color:\s*#FFCA28/i);
        expect(rule('#configModal:has(.cfg-sb.is-on) #configSaveBtn')).toMatch(/background-color:\s*#3ECF8E/i);
        expect(rule('#configModal:has(.cfg-manual:not(.hidden) .cfg-fb.is-on) .modal-content,\n#configModal:has(.cfg-link-card.cfg-fb) .modal-content')).toMatch(/inset 0 4px 0 #FFA000/i);
        expect(rule('#configModal:has(.cfg-manual:not(.hidden) .cfg-sb.is-on) .modal-content,\n#configModal:has(.cfg-link-card.cfg-sb) .modal-content')).toMatch(/inset 0 4px 0 #3ECF8E/i);
        expect(byId('configSaveBtn').closest('#configManualSection')).not.toBeNull();
    });

    it('⛔ 🔘 គ្មានស្រមោលការ៉េ ៖ radio/switch លាក់ដោយ CSS (មិនទទួល box-shadow របស់វាលអក្សរ) · រង្វង់ផ្តោតលើស្លាកពេលប្រើក្តារចុច', () => {
        const hide = rule('#configModal .cfg-manual-toggle input,\n#configModal .cfg-choice-item input');
        expect(hide).toMatch(/opacity:\s*0/);
        expect(hide).toMatch(/box-shadow:\s*none/);
        expect(hide).toMatch(/pointer-events:\s*none/);
        expect(rule('#configModal .cfg-manual-toggle:has(input:focus-visible) .cfg-switch,\n#configModal .cfg-choice-item:has(input:focus-visible)')).toMatch(/outline:\s*2px solid/);
        step(() => openConfigModal());
        for (const input of Array.from(document.querySelectorAll('#configModal input[type="radio"], #configModal input[type="checkbox"]'))) {
            expect(input.closest('.cfg-choice-item, .cfg-manual-toggle'), (input as HTMLInputElement).name || input.id).not.toBeNull();
        }
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

describe('Setup Link ៖ បិទភ្ជាប់ · កាមេរ៉ា · រូបភាព ➜ ផ្លូវតែមួយ ➜ ភ្ជាប់ភ្លាម (សំណើម្ចាស់គម្រោង)', () => {
    const stored = () => JSON.parse(appLocalStore!.getItem('zoew_firebase_config') || 'null');

    it('បិទភ្ជាប់ Link Supabase (+ invite + dsn) ➜ រក្សាទុក + ភ្ជាប់ភ្លាម · invite ចងចាំ · dsn ចូលវាល Sentry · ប្រអប់បិទ', () => {
        step(() => openConfigModal());
        let ok: any;
        step(() => { ok = applySetupLinkText(link(Object.assign({ invite: 'INV-CODE-1', dsn: 'https://k@o1.ingest.sentry.io/2' }, SB))); });
        expect(ok).toBe(true);
        expect(stored()).toEqual(SB);
        expect(initFirebase).toHaveBeenCalledTimes(1);
        expect(uiState.modalDisplay.configModal).toBe('none');
        expect(viewState.configBackend).toBe('supabase');
        expect(hasPendingInvite()).toBe(true);
        expect(fieldValue('sentryDsnInput')).toBe('https://k@o1.ingest.sentry.io/2');
        expect(fieldValue('setupLinkInput')).toBe('');
        expect(toastTexts()).toContain('✅ Setup Link ត្រឹមត្រូវ ➜ បានរក្សាទុក Config ៖ abcd1234.supabase.co');
    });

    it('⛔ កាមេរ៉ា ៖ ភ្ជាប់ភ្លាម · invite មិនត្រូវបាត់ (មិនដាក់ក្នុង textarea)', () => {
        step(() => { openConfigModal(); securityState.configQrScanActive = true; });
        step(() => handleConfigQrResult(link(Object.assign({ invite: 'INV-CODE-2' }, SB))));
        expect(hasPendingInvite()).toBe(true);
        expect(fieldValue('firebaseConfigInput')).not.toContain('INV-CODE-2');
        expect(viewState.configBackend).toBe('supabase');
        expect(stored()).toEqual(SB);
        expect(initFirebase).toHaveBeenCalledTimes(1);
        expect(toastTexts()).toContain('✅ QR ត្រឹមត្រូវ ➜ បានរក្សាទុក Config ៖ abcd1234.supabase.co');
    });

    it('QR ពីរូបភាព ៖ Link Firebase ➜ ភ្ជាប់ភ្លាម · QR មិនមែន Link ➜ សារ · គ្មាន QR ➜ សារ (មិនរក្សាទុក)', async () => {
        step(() => openConfigModal());
        (globalThis as any).__qrText = link(FB);
        step(() => decodeConfigQrDataUrl('data:image/png;base64,AAAA'));
        await new Promise((r) => setTimeout(r, 0));
        step(() => {});
        expect(stored()).toEqual(FB);
        expect(viewState.configBackend).toBe('firebase');
        expect(toastTexts()).toContain('✅ QR ពីរូបភាព ត្រឹមត្រូវ ➜ បានរក្សាទុក Config ៖ x.firebaseio.com');
        appLocalStore!.clear();
        vi.mocked(initFirebase).mockClear();
        step(() => openConfigModal());
        (globalThis as any).__qrText = 'hello';
        step(() => decodeConfigQrDataUrl('data:image/png;base64,AAAA'));
        await new Promise((r) => setTimeout(r, 0));
        (globalThis as any).__qrText = '';
        step(() => decodeConfigQrDataUrl('data:image/png;base64,AAAA'));
        await new Promise((r) => setTimeout(r, 0));
        step(() => {});
        expect(toastTexts().some((t) => /មិនមែនជា Setup Link/.test(t))).toBe(true);
        expect(toastTexts().some((t) => /រកមិនឃើញ QR/.test(t))).toBe(true);
        expect(stored()).toBe(null);
        expect(initFirebase).not.toHaveBeenCalled();
    });

    it('⛔ Link ដែល Config ខុស (Secret key) ➜ មិនរក្សាទុក · មិនប្រកាស ✅ · បើកផ្នែកបំពេញដោយដៃឲ្យឃើញវាល', () => {
        step(() => openConfigModal());
        let ok: any;
        step(() => { ok = applySetupLinkText(link({ supabaseUrl: SB.supabaseUrl, supabaseKey: 'sb_secret_' + 'z'.repeat(30) })); });
        expect(ok).toBe(false);
        expect(stored()).toBe(null);
        expect(initFirebase).not.toHaveBeenCalled();
        expect((window as any).alert).toHaveBeenCalled();
        expect(toastTexts().some((t) => t.startsWith('✅'))).toBe(false);
        expect(viewState.configManual).toBe(true);
        expect(byId('configManualSection').className).not.toContain('hidden');
        expect(uiState.modalDisplay.configModal).toBe('flex');
    });

    it('⛔ Setup Link ពី URL (បើកពីខាងក្រៅ) ➜ មិនរក្សាទុកស្វ័យប្រវត្តិ ៖ កាតបង្ហាញ Server គោលដៅ ➜ ចុច «✅ ភ្ជាប់» ទើបភ្ជាប់', () => {
        const before = window.location.href;
        (window as any).happyDOM.setURL(new URL('/?setup=' + encodeURIComponent(enc(Object.assign({ invite: 'INV-CODE-3' }, SB))), before).href);
        expect(window.location.search).toContain('setup=');
        try {
            step(() => applySetupLinkFromUrl());
            expect(window.location.search).toBe('');
            expect(typeof securityState.pinTargetAction).toBe('function');
            expect(document.getElementById('configLinkCard')).toBe(null);
            step(() => (securityState.pinTargetAction as any)());
            expect(stored()).toBe(null);
            expect(initFirebase).not.toHaveBeenCalled();
            const card = byId('configLinkCard');
            expect(card.textContent).toContain('Supabase');
            expect(card.textContent).toContain('abcd1234.supabase.co');
            expect(card.textContent).toContain('កូដអញ្ជើញ');
            expect(byId('configManualSection').className).toContain('hidden');
            step(() => (byId('configLinkConnectBtn') as HTMLButtonElement).click());
            expect(stored()).toEqual(SB);
            expect(initFirebase).toHaveBeenCalledTimes(1);
            expect(hasPendingInvite()).toBe(true);
            expect(viewState.configPendingLink).toBe(null);
        } finally {
            (window as any).happyDOM.setURL(before);
        }
    });

    it('ប្រអប់បើកថ្មី ៖ មានតែ ស្កេន QR · QR ពីរូបភាព · Setup Link · switch «ដោយដៃ» ➜ ចុច switch ➜ ជម្រើស Server + វាល + ប៊ូតុងរក្សាទុក', () => {
        step(() => { viewState.configManual = true; viewState.configPendingLink = { backend: 'firebase', host: 'x', invite: false, official: true, dsn: false }; });
        step(() => openConfigModal());
        expect(viewState.configManual).toBe(false);
        expect(document.getElementById('configLinkCard')).toBe(null);
        const visible = (el: Element) => !el.closest('.hidden');
        for (const id of ['setupLinkInput', 'setupLinkApplyBtn', 'configManualToggle']) expect(visible(byId(id)), id).toBe(true);
        expect(visible(document.querySelector('#configModal .cfg-scan-btn')!)).toBe(true);
        expect(visible(document.querySelector('#configModal .cfg-image-btn')!)).toBe(true);
        for (const id of ['firebaseConfigInput', 'sbUrlInput', 'sentryDsnInput', 'configSaveBtn']) expect(visible(byId(id)), id).toBe(false);
        expect((byId('configManualToggle') as HTMLInputElement).checked).toBe(false);
        step(() => (byId('configManualToggle') as HTMLInputElement).click());
        expect(viewState.configManual).toBe(true);
        expect((byId('configManualToggle') as HTMLInputElement).checked).toBe(true);
        for (const id of ['firebaseConfigInput', 'sentryDsnInput', 'configSaveBtn']) expect(visible(byId(id)), id).toBe(true);
        step(() => toggleConfigManual());
        expect(visible(byId('configSaveBtn'))).toBe(false);
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
            expect(JSON.parse(appLocalStore!.getItem('zoew_firebase_config')!).apiKey).toBe('NEW');
            expect(JSON.parse(fieldValue('firebaseConfigInput')).apiKey).toBe('NEW');
            expect(initFirebase).toHaveBeenCalledTimes(1);
            uiState.toasts = [];
            step(() => openConfigModal());
            step(() => decodeConfigQrDataUrl('data:image/png;base64,CCCC'));
            step(() => { uiState.modalDisplay = Object.assign({}, uiState.modalDisplay, { configModal: false }); });
            texts.push('');
            release[2]();
            await new Promise((r) => setTimeout(r, 0));
            expect(toastTexts()).toEqual([]);
            expect(initFirebase).toHaveBeenCalledTimes(1);
        } finally {
            scan.decodeBarcodeFromCanvasManual.mockImplementation(async () => (globalThis as any).__qrText || '');
        }
    });
});

describe('កាត Setup Link ពី URL ៖ ចងនឹង Link ខ្លួនឯង · host ពេញ · DSN តែពេលចុច (review 2.49.6)', () => {
    const stored = () => JSON.parse(appLocalStore!.getItem('zoew_firebase_config') || 'null');
    const openFromUrl = (payload: object) => {
        const before = window.location.href;
        (window as any).happyDOM.setURL(new URL('/?setup=' + encodeURIComponent(enc(payload)), before).href);
        try {
            step(() => applySetupLinkFromUrl());
            step(() => (securityState.pinTargetAction as any)());
        } finally {
            (window as any).happyDOM.setURL(before);
        }
    };

    it('⛔ «✅ ភ្ជាប់» ភ្ជាប់ Server ដែលកាតបង្ហាញ ទោះអ្នកប្រើប្តូរជម្រើស Server ក្នុងផ្នែកដោយដៃ', () => {
        appLocalStore!.setItem('zoew_firebase_config', JSON.stringify(SB));
        openFromUrl(FB);
        expect(byId('configLinkCard').textContent).toContain('x.firebaseio.com');
        step(() => { toggleConfigManual(); selectConfigBackend('supabase'); });
        step(() => (byId('configLinkConnectBtn') as HTMLButtonElement).click());
        expect(stored()).toEqual(FB);
        expect(initFirebase).toHaveBeenCalledTimes(1);
        expect(viewState.configPendingLink).toBe(null);
    });

    it('⛔ Link ផ្សេងចូលក្នុងប្រអប់ (ខូច) ➜ កាតចាស់បាត់ (មិនបង្ហាញ Server ដែលវាលលែងមាន)', () => {
        openFromUrl(FB);
        expect(document.getElementById('configLinkCard')).not.toBe(null);
        step(() => { applySetupLinkText(link({ supabaseUrl: SB.supabaseUrl, supabaseKey: 'sb_secret_' + 'z'.repeat(30) })); });
        expect(stored()).toBe(null);
        expect(document.getElementById('configLinkCard')).toBe(null);
        expect(viewState.configPendingLink).toBe(null);
        expect(viewState.configManual).toBe(true);
    });

    it('⛔ host វែង ➜ កាតបង្ហាញ host ពេញ (domain ចុងក្រោយមិនបាត់) · host ក្រៅ domain ផ្លូវការ ➜ ព្រមាន', () => {
        const longUrl = 'https://zoewshop12abcdefghijk.supabase.co.' + 'x'.repeat(50) + '.attacker-sb.net';
        openFromUrl({ supabaseUrl: longUrl, supabaseKey: SB.supabaseKey });
        const card = byId('configLinkCard');
        expect(card.textContent).toContain(new URL(longUrl).host);
        expect(card.textContent).toContain('attacker-sb.net');
        expect(document.getElementById('configLinkWarn')).not.toBe(null);
        step(() => closeModal('configModal'));
        openFromUrl(SB);
        expect(byId('configLinkCard').textContent).toContain('abcd1234.supabase.co');
        expect(document.getElementById('configLinkWarn')).toBe(null);
        step(() => closeModal('configModal'));
        for (const db of ['https://x.firebaseio.com', 'https://x-default-rtdb.asia-southeast1.firebasedatabase.app']) {
            openFromUrl(Object.assign({}, FB, { databaseURL: db }));
            expect(document.getElementById('configLinkWarn'), db).toBe(null);
            step(() => closeModal('configModal'));
        }
        openFromUrl(Object.assign({}, FB, { databaseURL: 'https://x.firebaseio.com.evil.example' }));
        expect(document.getElementById('configLinkWarn')).not.toBe(null);
    });

    it('⛔ DSN Sentry ក្នុង Link URL ៖ មិនអនុវត្តមុនចុច «✅ ភ្ជាប់» · បោះបង់ ➜ មិនអនុវត្ត · កាតប្រាប់ថាមាន DSN', () => {
        const dsn = 'https://k@o1.ingest.sentry.io/9';
        const setDsn = (window as any).ZoeErrors.setDsn;
        openFromUrl(Object.assign({ dsn }, SB));
        expect(setDsn).not.toHaveBeenCalled();
        expect(fieldValue('sentryDsnInput')).toBe(dsn);
        expect(byId('configLinkCard').textContent).toContain('Sentry');
        step(() => closeModal('configModal'));
        expect(setDsn).not.toHaveBeenCalled();
        expect(stored()).toBe(null);
        openFromUrl(Object.assign({ dsn }, SB));
        step(() => (byId('configLinkConnectBtn') as HTMLButtonElement).click());
        expect(setDsn).toHaveBeenCalledWith(dsn);
        expect(stored()).toEqual(SB);
    });

    it('logo ក្នុងកាត + ផ្នែកដោយដៃ ៖ id gradient SVG មិនស្ទួន · រាល់ fill="url(#…)" យោង gradient ដែលមានពិត', () => {
        openFromUrl(SB);
        const ids = Array.from(document.querySelectorAll('#configModal linearGradient')).map((g) => g.id);
        expect(ids.length).toBeGreaterThanOrEqual(3);
        expect(new Set(ids).size).toBe(ids.length);
        const refs = Array.from(document.querySelectorAll('#configModal path[fill^="url(#"]')).map((el) => el.getAttribute('fill')!.slice(5, -1));
        expect(refs.length).toBe(ids.length);
        for (const ref of refs) expect(ids).toContain(ref);
    });

    it('⛔ ចាកចេញ (clearSensitiveModalFields) ➜ កាត Link ដែលមិនទាន់ចុច និង switch ដោយដៃត្រូវសម្អាត', () => {
        openFromUrl(FB);
        step(() => toggleConfigManual());
        expect(viewState.configPendingLink).not.toBe(null);
        step(() => clearSensitiveModalFields());
        expect(viewState.configPendingLink).toBe(null);
        expect(viewState.configManual).toBe(false);
    });

    it('⛔ QR ពីរូបភាព ២ ជាន់គ្នា (លំដាប់បញ្ច្រាស) ៖ រូបចាស់ឌិកូដចប់មុន ខណៈរូបថ្មីនៅរង់ចាំ ➜ មិនរក្សាទុក · រូបថ្មីទើបភ្ជាប់', async () => {
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
            release[0]();
            await new Promise((r) => setTimeout(r, 0));
            step(() => {});
            expect(stored()).toBe(null);
            expect(initFirebase).not.toHaveBeenCalled();
            expect(uiState.modalDisplay.configModal).toBe('flex');
            release[1]();
            await new Promise((r) => setTimeout(r, 0));
            step(() => {});
            expect(stored().apiKey).toBe('NEW');
            expect(initFirebase).toHaveBeenCalledTimes(1);
        } finally {
            scan.decodeBarcodeFromCanvasManual.mockImplementation(async () => (globalThis as any).__qrText || '');
        }
    });

    it('CSS ៖ រង្វង់ផ្តោតក្តារចុចលើ switch/ជម្រើស Server មានផ្លូវបម្រុងដោយគ្មាន :has() (WebView ចាស់)', () => {
        const css = readFileSync(resolve(__dirname, '..', 'src', 'styles', 'react-root.css'), 'utf8');
        const at = css.indexOf('@supports not selector(:has(*))');
        expect(at).toBeGreaterThan(-1);
        const block = css.slice(at, css.indexOf('}\n}', at) + 3);
        const selector = block.slice(block.indexOf('{') + 1, block.indexOf('{', block.indexOf('{') + 1));
        expect(selector).toContain('#configModal .cfg-manual-toggle input:focus-visible + .cfg-switch');
        expect(selector).toContain('#configModal .cfg-choice-item input:focus-visible + .cfg-mark');
        expect(selector).not.toContain(':has(');
        expect(block).toMatch(/outline:\s*2px solid/);
    });
});
