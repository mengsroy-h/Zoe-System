// ⛔ Push ៖ ការបិទដែល Server មិនទាន់បញ្ជាក់ (`offToken` ក្នុង `zoew_push_v1`) ត្រូវផ្ញើម្តងទៀតពេលអ៊ីនធឺណិតមកវិញ — មិនមែនរង់ចាំ
// visibilitychange ឬការបើក App លើកក្រោយ (ឧបករណ៍នៅតុដែលបើកជានិច្ចនៅទទួលការរំលឹករាប់ម៉ោង ខណៈ 🔔 ថាការជូនដំណឹងកំពុងបិទ)។
// boot ស្តាប់ `online` ➜ `resyncPush()` (ផ្លូវតែមួយដែលសាកការបិទ និងការចុះឈ្មោះឡើងវិញ តាមពិដានរបស់វា)។
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as boot from '../../../../ZoeW/src/app/lifecycle/boot';
import { createLifecycleScope } from '../../../../ZoeW/src/app/lifecycle/scope';
import { uiState } from '../../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { PUSH_STATE_KEY, pushNativeBuild, pushRuntime } from '../../../../ZoeW/src/features/push';

vi.mock('../../../../ZoeW/src/services/firebase-init', () => ({ initFirebase: vi.fn(), loadSupabaseFb: vi.fn() }));

const TOKEN = 'fcmToken:' + 'n'.repeat(40);
const posts: { op: string; body: any }[] = [];
let scope: ReturnType<typeof createLifecycleScope>;

function saved() {
    return JSON.parse(appLocalStore.getItem(PUSH_STATE_KEY) || '{}');
}

beforeEach(() => {
    appLocalStore.clear();
    posts.length = 0;
    uiState.pushStatus = 'unknown';
    pushNativeBuild.fcm = true;
    Object.assign(pushRuntime, { nativeEnabling: false, nativeWanted: false, offSends: new Set() });
    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any = {}) => {
        posts.push({ op: new URL(url, 'https://x.invalid/').searchParams.get('op') || '', body: init.body ? JSON.parse(init.body) : null });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }));
    scope = createLifecycleScope();
});

afterEach(() => {
    scope.dispose();
    delete (window as any).Capacitor;
    vi.unstubAllGlobals();
});

it('boot ៖ `online` ➜ ផ្ញើ unsubscribe ដែលរង់ចាំ ➜ Server បញ្ជាក់ ➜ «បិទ» · scope dispose ➜ លែងស្តាប់', async () => {
    expect(typeof (boot as any).listenPushNetwork, 'boot listens for the network returning').toBe('function');
    appLocalStore.setItem(PUSH_STATE_KEY, JSON.stringify({ on: false, offToken: TOKEN, offOp: 1 }));
    (boot as any).listenPushNetwork(scope);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(posts.filter((p) => p.op === 'unsubscribe').map((p) => p.body.sub.token)).toEqual([TOKEN]));
    await vi.waitFor(() => expect(saved().offToken).toBe(''));
    expect(uiState.pushStatus).toBe('off');
    scope.dispose();
    appLocalStore.setItem(PUSH_STATE_KEY, JSON.stringify({ on: false, offToken: TOKEN, offOp: 2 }));
    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 0));
    expect(posts.filter((p) => p.op === 'unsubscribe')).toHaveLength(1);
});

it('bootApplication ពិតភ្ជាប់ `listenPushNetwork(scope)` ពេល load (មិនមែនតែ function មាន)', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../../ZoeW', 'src', 'app', 'lifecycle', 'boot.ts'), 'utf8');
    const parsed = ts.createSourceFile('boot.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const node = parsed.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === 'bootApplication');
    if (!node) throw new Error('bootApplication missing');
    const code = ts.transpileModule(node.getText(parsed), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const stub = { onLoad: (fn: () => void) => fn(), onDispose: () => {}, listen: () => {} };
    const wired: unknown[] = [];
    const names = ['bootShell', 'startCoreServices', 'listenSetupLinkNavigation', 'startPeriodicTasks', 'setupConnectionRecovery',
        'startScanEngine', 'startInteractions', 'startGlobalDismissals', 'sampleScrollHz', 'revealAppAfterBoot'];
    const context: Record<string, unknown> = Object.fromEntries(names.map((name) => [name, () => {}]));
    context.exports = {};
    context.window = {};
    context.listenPushNetwork = (arg: unknown) => { wired.push(arg); };
    vm.runInNewContext(code + '; bootApplication;', context)(stub);
    expect(wired).toHaveLength(1);
    expect(wired[0]).toBe(stub);
});
