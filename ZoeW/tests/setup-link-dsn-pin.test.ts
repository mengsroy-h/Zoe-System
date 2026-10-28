// X3 (deep audit 8) · ការសម្រេចម្ចាស់ (A403 ៖ «ដកប្រអប់ DSN ចេញទាំងអស់») ៖ កំហុសទៅតែគម្រោង Sentry របស់ App (`APP_DSN` ក្នុង
// `error-reporting.js` ដូចគ្នាទាំង ២ App)។ Setup Link មកពីអ្នកណាក៏បាន ➜ DSN ណាមួយក្នុង Link ឬវាលដែលរក្សាទុកលើឧបករណ៍ = ផ្លូវបញ្ជូន
// event (barcode · id · path) ទៅគម្រោងអ្នកដទៃ ➜ គ្មានវាល DSN · គ្មាន storage DSN · គ្មាន `dsn` ក្នុង Setup Link (ZoeW · ZoeKeyGen ·
// tools/firebase-provision) · Link ចាស់ដែលមាន `dsn` ➜ ZoeW ទម្លាក់វាពេល decode។
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeSetupPayload } from '../src/features/config';

const read = (file: string) => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const SOURCES = {
    zoewReporting: '../public/error-reporting.js', keygenReporting: '../../ZoeKeyGen/error-reporting.js',
    zoewPage: '../index.html', keygenPage: '../../ZoeKeyGen/index.html', keygenApp: '../../ZoeKeyGen/app.js',
    zoewConfig: '../src/features/config.ts', zoewModal: '../src/app/components/modals/ConfigModal.tsx',
    provision: '../../tools/firebase-provision/provision.js'
};

describe('Sentry ៖ DSN របស់ App តែមួយ', () => {
    it('error-reporting.js ដូចគ្នាទាំង ២ App · `APP_DSN` ជា DSN តែមួយ · គ្មាន API ឬ storage សម្រាប់ប្តូរ DSN', () => {
        const zoew = read(SOURCES.zoewReporting);
        expect(read(SOURCES.keygenReporting)).toBe(zoew);
        expect(zoew).toMatch(/const APP_DSN = 'https:\/\/[0-9a-f]{32}@o[0-9]+\.ingest\.(?:us\.)?sentry\.io\/[0-9]+';/);
        expect(zoew).toMatch(/options\.dsn = APP_DSN;/);
        expect(zoew).not.toMatch(/setDsn|getDsn|sentry_dsn|localStorage/);
        expect(zoew).toMatch(/global\.ZoeErrors = \{ init: init, capture: capture, redactUrl: redactUrl, redactEvent: redactEvent \};/);
    });

    it('គ្មានវាល DSN ក្នុងទំព័រ ឬប្រអប់ · គ្មាន Sentry Loader · គ្មាន DSN ក្នុងអ្នកបង្កើត Setup Link', () => {
        for (const page of [SOURCES.zoewPage, SOURCES.keygenPage]) expect(read(page)).not.toContain('js.sentry-cdn.com');
        for (const file of [SOURCES.zoewPage, SOURCES.keygenPage, SOURCES.keygenApp, SOURCES.zoewConfig, SOURCES.zoewModal, SOURCES.provision]) {
            expect(read(file), file).not.toMatch(/sentryDsnInput|setupLinkDsnInput|setupLinkDsnIsValid|sentryDsnIsValid|SETUP_LINK_SENTRY_KEY|sentry-dsn/);
        }
        expect(read(SOURCES.provision)).toMatch(/function buildSetupLink\(appUrl, config\) \{/);
    });

    it('Setup Link ចាស់ដែលមាន `dsn` ៖ ZoeW ទម្លាក់វាពេល decode · Config នៅដដែល', () => {
        const link = (o: object) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
        const firebase = { apiKey: 'k', databaseURL: 'https://shop.firebaseio.com' };
        const supabase = { supabaseUrl: 'https://abcd1234.supabase.co', supabaseKey: 'sb_publishable_' + 'k'.repeat(24), invite: 'INV-1' };
        for (const config of [firebase, supabase]) {
            expect(decodeSetupPayload(link({ ...config, dsn: 'https://ffffffffffffffffffffffffffffffff@o9.ingest.sentry.io/1' }))).toEqual(config);
        }
    });
});
