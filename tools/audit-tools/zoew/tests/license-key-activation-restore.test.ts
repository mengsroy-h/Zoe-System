// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const ROOT = process.env.LICENSEACTIVATION_APP_DIR || process.env.ZOE_REPO_ROOT || resolve(import.meta.dirname, '../../../..');
const FILES = ['ZoeW/public/license-verify.js', 'ZoeKeyGen/license-verify.js'];
const NOW = Date.UTC(2026, 10, 13, 12);
const APP = 'ZOE';
const RECORD = 'zoe_license_activation_' + APP;
const DEVICE_META = { model: 'ទូរស័ព្ទតេស្ត', platform: 'PWA', serial: 'ឧបករណ៍តេស្ត' };
type Tree = Record<string, any>;
type Rule = Record<string, any>;

class Snapshot {
    constructor(private tree: Tree, private path: string[] = []) {}
    val(): any {
        let value: any = this.tree;
        for (const part of this.path) value = value && typeof value === 'object' ? value[part] : undefined;
        return value === undefined ? null : value;
    }
    child(path: string) { return new Snapshot(this.tree, [...this.path, ...path.split('/')]); }
    parent() { return new Snapshot(this.tree, this.path.slice(0, -1)); }
    exists() { return this.val() !== null; }
    isString() { return typeof this.val() === 'string'; }
    isNumber() { return typeof this.val() === 'number' && Number.isFinite(this.val()); }
    isBoolean() { return typeof this.val() === 'boolean'; }
    hasChildren(names?: string[]) {
        const value = this.val();
        return !!value && typeof value === 'object' && (names
            ? names.every(name => value[name] !== undefined && value[name] !== null)
            : Object.keys(value).length > 0);
    }
}

// វាយតម្លៃ expression ពិតជាមួយ snapshot ក្លែងប៉ុណ្ណោះ។ នេះមិនមែន Firebase emulator ឬ Rules ដែលបាន Publish ទេ។
function ruleFixture() {
    const rules: Rule = JSON.parse(readFileSync(resolve(ROOT, 'ZoeKeyGen/firebase-database.rules.json'), 'utf8')).rules;
    let tree: Tree = { user_roles: { ordinaryAdmin: 'admin' } };
    let keyId = '';
    let evaluations = 0;
    const writes: Array<{ path: string[], value: any }> = [];
    function evaluate(expression: string | boolean | undefined, previous: Tree, next: Tree, path: string[], auth: { uid: string } | null) {
        if (expression === undefined) return;
        evaluations++;
        const value = typeof expression === 'boolean' ? expression : vm.runInNewContext(expression, {
            root: new Snapshot(previous), data: new Snapshot(previous, path), newData: new Snapshot(next, path),
            auth, now: NOW, $appCode: APP, $keyId: keyId, $slot: 'd1'
        });
        expect(value, 'Rules ត្រូវទទួលទិន្នន័យធម្មតា៖ ' + path.join('/')).toBe(true);
    }
    function validate(rule: Rule, previous: Tree, next: Tree, path: string[], auth: { uid: string } | null) {
        evaluate(rule['.validate'], previous, next, path, auth);
        const value = new Snapshot(next, path).val();
        if (!value || typeof value !== 'object') return;
        for (const field of Object.keys(value)) {
            const fallback = Object.keys(rule).find(name => name.startsWith('$'));
            const child = rule[field] || (fallback && rule[fallback]);
            expect(child, 'ត្រូវមាន schema សម្រាប់ ' + path.concat(field).join('/')).toBeTruthy();
            validate(child, previous, next, [...path, field], auth);
        }
    }
    function issue(payload: { id: string, iat: number, exp: number }) {
        keyId = payload.id;
        const next = structuredClone(tree);
        next.license_keys = { [APP]: { [keyId]: { expiresAt: payload.exp * 1000, revoked: false, maxDevices: 1 } } };
        next.license_keys_meta = { [APP]: { [keyId]: { issuedAt: payload.iat * 1000, scope: APP, note: 'ហាងតេស្ត', createdBy: 'ordinaryAdmin' } } };
        for (const branch of ['license_keys', 'license_keys_meta']) {
            const rule = rules[branch].$appCode;
            const auth = { uid: 'ordinaryAdmin' };
            evaluate(rule['.validate'], tree, next, [branch, APP], auth);
            evaluate(rule.$keyId['.write'], tree, next, [branch, APP, keyId], auth);
            validate(rule.$keyId, tree, next, [branch, APP, keyId], auth);
        }
        tree = next;
    }
    function read(path: string[]) {
        if (path[0] === 'license_keys') evaluate(rules.license_keys.$appCode.$keyId['.read'], tree, tree, path, null);
        else if (path[0] === 'license_seats') evaluate(rules.license_seats.$appCode.$keyId['.read'], tree, tree, path.slice(0, 3), null);
        else throw Error('មិនមានផ្លូវអាននេះក្នុង fixture');
        return structuredClone(new Snapshot(tree, path).val());
    }
    function putSeat(path: string[], value: any) {
        expect(path.slice(0, 4)).toEqual(['license_seats', APP, keyId, 'd1']);
        expect([4, 5]).toContain(path.length);
        if (path.length === 5) expect(path[4]).toBe('meta');
        const next = structuredClone(tree);
        let destination = next;
        for (const part of path.slice(0, -1)) destination = destination[part] ??= {};
        destination[path.at(-1)!] = structuredClone(value);
        const rule = rules.license_seats.$appCode;
        evaluate(rule['.validate'], tree, next, path.slice(0, 2), null);
        evaluate(rule.$keyId['.validate'], tree, next, path.slice(0, 3), null);
        evaluate(rule.$keyId.$slot['.write'], tree, next, path.slice(0, 4), null);
        validate(rule.$keyId.$slot, tree, next, path.slice(0, 4), null);
        tree = next;
        writes.push({ path, value: structuredClone(value) });
        return structuredClone(value);
    }
    return {
        issue, read, putSeat, writes,
        get tree() { return tree; },
        get evaluations() { return evaluations; },
        seedRetiredProtocol() { tree.license_keys[APP][keyId].seatProtocol = 2; }
    };
}

