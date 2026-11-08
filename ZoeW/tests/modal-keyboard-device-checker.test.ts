import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import ts from 'typescript';

// រត់ predicate ពិតពី checker។ WAAPI/DOM ខាងក្រោមជាម៉ូដែលតែប៉ុណ្ណោះ;
// មិនមែនភស្តុតាងថា browser បានគូរស៊ុមរលូនទេ។
const source = readFileSync(path.resolve('../audit-tools/modal-keyboard-device-test.js'), 'utf8');
const declarations: Record<string, string> = {};
let openPredicate = '', closePredicate = '';
simple(parse(source, { ecmaVersion: 'latest' }), {
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
