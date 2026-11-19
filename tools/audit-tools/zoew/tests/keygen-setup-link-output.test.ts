import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { parse } from 'acorn';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(resolve(process.env.KEYGEN_SETUP_SOURCE_ROOT || resolve(__dirname, '../../../..'), 'ZoeKeyGen/app.js'), 'utf8');
const ast: any = parse(source, { ecmaVersion: 'latest' });
const names = new Set(['generateSetupLink', 'generateLookupSetupLink', 'sbInviteSetupLink', 'sbInputValue', 'sbAdminConfigProblem', 'sbAdminJwtRole',
    'readNormalizedFirebaseConfig', 'normalizeFirebaseConfig', 'firebaseConfigErrorMessage', 'stripJsCommentsOutsideStrings', 'extractFirebaseConfigObject', 'firebaseObjectTextToJson',
    'invalidateSensitiveSession', 'clearSecureKeySetup', 'copySetupLink', 'copySensitiveText', 'saveSetupLinkQr', 'saveQrImage']);
const functions = ast.body.filter((n: any) => n.type === 'FunctionDeclaration' && (names.has(n.id.name) || /^(lookupSetup|encryptSetupLookup)/.test(n.id.name)));
const keys = ast.body.find((n: any) => n.type === 'VariableDeclaration' && n.declarations.some((d: any) => d.id.name === 'FIREBASE_CONFIG_KEYS'));
const extracted = [source.slice(keys.start, keys.end), ...functions.map((n: any) => source.slice(n.start, n.end))].join('\n');
const config = { apiKey: 'synthetic-api-key', databaseURL: 'https://synthetic-shop.firebaseio.com' };
const tenantSession = { url: 'https://synthetic-shop.supabase.co', key: 'sb_publishable_synthetic' };
const payloadOf = (link: string) => JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(new URL(link).hash.slice('#setup='.length))))));

function harness() {
    const elements = new Map<string, HTMLElement>();
    const element = (id: string): any => {
        if (!elements.has(id)) {
            const node: any = document.createElement(id.endsWith('Input') ? 'input' : 'div');
            node.value = '';
            node.checked = false;
            elements.set(id, node);
        }
        return elements.get(id);
    };
    const stored = new Map<string, string>();
    const copied: string[] = [];
    const saved: string[] = [];
    const ctx: any = {
        URL, btoa, atob, TextEncoder, Uint8Array, Uint32Array, crypto: webcrypto,
        document: { getElementById: element }, window: {},
        lookupSetupGeneration: 0, sensitiveSessionGeneration: 1, lastGeneratedSetupLink: '',
        SETUP_LINK_URL_KEY: 'base', appLocalStore: {}, secureKeySetup: null,
        safeStoreGet: (_store: unknown, key: string) => stored.get(key),
        safeStoreSet: (_store: unknown, key: string, value: string) => { stored.set(key, value); return true; },
        captureSensitiveSession: () => ({ generation: ctx.sensitiveSessionGeneration }),
        isSensitiveSessionCurrent: (session: any) => session.generation === ctx.sensitiveSessionGeneration,
        sbAdminIsCurrent: (session: any) => session === ctx.sbAdminSession,
        sbAdminSession: null, sbTenantCache: [],
        navigator: { clipboard: { writeText: vi.fn(async (text: string) => { copied.push(text); }) } },
        renderQrInto: (node: HTMLElement, link: string) => { node.innerHTML = '<svg></svg>'; node.dataset.link = link; return true; },
        downloadQrPng: vi.fn((text: string) => { saved.push(text); return true; }),
        alert: vi.fn(), showToast: vi.fn()
    };
    runInNewContext(extracted, ctx);
    element('setupLinkUrlInput').value = 'https://zoew.example/app/#settings';
    element('setupLinkConfigInput').value = JSON.stringify(config);
    element('setupLinkResultBox').classList.add('hidden');
    element('setupLinkQrSaveBtn').classList.add('hidden');
    return { ctx, element, stored, copied, saved };
}

function expectCleared(h: ReturnType<typeof harness>) {
    expect(h.ctx.lastGeneratedSetupLink).toBe('');
    expect(h.element('setupLinkResultText').textContent).toBe('');
    expect(h.element('setupLinkQrContainer').innerHTML).toBe('');
    expect(h.element('setupLookupCodeOutput').textContent).toBe('');
    expect(h.element('setupLinkResultBox').classList.contains('hidden')).toBe(true);
    expect(h.element('setupLinkQrSaveBtn').classList.contains('hidden')).toBe(true);
}

const bases = [
    ['https://zoew.example/#settings', 'https://zoew.example/'],
    ['https://zoew.example/customer/app/?view=settings#settings', 'https://zoew.example/customer/app/'],
    ['https://zoew.example/customer/index.html#settings', 'https://zoew.example/customer/index.html']
];