async function fixture(file: string) {
    const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const publicJwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
    const privateJwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
    const originalSource = readFileSync(resolve(ROOT, file), 'utf8');
    const declaration = /const PUBLIC_KEYS_JWK = \[[\s\S]*?\];/;
    expect(originalSource.match(declaration)?.length).toBe(1);
    // ជំនួសតែ Public Key ក្នុងអង្គចងចាំ។ sign និង verify នៅតែប្រើ ECDSA ពិត។
    const source = originalSource.replace(declaration, 'const PUBLIC_KEYS_JWK = ' + JSON.stringify([publicJwk]) + ';');
    const database = ruleFixture();
    const store = new Map<string, string>();
    const requests: Array<{ url: string, method: string }> = [];
    const cryptoCalls = { sign: 0, verify: 0 };
    const state = { online: true };
    class FixedDate extends Date { static now() { return NOW; } }
    const reply = (body: any) => ({
        ok: true, status: 200, redirected: false,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => structuredClone(body)
    });
    const context: any = {
        console, Date: FixedDate, performance: { now: () => 1000 }, URL, AbortController, TextEncoder, TextDecoder,
        setTimeout, clearTimeout, navigator: { onLine: true }, location: { origin: 'https://zoew.netlify.app' },
        crypto: {
            getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
            subtle: {
                importKey: webcrypto.subtle.importKey.bind(webcrypto.subtle),
                sign: (...args: Parameters<typeof webcrypto.subtle.sign>) => { cryptoCalls.sign++; return webcrypto.subtle.sign(...args); },
                verify: (...args: Parameters<typeof webcrypto.subtle.verify>) => { cryptoCalls.verify++; return webcrypto.subtle.verify(...args); }
            }
        },
        atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
        btoa: (value: string) => Buffer.from(value, 'binary').toString('base64'),
        localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key) },
        fetch: async (url: string, init: { method?: string, body?: string } = {}) => {
            const target = new URL(url);
            requests.push({ url, method: init.method || 'GET' });
            if (!state.online) throw Error('ក្រៅបណ្ដាញក្នុង fixture');
            if (target.pathname === '/.netlify/functions/server-time') return reply({ now: NOW, nonce: target.searchParams.get('nonce') });
            const path = target.pathname.replace(/^\//, '').replace(/\.json$/, '').split('/');
            if ((init.method || 'GET') === 'GET') return reply(database.read(path));
            expect(init.method).toBe('PUT');
            return reply(database.putSeat(path, JSON.parse(init.body!)));
        }
    };
    context.window = context;
    vm.runInNewContext(source, context);
    const api = context.ZoeLicense;
    expect(await api.syncServerTime()).toBe(true);
    const issued = await api.signNewKey(privateJwk, { appCode: APP, days: 1, issuedAt: NOW });
    const parsed = api.parseKeyString(issued.keyString);
    expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, parsed.sigBytes, new TextEncoder().encode(parsed.payloadB64))).toBe(true);
    expect((await api.verifyKeyString(issued.keyString, APP)).valid).toBe(true);
    database.issue(issued.payload);
    const savedRecord = (protocol?: number) => ({
        keyString: issued.keyString, ...issued.payload, activatedAt: NOW, lastOnlineCheck: NOW,
        onlineExp: issued.payload.exp * 1000, seenMax: NOW, releaseEpoch: 0,
        ...(protocol === undefined ? {} : { seatProtocol: protocol })
    });
    return { api, context, state, originalSource, database, store, requests, cryptoCalls, issued, savedRecord };
}

