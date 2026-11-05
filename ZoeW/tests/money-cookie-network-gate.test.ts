import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const require = createRequire(import.meta.url);
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { networkGate } = require(path.join(sourceRoot, 'audit-tools/money-cookie-blob.js'));
const fixtures: any[] = [], pending = new Set<Promise<any>>();
let sdkPing: (this: any) => void;
function actualSdkPing(healthy = false) {
    if (!sdkPing) {
        const sdkDir = path.dirname(require.resolve('firebase/package.json'));
        const source = fs.readFileSync(path.join(sdkDir, 'firebase-database.js'), 'utf8'), methods: any[] = [];
        const walk = (node: any) => {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'MethodDefinition' && node.key?.name === 'sendPingOnPrimaryIfNecessary_') methods.push(node);
            for (const value of Object.values(node)) {
                if (Array.isArray(value)) value.forEach(walk);
                else if ((value as any)?.type) walk(value);
            }
        };
        walk(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
        expect(methods).toHaveLength(1);
        const body = methods[0].value.body;
        sdkPing = vm.runInNewContext('(function()' + source.slice(body.start, body.end) + ')');
    }
    const packets: any[] = [];
    sdkPing.call({ isHealthy_: healthy, state_: 1, log_() {}, sendData_: (packet: any) => packets.push(packet) });
    return packets;
}
function track<T>(promise: Promise<T>) {
    pending.add(promise);
    promise.then(() => pending.delete(promise), () => pending.delete(promise));
    return promise;
}
async function fixture() {
    let route: (socket: any) => void, client: (message: string) => Promise<void>, upstream: (message: string) => Promise<void>;
    const toServer: string[] = [], toClient: string[] = [];
    const gate = await networkGate({ routeWebSocket: async (_pattern: RegExp, handler: typeof route) => { route = handler; } }, 'firebase');
    expect(route).toBeTypeOf('function');
    const server = { send: (message: string) => toServer.push(message), onMessage: (handler: typeof upstream) => { upstream = handler; } };
    route({ connectToServer: () => server, onMessage: (handler: typeof client) => { client = handler; }, send: (message: string) => toClient.push(message) });
    expect(client).toBeTypeOf('function'); expect(upstream).toBeTypeOf('function');
    const row = { gate, toServer, toClient, client: (message: string) => track(client(message)), server: (message: string) => track(upstream(message)) };
    fixtures.push(row); return row;
}
afterEach(async () => {
    for (const row of fixtures.splice(0)) row.gate.release(true);
    await Promise.allSettled([...pending]);
});
const merge = JSON.stringify({ t: 'd', d: { r: 9, a: 'm', b: { p: '/', d: { 'zoew_scan_history_cod_dod/item': { cod: 37, dod: 5, count: 1 } } } } });
const put = JSON.stringify({ t: 'd', d: { r: 10, a: 'p', b: { p: '/zoew_recently_deleted_cod_dod/item', d: { cod: 37, dod: 5, count: 1 } } } });
const ack = (id: number) => JSON.stringify({ t: 'd', d: { r: id, b: { s: 'ok', d: '' } } });

