import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import ts from 'typescript';

// សាកអ្នកវាស់ពិត និងម្ចាស់ snap ពិតក្នុងនាឡិកាកំណត់បាន។ DOM/WAAPI ជា scaffold;
// លទ្ធផលនេះមិនជំនួស Chromium ឬ iPhone/Android ពិតទេ។
async function measure(frameDelay = 16, mutation = '') {
    vi.useFakeTimers();
    const checker = readFileSync(path.resolve('../audit-tools/ios-panel-glide-test.js'), 'utf8');
    let measureSource = '', predicate = '';
    simple(parse(checker, { ecmaVersion: 'latest' }), {
        VariableDeclarator(node: any) {
            if (node.id.name === 'MEASURE_OWNERSHIP') measureSource = checker.slice(node.init.start, node.init.end);
        },
        CallExpression(node: any) {
            if (node.callee.name === 'ok' && checker.slice(node.arguments[0]?.start, node.arguments[0]?.end).includes('sample.action')) {
                predicate = checker.slice(node.arguments[1].start, node.arguments[1].end);
            }
        }
    });
    expect(measureSource).toContain('handle.click()');
    expect(predicate).toContain('sample.after');
    let source = readFileSync(path.resolve('src/app/behaviors/panel-motion.ts'), 'utf8');
    if (mutation === 'epoch') {
        expect(source).toContain('if (epoch !== uiState.panelGlideEpoch) return;');
        source = source.replace('if (epoch !== uiState.panelGlideEpoch) return;', '');
    }
    if (mutation === 'release') {
        expect(source).toContain('anim.finished.then(release, release)');
        source = source.replace('anim.finished.then(release, release)', 'anim.finished.then(() => {}, () => {})');
    }
    if (mutation === 'watchdog') {
        expect(source).toContain('setTimeout(endPanelGlideSnapPause,');
        source = source.replace('setTimeout(endPanelGlideSnapPause,', 'setTimeout(() => {},');
    }
    const state = { panelGlideEpoch: 0, panelGlideTokens: 0, panelGlideRelease: null as ReturnType<typeof setTimeout> | null, panelGliding: false };
    const animations: any[] = [];
    let top = 360, frames = 0;
    const pages = { classList: { contains: () => state.panelGliding } };
    const main = { getBoundingClientRect: () => ({ top }), getAnimations: () => animations.filter(a => a.playState === 'running' || a.playState === 'paused'), animate: () => {} };
    const exported: any = {};
    const context = vm.createContext({
        exports: exported, setTimeout, clearTimeout, isFinite, Promise, commitNow() {},
        window: { innerWidth: 412, matchMedia: () => ({ matches: false }) },
        getComputedStyle: () => ({ scrollSnapType: state.panelGliding ? 'none' : 'y' }),
        requestAnimationFrame: (fn: (time: number) => void) => setTimeout(() => fn(Date.now()), ++frames % 3 === 0 ? frameDelay : 16),
        document: { getElementById: (id: string) => id === 'appPages' ? pages : id === 'dataMainSection' ? main : {
            click: () => { const before = top; top = top ? 0 : 360; exported.panelGlideFrom(main, before); }
        } },
        require: (name: string) => name.endsWith('/state') ? { uiState: state } : name.endsWith('/flush') ? { commitNow() {} }
            : name.endsWith('/refs') ? { elementOf: () => pages, animateElement: (_el: unknown, _keys: unknown, timing: { duration: number }) => {
                let resolve!: () => void, reject!: (e: Error) => void;
                let time = 0, started = Date.now();
                const makeFinished = () => new Promise<void>((yes, no) => { resolve = yes; reject = no; });
                let finished = makeFinished();
                const animation: any = {
                    playState: 'running', get finished() { return finished; }, effect: { getTiming: () => timing },
                    get currentTime() { return this.playState === 'running' ? time + Date.now() - started : time; },
                    set currentTime(value: number) { time = value; started = Date.now(); },
                    pause() { time = this.currentTime; this.playState = 'paused'; clearTimeout(timer); },
                    finish() { clearTimeout(timer); time = timing.duration; this.playState = 'finished'; resolve(); },
                    cancel() { if (this.playState === 'idle') return; clearTimeout(timer); this.playState = 'idle'; reject(new Error('cancelled')); finished = makeFinished(); }
                };
                finished.then(() => { animation.outcome = 'finished'; }, () => { animation.outcome = 'cancelled'; });
                const timer = setTimeout(() => animation.finish(), timing.duration);
                animations.push(animation);
                return animation;
            } } : {}
    });
    try {
        vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
        Object.assign(context, exported);
        const pending = vm.runInContext('(' + measureSource + ')()', context);
        await vi.runAllTimersAsync();
        const samples = await pending;
        const verdicts = samples.map((sample: unknown) => vm.runInContext('sample => (' + predicate + ')', context)(sample));
        return { samples, verdicts, actualOldOutcomes: animations.filter((_animation, index) => index % 2 === 0).map(animation => animation.outcome) };
    } finally { vi.useRealTimers(); }
}

it.each([16, 250, 1000])('callback ចាស់មិនពឹងថាស៊ុមថ្មីមកមុន animation ចប់៖ %sms', async frameDelay => {
    const result = await measure(frameDelay);
    expect(result.verdicts, JSON.stringify(result.samples)).toEqual([true, true, true]);
});

it.each(['epoch', 'release', 'watchdog'])('អ្នកវាស់មិនអនុញ្ញាតបៃតងក្លែងពេលបំបែក %s', async mutation => {
    const broken = await measure(16, mutation);
    expect(broken.verdicts.some((value: boolean) => !value), JSON.stringify(broken.samples)).toBe(true);
});

it('finish និង cancel បញ្ជូន callback ចាស់តាមផ្លូវខុសគ្នា', async () => {
    const result = await measure();
    expect(result.actualOldOutcomes).toEqual(['cancelled', 'finished', 'cancelled']);
    expect(result.samples.map((sample: any) => sample.oldOutcome)).toEqual(result.actualOldOutcomes);
});