describe.each(FILES)('ស្ដារ Key និង Activate ធម្មតា៖ %s', file => {
    it('ហត្ថលេខាពិត និង Rules ក្នុង repo ទទួល Key ថ្មី កៅអី d1 និង metadata ដោយគ្មាន provider បន្ថែម', async () => {
        const h = await fixture(file);
        expect(h.originalSource).not.toMatch(/ZoeSeatClient|ZoeSeatConfig|license-seat-(?:client|config|stage)/);
        expect(h.context.ZoeSeatClient).toBeUndefined();
        expect(h.context.ZoeSeatConfig).toBeUndefined();
        expect(h.store.has(RECORD)).toBe(false);
        expect(h.database.tree.license_seats).toBeUndefined();
        expect(h.database.tree.license_keys[APP][h.issued.payload.id]).toEqual({ expiresAt: h.issued.payload.exp * 1000, revoked: false, maxDevices: 1 });
        expect(h.database.tree.license_keys_meta[APP][h.issued.payload.id]).toEqual({ issuedAt: h.issued.payload.iat * 1000, scope: APP, note: 'ហាងតេស្ត', createdBy: 'ordinaryAdmin' });
        h.api.setDeviceMeta(DEVICE_META);
        expect((await h.api.activate(h.issued.keyString, APP)).valid).toBe(true);
        await new Promise(resolve => setImmediate(resolve));
        expect((await h.api.getStatus(APP)).state).toBe('active');
        const record = JSON.parse(h.store.get(RECORD)!);
        expect(record).toMatchObject({ keyString: h.issued.keyString, id: h.issued.payload.id, releaseEpoch: 0 });
        expect(record.seatProtocol).toBeUndefined();
        expect(record.seatReceipt).toBeUndefined();
        const claims = h.database.writes.filter(write => write.path.length === 4);
        const metadata = h.database.writes.filter(write => write.path.length === 5);
        expect(claims).toHaveLength(1);
        expect(Object.keys(claims[0].value).sort()).toEqual(['at', 'device', 'releaseEpoch']);
        expect(claims[0].value).toMatchObject({ device: h.api.getDeviceId(), at: NOW, releaseEpoch: 0 });
        expect(metadata).toHaveLength(1);
        expect(metadata[0].value).toEqual({ ...DEVICE_META, at: NOW });
        expect(h.database.tree.license_seats[APP][h.issued.payload.id].d1).toEqual({ ...claims[0].value, meta: metadata[0].value });
        expect(h.cryptoCalls.sign).toBe(1);
        expect(h.cryptoCalls.verify).toBeGreaterThanOrEqual(3);
        expect(h.database.evaluations).toBeGreaterThanOrEqual(30);
        expect(h.requests.some(request => /license-seat-|license-invitations/.test(request.url))).toBe(false);
    });

    it.each([undefined, 2])('Key protocol 2 ចាស់ពី Server មិនអាចផ្ដល់សិទ្ធិ ឬប្ដូរ record ដែលមាន៖ protocol=%s', async savedProtocol => {
        const h = await fixture(file);
        h.database.seedRetiredProtocol();
        const original = JSON.stringify(h.savedRecord(savedProtocol));
        h.store.set(RECORD, original);
        expect(h.database.tree.license_keys[APP][h.issued.payload.id].seatProtocol).toBe(2);
        expect((await h.api.checkOnline(APP, h.issued.payload.id, { claimSeat: true })).ok).not.toBe(true);
        expect((await h.api.getStatus(APP)).state).not.toBe('active');
        expect(h.store.get(RECORD)).toBe(original);
        expect((await h.api.activate(h.issued.keyString, APP)).valid).toBe(false);
        expect(h.store.get(RECORD)).toBe(original);
        expect(h.database.writes).toHaveLength(0);
        expect(h.requests.some(request => /license_seats|license-seat-|license-invitations/.test(request.url))).toBe(false);
    });

    it.each([true, false])('record protocol 2 ចាស់មិនអាចចូលរយៈពេលអនុគ្រោះ ហើយមិនត្រូវលុប៖ online=%s', async online => {
        const h = await fixture(file);
        h.database.seedRetiredProtocol();
        const original = JSON.stringify(h.savedRecord(2));
        h.store.set(RECORD, original);
        h.state.online = online;
        h.context.navigator.onLine = online;
        expect(h.api.getTrustedServerNow()).toBe(NOW);
        expect(JSON.parse(original).lastOnlineCheck).toBe(NOW);
        expect((await h.api.getStatus(APP)).state).not.toBe('active');
        expect(h.store.get(RECORD)).toBe(original);
        expect(h.database.writes).toHaveLength(0);
        expect(h.requests.some(request => /license_seats|license-seat-|license-invitations/.test(request.url))).toBe(false);
    });
});