it('actual browser SDK health ping forwards unarmed without inspecting a write body', async () => {
    const packets = actualSdkPing();
    expect(packets).toEqual([{ t: 'c', d: { t: 'p', d: {} } }]); expect(actualSdkPing(true)).toEqual([]);
    const frame = JSON.stringify(packets[0]), f = await fixture(); await f.client(frame);
    expect(f.toServer).toEqual([frame]); expect(f.gate.hits).toBe(0);
});
it('actual browser SDK health ping forwards while before-write gate is armed', async () => {
    const packets = actualSdkPing(); expect(packets).toHaveLength(1);
    const frame = JSON.stringify(packets[0]), f = await fixture(); f.gate.arm('before'); await f.client(frame);
    expect(f.toServer).toEqual([frame]); expect(f.gate.hits).toBe(0);
});
it('heartbeat and fragmented/nonJSON frames retain byte-identical transparent forwarding', async () => {
    const f = await fixture(), frames = ['0', '2', '{not-complete-json'];
    for (const frame of frames) await f.client(frame);
    expect(f.toServer).toEqual(frames); expect(f.gate.hits).toBe(0);
});
it('nonwrite data request forwards without hitting the money gate', async () => {
    const f = await fixture(); f.gate.arm('before');
    const frame = JSON.stringify({ t: 'd', d: { r: 2, a: 'q', b: { p: '/zoew_scan_history_cod_dod' } } }); await f.client(frame);
    expect(f.toServer).toEqual([frame]); expect(f.gate.hits).toBe(0);
});
it('valid root merge is held before forwarding and released without packet changes', async () => {
    const f = await fixture(); f.gate.arm('before'); const operation = f.client(merge);
    expect(f.gate.hits).toBe(1); expect(f.toServer).toEqual([]);
    expect(f.gate.evidence().boundaries[0].operations).toEqual([{ path: 'zoew_scan_history_cod_dod/item', value: { cod: 37, dod: 5, count: 1 } }]);
    f.gate.release(); await operation; expect(f.toServer).toEqual([merge]);
});
it('nonroot put remains held and close-before-write suppresses only the held write', async () => {
    const f = await fixture(); f.gate.arm('before'); const operation = f.client(put);
    expect(f.gate.hits).toBe(1); expect(f.toServer).toEqual([]);
    f.gate.release(true); await operation; expect(f.toServer).toEqual([]);
});
it('nested merge preserves its complete base/path and value', async () => {
    const f = await fixture(); f.gate.arm('before');
    const frame = JSON.stringify({ t: 'd', d: { r: 11, a: 'm', b: { p: '/zoew_recently_deleted_cod_dod', d: { item: { cod: 37 } } } } });
    const operation = f.client(frame); expect(f.gate.hits).toBe(1);
    expect(f.gate.evidence().boundaries[0].operations).toEqual([{ path: 'zoew_recently_deleted_cod_dod/item', value: { cod: 37 } }]);
    f.gate.release(); await operation; expect(f.toServer).toEqual([frame]);
});
it('matching ok ACK alone triggers after hold and forwards byte-identically after release', async () => {
    const f = await fixture(); f.gate.arm('after'); await f.client(merge);
    expect(f.toServer).toEqual([merge]); expect(f.gate.hits).toBe(0);
    const response = ack(9), operation = f.server(response); expect(f.gate.hits).toBe(1); expect(f.toClient).toEqual([]);
    f.gate.release(); await operation; expect(f.toClient).toEqual([response]);
});
it('foreign ACK cannot consume the original matching request', async () => {
    const f = await fixture(); f.gate.arm('after'); await f.client(merge);
    const foreign = ack(99); await f.server(foreign); expect(f.gate.hits).toBe(0); expect(f.toClient).toEqual([foreign]);
    const operation = f.server(ack(9)); expect(f.gate.hits).toBe(1);
    f.gate.release(); await operation; expect(f.toClient).toEqual([foreign, ack(9)]);
});
it('denied ACK reaches the caller without a fabricated success or after hit', async () => {
    const f = await fixture(); f.gate.arm('after'); await f.client(merge);
    const denied = JSON.stringify({ t: 'd', d: { r: 9, b: { s: 'permission_denied', d: 'synthetic refusal' } } }); await f.server(denied);
    expect(f.gate.hits).toBe(0); expect(f.toClient).toEqual([denied]);
});
it('unrelated writes and a negative match predicate cannot arm a money hold', async () => {
    const f = await fixture(); f.gate.arm('before', (op: any) => op.path.endsWith('/different')); await f.client(put);
    const unrelated = JSON.stringify({ t: 'd', d: { r: 14, a: 'p', b: { p: '/zoew_settings/exchange_rate', d: 4100 } } }); await f.client(unrelated);
    expect(f.gate.hits).toBe(0); expect(f.toServer).toEqual([put, unrelated]);
});
it('malformed recognized write stays a rejected failure rather than silent zero effects', async () => {
    const f = await fixture(); f.gate.arm('before');
    await expect(f.client(JSON.stringify({ t: 'd', d: { r: 12, a: 'm' } }))).rejects.toThrow();
    expect(f.toServer).toEqual([]);
});
