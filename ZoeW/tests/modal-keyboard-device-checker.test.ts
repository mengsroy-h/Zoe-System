import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import ts from 'typescript';
import { EventEmitter } from 'node:events';

// រត់ predicate ពិតពី checker។ WAAPI/DOM ខាងក្រោមជាម៉ូដែលតែប៉ុណ្ណោះ;
// មិនមែនភស្តុតាងថា browser បានគូរស៊ុមរលូនទេ។
const source = readFileSync(path.resolve('../audit-tools/modal-keyboard-device-test.js'), 'utf8');
const declarations: Record<string, string> = {};
const bridgeFunctions: string[] = [];
let openPredicate = '', closePredicate = '';
simple(parse(source, { ecmaVersion: 'latest' }), {
    FunctionDeclaration(node: any) {
        if (['observeAuditBridge', 'openApp'].includes(node.id.name)) bridgeFunctions.push(source.slice(node.start, node.end));
    },
    VariableDeclarator(node: any) {
        if (['curve', 'glideOf', 'smooth', 'createdGlideOk', 'RECORD', 'PROBE_CREATED_GLIDE'].includes(node.id.name)) declarations[node.id.name] = source.slice(node.init.start, node.init.end);
    },
    IfStatement(node: any) {
        const body = source.slice(node.consequent.start, node.consequent.end);
        if (body === 'glidedUp++;') openPredicate = source.slice(node.test.start, node.test.end);
        if (body === 'glidedBack++;') closePredicate = source.slice(node.test.start, node.test.end);
    }
});
const appSource = readFileSync(path.resolve('src/app/behaviors/modal-keyboard.ts'), 'utf8');
const ast = ts.createSourceFile('modal-keyboard.ts', appSource, ts.ScriptTarget.Latest, true);
const names = new Set(['MODAL_GLIDE_MS', 'MODAL_GLIDE_CURVE', 'MODAL_GLIDE_ANDROID_MS', 'MODAL_GLIDE_ANDROID_CURVE', 'bezierPoint', 'bezierSlope', 'bezierParam', 'glideCurveAt']);
const selected = ast.statements.filter(node => names.has((node as any).name?.text) || (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => names.has(d.name.getText(ast)))));
expect(selected).toHaveLength(names.size);
const appContext = vm.createContext({ exports: {} });
vm.runInContext(ts.transpileModule(selected.map(node => node.getText(ast)).join('\n'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, appContext);
const app = appContext.exports;
const duration = app.MODAL_GLIDE_ANDROID_MS;
const easing = 'cubic-bezier(' + app.MODAL_GLIDE_ANDROID_CURVE.join(', ') + ')';
const progress = (t: number) => app.glideCurveAt(app.MODAL_GLIDE_ANDROID_CURVE, t).progress;
const context = vm.createContext({ GLIDE_MS: app.MODAL_GLIDE_MS });
vm.runInContext(Object.entries(declarations).map(([name, value]) => `const ${name} = ${value};`).join('\n'), context);
const evaluate = (code: string, args: Record<string, unknown>) => {
    Object.assign(context, args);
    return vm.runInContext(code, context);
};
const trace = { frames: [[5, 33], [22, 33], [88, 33], [238, 168.7], [372, 185], [438, 185], [488, 185], [505, 185], [522, 185], [538, 185], [555, 185]].map(([t, top]) => ({ t, top, pan: 0, scroll: 0 })), running: 0 };
const motion = (start = 33, end = 185) => ({ frames: Array.from({ length: 36 }, (_, i) => {
    const t = 13 + i * 1000 / 60;
    return { t, top: start + (end - start) * progress((t - 88.2) / duration), pan: 0, scroll: 0 };
}), running: 0 });
const probe = (start = 33, end = 185): any => ({
    restored: true, released: true,
    animations: [{ target: true, pseudo: '', state: 'finished', replacement: 'active', finished: true, cancelled: false, rate: 1, composite: 'replace',
        timing: { duration, easing, delay: 0, endDelay: 0, iterations: 1, iterationStart: 0, direction: 'normal', fill: 'auto' },
        keys: [{ offset: 0, computedOffset: 0, easing: 'linear', composite: 'auto', transform: `translate3d(0,${start - end}px,0)` }, { offset: 1, computedOffset: 1, easing: 'linear', composite: 'auto', transform: 'translate3d(0,0,0)' }] }],
    samples: [0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 0.99, 1].map(f => ({ f, top: start + (end - start) * progress(f), progress: f === 1 ? null : progress(f) }))
});
function verdict(effectProbe: any, record: any = motion(), phase = 'close') {
    const glide = evaluate('glideOf(record)', { record });
    return evaluate(phase === 'open' ? openPredicate : closePredicate, {
        up: phase === 'open' ? glide : { start: 185, end: 33 }, down: glide,
        upRecord: { ...record, effectProbe }, downRecord: { ...record, effectProbe }, wantMs: duration, wantEasing: easing
    });
}

it('Audit1228 ៖ trace មិនគ្រប់នៅតែធ្លាក់ ទោះខ្សែកោងរលូនផ្គូផ្គងគ្រប់ sample', () => {
    expect(evaluate('smooth(glideOf(record))', { record: trace })).toBe(false);
    expect(evaluate('glideOf(record).mid', { record: trace })).toBe(1);
    expect(trace.frames.map(f => Math.round((33 + 152 * progress((f.t - 88.2) / duration)) * 10) / 10)).toEqual(trace.frames.map(f => f.top));
    expect(verdict(probe(), trace)).toBe(false);
    expect(verdict(probe())).toBe(true);
    expect(verdict(probe(185, 33), motion(185, 33), 'open')).toBe(true);
});
it.each(['open', 'close'])('WAAPI ខ្វះ/ខុស ត្រូវធ្លាក់សម្រាប់ %s ទោះ live frames ល្អ', phase => {
    expect(verdict(undefined, motion(), phase)).toBe(false);
    const bad = probe(); bad.animations = [];
    expect(verdict(bad, motion(), phase)).toBe(false);
});
it.each([
    ['duration', (p: any) => { p.animations[0].timing.duration = 1; }],
    ['easing', (p: any) => { p.animations[0].timing.easing = 'steps(1)'; }],
    ['target', (p: any) => { p.animations[0].target = false; }],
    ['pseudo', (p: any) => { p.animations[0].pseudo = '::after'; }],
    ['composite', (p: any) => { p.animations[0].composite = 'add'; }],
    ['rate', (p: any) => { p.animations[0].rate = 2; }],
    ['delay', (p: any) => { p.animations[0].timing.delay = 100; }],
    ['iterations', (p: any) => { p.animations[0].timing.iterations = 2; }],
    ['direction', (p: any) => { p.animations[0].timing.direction = 'reverse'; }],
    ['keyframe-step', (p: any) => { p.animations[0].keys[0].easing = 'steps(1)'; }],
    ['keyframe-extra', (p: any) => { p.animations[0].keys.splice(1, 0, { ...p.animations[0].keys[0], computedOffset: 0.5 }); }],
    ['property', (p: any) => { p.animations[0].keys[0].top = '10px'; }],
    ['duplicate', (p: any) => { p.animations.push(p.animations[0]); }],
    ['unfinished', (p: any) => { p.animations[0].state = 'running'; }],
    ['no-finish-event', (p: any) => { p.animations[0].finished = false; }],
    ['cancelled', (p: any) => { p.animations[0].cancelled = true; }],
    ['not-released', (p: any) => { p.released = false; }],
    ['removed', (p: any) => { p.animations[0].replacement = 'removed'; }],
    ['zero-duration', (p: any) => { p.animations[0].timing.duration = 0; }],
    ['cleanup', (p: any) => { p.restored = false; }],
    ['wrong-start', (p: any) => { p.samples[0].top += 5; }],
    ['wrong-end', (p: any) => { p.samples.at(-1).top += 5; }],
    ['instant-jump', (p: any) => { p.samples.forEach((s: any, i: number) => { s.top = i ? 185 : 33; }); }],
    ['overshoot', (p: any) => { p.samples[5].top = 200; }],
    ['reversal', (p: any) => { p.samples[6].top = p.samples[4].top; }],
    ['staircase', (p: any) => { p.samples.forEach((s: any) => { s.top = s.f < 0.53 ? 33 : s.f < 0.99 ? 168.7 : 185; }); }],
    ['missing-sample', (p: any) => { p.samples.splice(4, 1); }]
])('actual predicate បដិសេធ %s', (_name, mutate) => {
    const bad = probe(); (mutate as (p: any) => void)(bad);
    expect(verdict(bad)).toBe(false);
    expect(verdict(bad, motion(), 'open')).toBe(false);
});
it.each(['jump', 'unfinished', 'overshoot', 'reversal', 'wrong-start', 'wrong-end'])('live %s មិនអាចជំនួសដោយ controlled probe ល្អ', mutation => {
    const bad: any = motion();
    if (mutation === 'jump') bad.frames.forEach((f: any) => { f.top = f.t < 89 ? 33 : 185; });
    if (mutation === 'unfinished') bad.running = 1;
    if (mutation === 'overshoot') bad.frames[16].top = 200;
    if (mutation === 'reversal') bad.frames[16].top = bad.frames[10].top;
    if (mutation === 'wrong-start') bad.frames = motion(38, 185).frames;
    if (mutation === 'wrong-end') bad.frames = motion(33, 190).frames;
    expect(verdict(probe(), bad)).toBe(false);
});

async function runRecorder(mutation = '') {
    const frames: ((t: number) => void)[] = [];
    let now = 0, paused = false, cancelled = false, baseTop = 33;
    const calls: string[] = [];
    const listeners: Record<string, Set<() => void>> = { finish: new Set(), cancel: new Set() };
    const animation: any = {
        playState: 'running', replaceState: 'active', playbackRate: 1, currentTime: 0,
        addEventListener(type: string, callback: () => void) { listeners[type].add(callback); },
        removeEventListener(type: string, callback: () => void) { listeners[type].delete(callback); },
        pause() { calls.push('pause'); paused = true; this.playState = 'paused'; },
        cancel() {
            calls.push('cancel');
            if (mutation === 'cancel-throws') throw new Error('cancel failed');
            if (mutation === 'cancel-noop') return;
            cancelled = true; this.playState = 'idle';
            listeners.cancel.forEach(callback => callback());
        }
    };
    const keys = [{ transform: 'translateY(-152px)' }], options = { duration };
    const nativeAnimate = function (this: unknown, ...args: unknown[]) { expect(this).toBe(card); expect(args).toHaveLength(2); expect(args[0]).toBe(keys); expect(args[1]).toBe(options); return animation; };
    const card: any = Object.create({ animate: nativeAnimate });
    if (mutation === 'own-method') Object.defineProperty(card, 'animate', { value: nativeAnimate, configurable: true, writable: true, enumerable: false });
    const ownDescriptor = Object.getOwnPropertyDescriptor(card, 'animate');
    card.scrollTop = 0;
    card.getAnimations = () => cancelled || animation.playState === 'finished' ? [] : [animation];
    card.getBoundingClientRect = () => {
        if (paused && !cancelled) {
            calls.push('geometry');
            if (mutation === 'read-throws') throw new Error('geometry failed');
            return { top: animation.currentTime >= duration ? 185 : 33 + 152 * progress(animation.currentTime / duration) };
        }
        return { top: baseTop };
    };
    animation.effect = {
        target: card, pseudoElement: null, composite: 'replace',
        getTiming: () => probe().animations[0].timing, getKeyframes: () => probe().animations[0].keys,
        getComputedTiming: () => ({ progress: animation.currentTime >= duration ? null : progress(animation.currentTime / duration) })
    };
    const globals = { window: {} as any, performance: { now: () => now }, visualViewport: { offsetTop: 0 }, CSSAnimation: class {},
        document: { getElementById: () => ({ querySelector: () => card }) }, requestAnimationFrame: (fn: (t: number) => void) => frames.push(fn) };
    const sandbox = vm.createContext(globals);
    vm.runInContext(`(${declarations.RECORD})({id:'configModal',ms:600,effects:true})`, sandbox);
    frames.shift()!(now);
    card.animate(keys, options);
    if (mutation === 'multiple') card.animate(keys, options);
    if (mutation === 'cancelled') listeners.cancel.forEach(callback => callback());
    if (mutation === 'removed') animation.replaceState = 'removed';
    expect(globals.window.__glideAnimations.captured[0].animation).toBe(animation);
    expect(calls).toEqual([]);
    while (frames.length) {
        now += 16;
        animation.currentTime = Math.min(now, duration);
        baseTop = 33 + 152 * progress(now / duration);
        if (now >= duration && animation.playState === 'running') {
            animation.playState = mutation === 'unfinished' ? 'paused' : 'finished';
            if (mutation !== 'no-finish-event' && mutation !== 'unfinished') listeners.finish.forEach(callback => callback());
        }
        frames.shift()!(now);
    }
    const live = await globals.window.__glide;
    expect(card.animate).toBe(nativeAnimate);
    expect(Object.getOwnPropertyDescriptor(card, 'animate')).toEqual(ownDescriptor);
    expect(calls).toEqual([]);
    const frozenLive = JSON.stringify(live);
    const result = vm.runInContext(`(${declarations.PROBE_CREATED_GLIDE})({id:'configModal'})`, sandbox);
    expect(JSON.stringify(live)).toBe(frozenLive);
    expect(globals.window.__glideAnimations).toBe(null);
    expect(listeners.finish.size + listeners.cancel.size).toBe(0);
    return { result, calls, animation, live };
}
it.each(['inherited-method', 'own-method'])('RECORD %s រក្សា identity និងមិន seek/pause រហូត live ចប់; probe cancel ស្អាត', async mutation => {
    const { result, calls, animation } = await runRecorder(mutation);
    expect(evaluate('createdGlideOk(value,33,185,duration,easing)', { value: result, duration, easing })).toBe(true);
    expect(calls[0]).toBe('pause');
    expect(calls.at(-1)).toBe('cancel');
    expect(calls.filter(call => call === 'geometry')).toHaveLength(11);
    expect(animation.playState).toBe('idle');
});
it.each(['cancel-throws', 'cancel-noop', 'read-throws', 'unfinished', 'no-finish-event', 'cancelled', 'multiple', 'removed'])('probe %s មិនអាចបៃតងក្លែង', async mutation => {
    const { result, calls } = await runRecorder(mutation);
    expect(evaluate('createdGlideOk(value,33,185,duration,easing)', { value: result, duration, easing })).toBe(false);
    if (['unfinished', 'no-finish-event', 'cancelled', 'multiple', 'removed'].includes(mutation)) expect(calls).toEqual([]);
    else expect(calls).toContain('cancel');
});

// Audit1237 ៖ ចន្លោះស៊ុមដូចគ្នាអាចលាក់ខ្សែកោងរលូន ឬចលនាជាជំហាន។
// ម៉ូដែលខាងក្រោមមិនអះអាងថា compositor បានគូរស៊ុមដែលមិនបានថតទេ។
const landscapeTrace = { frames: [[13, 33], [29, 33], [163, 33], [313, 57.1], [396, 59.7], [413, 59.9], [496, 60], [563, 60]].map(([t, top]) => ({ t, top, pan: 0, scroll: 0 })), running: 0 };
const landscapeOrigin = 162.92;
const landscapeTop = (t: number) => Math.round((33 + 27 * progress((t - landscapeOrigin) / duration)) * 10) / 10;
const landscapeDense = () => ({ running: 0, frames: Array.from({ length: 35 }, (_, i) => {
    const t = 13 + i * 1000 / 60;
    return { t, top: landscapeTop(t), pan: 0, scroll: 0 };
}) });
const landscapeVerdict = (record: any, effectProbe = probe(33, 60)) => evaluate(closePredicate, {
    up: { start: 60, end: 33 }, down: evaluate('glideOf(record)', { record }),
    downRecord: { ...record, effectProbe }, wantMs: duration, wantEasing: easing
});

it('Audit1237 ៖ live mid មួយនៅតែមិនគ្រប់ ទោះ predicate ផ្សេងនិង effect ត្រឹមត្រូវ', () => {
    const g = evaluate('glideOf(record)', { record: landscapeTrace });
    expect(g).toEqual({ start: 33, end: 60, dist: 27, maxStep: 24, ahead: 0, mid: 1, back: 0, over: 0, span: 233, running: 0, frames: 8 });
    expect(evaluate('smooth(g)', { g: { ...g, mid: 2 } })).toBe(true);
    expect(evaluate('createdGlideOk(value,33,60,duration,easing)', { value: probe(33, 60), duration, easing })).toBe(true);
    expect(landscapeVerdict(landscapeTrace)).toBe(false);
});
it('Audit1237 ៖ ខ្សែកោងពិតផ្គូផ្គងគ្រប់ sample តែស៊ុមក្រាស់ប៉ុណ្ណោះឆ្លង', () => {
    expect(landscapeTrace.frames.map(f => landscapeTop(f.t))).toEqual(landscapeTrace.frames.map(f => f.top));
    const dense = landscapeDense();
    expect(evaluate('glideOf(record).mid', { record: dense })).toBe(11);
    expect(landscapeVerdict(dense)).toBe(true);
    expect(landscapeVerdict(landscapeTrace)).toBe(false);
});
it('Audit1237 ៖ ជំហានធំដែល sample ខ្វះលាក់បាននៅតែធ្លាក់ពេលថតគ្រប់', () => {
    const staircase = (t: number) => {
        let top = landscapeTrace.frames[0].top;
        for (const frame of landscapeTrace.frames) if (frame.t <= t) top = frame.top;
        return top;
    };
    expect(landscapeTrace.frames.map(f => staircase(f.t))).toEqual(landscapeTrace.frames.map(f => f.top));
    const dense = landscapeDense();
    dense.frames.forEach(f => { f.top = staircase(f.t); });
    const g = evaluate('glideOf(record)', { record: dense });
    expect(g.mid).toBeGreaterThanOrEqual(2);
    expect(g.ahead).toBeGreaterThan(0.1);
    expect(landscapeVerdict(dense)).toBe(false);
    expect(landscapeVerdict(landscapeTrace)).toBe(false);
});
it('Audit1237 ៖ លោតពេញផ្លូវមួយស៊ុមមិនអាចជំនួសដោយ effect ល្អ', () => {
    const jump = landscapeDense();
    jump.frames.forEach(f => { f.top = f.t <= 163 ? 33 : 60; });
    expect(evaluate('glideOf(record).mid', { record: jump })).toBe(0);
    expect(landscapeVerdict(jump)).toBe(false);
});

// ព្រឹត្តិការណ៍ និងនាឡិកាក្លែងរត់ openApp ពិត; មិនមែន browser ឬការបន្តពូជកំហុស tablet ទេ។
async function runBridge(options: { readyAt?: number; missing?: string; helperValues?: Record<string, unknown>; failureAt?: string; events?: (page: any) => void } = {}) {
    let now = 0;
    const globals: Record<string, unknown> = {};
    const calls: any[] = [], output: string[] = [];
    const originalError = new Error('កំហុសក្លែង');
    const page: any = new EventEmitter();
    const previous = () => {};
    page.on('pageerror', previous);
    const install = () => {
        if (now >= (options.readyAt ?? 0)) for (const name of ['openModalHelper', 'closeModal', 'openModalIds']) {
            if (name !== options.missing) globals[name] = () => {};
        }
        Object.assign(globals, options.helperValues);
    };
    const phase = (name: string) => {
        calls.push([name]);
        if (options.failureAt === name) throw originalError;
    };
    page.route = async () => { phase('route'); };
    page.addInitScript = async () => { phase('init'); };
    page.goto = async (url: string, settings: unknown) => {
        calls.push(['goto', url, settings, ['pageerror', 'requestfailed', 'response'].map(name => page.listenerCount(name))]);
        now = 10;
        options.events?.(page);
        phase('navigation');
        install();
    };
    page.waitForTimeout = async (ms: number) => { calls.push(['wait', ms]); now += ms; phase('wait'); install(); };
    page.evaluate = async (fn: () => unknown) => {
        phase('evaluate');
        return vm.runInNewContext('(' + fn.toString() + ')()', globals);
    };
    const ctx = { newPage: async () => page };
    const browser = { newContext: async (settings: unknown) => { calls.push(['context', settings]); return ctx; } };
    const open = vm.runInNewContext(bridgeFunctions.join('\n') + '\nopenApp', {
        OPEN_MODAL_DETAILS: () => {}, URL, Date: { now: () => now }, console: { log: (value: string) => output.push(value) }
    });
    let result: any, error: unknown;
    try { result = await open(browser, 12345, { w: 800, h: 1280 }, [() => {}], { userAgent: 'Android' }); }
    catch (caught) { error = caught; }
    const atReturn = now;
    now = 1000;
    install();
    return { result, error, originalError, calls, output, page, previous, ctx, atReturn, globals };
}
const requestAsset = (url: unknown) => ({ url: () => url });
const responseAsset = (url: unknown, status = 503) => ({ url: () => url, status: () => status });
const diagnostic = (output: string[]) => {
    expect(output).toHaveLength(1);
    return JSON.parse(output[0].slice(output[0].indexOf('{')));
};
const expectBridgeCleanup = ({ page, previous }: any) => {
    expect(page.listeners('pageerror')).toEqual([previous]);
    expect(page.listenerCount('requestfailed')).toBe(0);
    expect(page.listenerCount('response')).toBe(0);
};

it.each([
    ['រួចមុន', 0, undefined, true], ['រួចនៅព្រំដែន', 910, undefined, true],
    ['រួចយឺត', 950, undefined, false], ['មិនរួច', Infinity, undefined, false],
    ['ខ្វះបើក', 0, 'openModalHelper', false], ['ខ្វះបិទ', 0, 'closeModal', false], ['ខ្វះបញ្ជី', 0, 'openModalIds', false]
] as const)('bridge %s រក្សា verdict និងការវាស់តែមួយក្រោយ 900ms', async (_label, readyAt, missing, ready) => {
    const run = await runBridge({ readyAt, missing });
    expect(run.error).toBeUndefined();
    expect(run.result).toEqual({ ctx: run.ctx, page: run.page, ready });
    expect(run.atReturn).toBe(910);
    expect(run.calls.filter(call => call[0] === 'wait')).toEqual([['wait', 900], ['wait']]);
    expect(run.calls.filter(call => call[0] === 'evaluate')).toHaveLength(1);
    expect(run.calls.find(call => call[0] === 'goto')).toEqual(['goto', 'http://127.0.0.1:12345/', { waitUntil: 'domcontentloaded', timeout: 20000 }, [2, 1, 1]]);
    expectBridgeCleanup(run);
    if (ready) expect(run.output).toEqual([]);
    else {
        const info = diagnostic(run.output);
        expect(info.helpers).toEqual(Object.fromEntries(['openModalHelper', 'closeModal', 'openModalIds'].map(name => [name, readyAt <= 910 && missing !== name ? 'function' : 'undefined'])));
        expect(info.events).toEqual([]);
        if (readyAt === 950) expect(typeof run.globals.openModalHelper).toBe('function');
        expect(run.result.ready).toBe(false);
    }
});

it('bridge រាយការណ៍ typeof នីមួយៗ ដោយមិនចេញតម្លៃ helper', async () => {
    const run = await runBridge({ helperValues: { openModalHelper: { secret: 'private-secret' }, closeModal: 42, openModalIds: 'private-secret' } });
    expect(run.result.ready).toBe(false);
    expect(diagnostic(run.output).helpers).toEqual({ openModalHelper: 'object', closeModal: 'number', openModalIds: 'string' });
    expect(run.output.join('')).not.toMatch(/private-secret|42/);
    expectBridgeCleanup(run);
});

it('bridge កត់តែព្រឹត្តិការណ៍សុវត្ថិភាពមុន navigation ដោយលុប query/hash', async () => {
    const run = await runBridge({ readyAt: Infinity, events(page) {
        page.emit('pageerror', { name: 'TypeError', get message() { throw new Error('មិនត្រូវអាន'); }, get stack() { throw new Error('មិនត្រូវអាន'); } });
        page.emit('pageerror', { name: 'private-secret' });
        page.emit('requestfailed', { ...requestAsset('http://127.0.0.1:12345/assets/../assets/expose-globals-Ab12.js?token=private-secret#private-secret'), failure() { throw new Error('មិនត្រូវអាន'); } });
        page.emit('response', responseAsset('http://127.0.0.1:12345/firebase-loader.js?private-secret', 404));
    } });
    expect(diagnostic(run.output)).toEqual({ helpers: { openModalHelper: 'undefined', closeModal: 'undefined', openModalIds: 'undefined' }, events: [
        { kind: 'pageerror', atMs: 10, name: 'TypeError' }, { kind: 'pageerror', atMs: 10, name: 'Error' },
        { kind: 'requestfailed', atMs: 10, path: '/assets/expose-globals-Ab12.js' }, { kind: 'response', atMs: 10, path: '/firebase-loader.js', status: 404 }
    ], dropped: 0 });
    expect(run.output.join('')).not.toMatch(/private-secret|token|127\.0\.0\.1/);
    expectBridgeCleanup(run);
});

it('bridge មិនកត់ប្រភពក្រៅ ផ្លូវមិនមែន asset ឬ response ជោគជ័យ', async () => {
    const run = await runBridge({ readyAt: Infinity, events(page) {
        for (const url of [
            'https://private-secret.example/assets/app.js', 'http://127.0.0.1:12346/assets/app.js',
            'http://127.0.0.1:12345.private-secret.example/assets/app.js', 'http://private-secret@127.0.0.1:12345/assets/app.js',
            'http://127.0.0.1:12345/api/private-secret', 'http://127.0.0.1:12345/assets/private%20secret.js',
            'http://127.0.0.1:12345/assets/' + 'x'.repeat(300) + '.js', 'data:private-secret', '/assets/app.js', undefined, null, NaN, {}, []
        ]) { page.emit('requestfailed', requestAsset(url)); page.emit('response', responseAsset(url)); }
        for (const status of [200, 204, 299, NaN, -1, 0, 600, 'private-secret']) page.emit('response', responseAsset('http://127.0.0.1:12345/assets/app.js', status as number));
    } });
    expect(diagnostic(run.output).events).toEqual([]);
    expect(run.output.join('')).not.toContain('private');
    expectBridgeCleanup(run);
});

it('bridge មានពិដានព្រឹត្តិការណ៍ និងបញ្ឈប់ observer ក្រោយលទ្ធផល', async () => {
    const run = await runBridge({ readyAt: Infinity, events(page) {
        for (let i = 0; i < 25; i++) page.emit('requestfailed', requestAsset('http://127.0.0.1:12345/assets/app.js'));
    } });
    const info = diagnostic(run.output);
    expect(info.events).toHaveLength(20);
    expect(info.dropped).toBe(5);
    const saved = run.output.slice();
    run.page.emit('requestfailed', requestAsset('http://127.0.0.1:12345/assets/late.js'));
    expect(run.output).toEqual(saved);
    expectBridgeCleanup(run);
});

it.each(['route', 'init', 'navigation', 'wait', 'evaluate'])('bridge បញ្ហា %s នៅតែ throw កំហុសដើម និងដក observer', async failureAt => {
    const run = await runBridge({ failureAt });
    expect(run.result).toBeUndefined();
    expect(run.error).toBe(run.originalError);
    expectBridgeCleanup(run);
});

it('bridge payload ខូចមិនប្ដូរ verdict ឬបញ្ឈប់ព្រឹត្តិការណ៍បន្ទាប់', async () => {
    const run = await runBridge({ events(page) {
        for (const event of ['pageerror', 'requestfailed', 'response']) {
            for (const payload of [undefined, null, NaN, {}, [], { url() { throw new Error('កំហុសក្លែង'); } }]) expect(() => page.emit(event, payload)).not.toThrow();
        }
        page.emit('pageerror', { get name() { throw new Error('កំហុសក្លែង'); } });
        page.emit('response', { url: () => 'http://127.0.0.1:12345/assets/app.js', status() { throw new Error('កំហុសក្លែង'); } });
    } });
    expect(run.result.ready).toBe(true);
    expect(run.output).toEqual([]);
    expectBridgeCleanup(run);
});