describe('Setup Link ៖ ទីតាំង App និងលទ្ធផលបច្ចុប្បន្ន', () => {
    it.each(bases)('Link ធម្មតារក្សា path និងជំនួស fragment %s', (input, base) => {
        const h = harness();
        h.element('setupLinkUrlInput').value = input;
        h.ctx.generateSetupLink();
        const link = h.ctx.lastGeneratedSetupLink;
        expect(link.startsWith(base + '#setup=')).toBe(true);
        expect(new URL(link).search).toBe('');
        expect(payloadOf(link)).toEqual(config);
        expect(h.stored.get('base')).toBe(base);
        expect(h.element('setupLinkQrContainer').dataset.link).toBe(link);
    });

    for (const location of ['stored', 'input']) {
        it.each(bases)(`Link អញ្ជើញ Supabase ពី ${location} រក្សា path %s`, (input, base) => {
            const h = harness();
            if (location === 'stored') h.stored.set('base', input);
            else h.element('setupLinkUrlInput').value = input;
            const link = h.ctx.sbInviteSetupLink(tenantSession, 'SYNTHETIC-INVITE');
            expect(link.startsWith(base + '#setup=')).toBe(true);
            expect(new URL(link).search).toBe('');
            expect(payloadOf(link)).toEqual({ supabaseUrl: tenantSession.url, supabaseKey: tenantSession.key, invite: 'SYNTHETIC-INVITE' });
        });
    }

    it.each(['base', 'config', 'supabase', 'encoding'])('ការបង្កើតបន្ទាប់បរាជ័យ %s លុប Link/QR មុន', async (failure) => {
        const h = harness();
        h.ctx.generateSetupLink();
        expect(h.ctx.lastGeneratedSetupLink).not.toBe('');
        await h.ctx.copySetupLink();
        h.ctx.saveSetupLinkQr();
        expect(h.copied).toHaveLength(1);
        expect(h.saved).toHaveLength(1);
        if (failure === 'base') h.element('setupLinkUrlInput').value = '';
        if (failure === 'config') h.element('setupLinkConfigInput').value = '{';
        if (failure === 'supabase') h.element('setupLinkConfigInput').value = JSON.stringify({ supabaseUrl: 'not-a-url', supabaseKey: 'synthetic' });
        if (failure === 'encoding') h.ctx.btoa = () => { throw new Error('synthetic encoding failure'); };
        h.ctx.generateSetupLink();
        expect(h.ctx.alert).toHaveBeenCalled();
        expectCleared(h);
        await h.ctx.copySetupLink();
        h.ctx.saveSetupLinkQr();
        expect(h.copied).toHaveLength(1);
        expect(h.saved).toHaveLength(1);
    });

    it('ប្ដូរម្ចាស់ session លុប Link ធម្មតា មិនចាំបាច់មានកូដ lookup', async () => {
        const h = harness();
        h.ctx.generateSetupLink();
        expect(h.element('setupLookupCodeOutput').textContent).toBe('');
        h.ctx.invalidateSensitiveSession();
        expectCleared(h);
        await h.ctx.copySetupLink();
        h.ctx.saveSetupLinkQr();
        expect(h.copied).toEqual([]);
        expect(h.saved).toEqual([]);
    });

    it('ចម្លងកំពុងរង់ចាំ មិនបង្ហាញជោគជ័យក្រោយ session ផ្លាស់ប្ដូរ', async () => {
        const h = harness();
        h.ctx.generateSetupLink();
        let finish!: () => void;
        h.ctx.navigator.clipboard.writeText = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
        const pending = h.ctx.copySetupLink();
        h.ctx.invalidateSensitiveSession();
        expectCleared(h);
        finish();
        await pending;
        expect(h.ctx.showToast).not.toHaveBeenCalled();
    });

    it('ប្ដូរទៅ lookup កំពុងរង់ចាំ លុបលទ្ធផលធម្មតា ហើយមិនបោះពុម្ពក្រោយប្ដូរ session', async () => {
        const h = harness();
        h.ctx.generateSetupLink();
        h.element('setupLookupIncludeCheckbox').checked = true;
        h.element('setupLookupUrlInput').value = 'https://synthetic-api.example/lookup?barcode={barcode}';
        h.element('setupLookupHeaderInput').value = 'X-Synthetic';
        h.element('setupLookupSecretInput').value = 'synthetic-fixture-value';
        let finish!: () => void;
        h.ctx.encryptSetupLookup = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
        const pending = h.ctx.generateSetupLink();
        expectCleared(h);
        h.ctx.invalidateSensitiveSession();
        finish();
        await pending;
        expectCleared(h);
        expect(h.element('setupLookupSecretInput').value).toBe('');
    });

    it('lookup ឆ្លើយយឺតមិនជាន់ Link ធម្មតាថ្មី', async () => {
        const h = harness();
        h.element('setupLookupIncludeCheckbox').checked = true;
        h.element('setupLookupUrlInput').value = 'https://synthetic-api.example/lookup?barcode={barcode}';
        let finish!: () => void;
        h.ctx.encryptSetupLookup = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
        const pending = h.ctx.generateSetupLink();
        h.element('setupLookupIncludeCheckbox').checked = false;
        h.ctx.generateSetupLink();
        const newest = h.ctx.lastGeneratedSetupLink;
        expect(payloadOf(newest)).toEqual(config);
        finish();
        await pending;
        expect(h.ctx.lastGeneratedSetupLink).toBe(newest);
        expect(h.element('setupLookupCodeOutput').textContent).toBe('');
    });
});
