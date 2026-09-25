'use strict';

// ស្រង់ function និង state ពិតតាម AST។ គ្រប់គ្រងតែពេលវេលា និង animation.finished
// ដើម្បីសាក callback ចាស់មកក្រោយ watchdog ឬ cleanup ដោយគ្មានសំណើទៅផលិតកម្ម។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');
const { reactRuntime, renderedElement } = require('./react-view');
const ROOT = process.env.PANELSNAP_APP_DIR
    ? path.resolve(process.env.PANELSNAP_APP_DIR) : path.resolve(__dirname, '..');
let pass = 0;
let fail = 0;

function check(condition, label) {
    if (condition) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label); }
}

const APP_SOURCE = fs.readFileSync(path.join(ROOT, 'ZoeW/app.js'), 'utf8');

function extractActualSource() {
    const source = APP_SOURCE;
    const required = new Set([
        'PANEL_GLIDE_MS', 'PANEL_GLIDE_EASING', 'PANEL_GLIDE_SNAP_GRACE_MS',
        'panelGlideTokens', 'panelGlideRelease', 'panelMotionAllowed',
        'beginPanelGlideSnapPause', 'endPanelGlideSnapPause', 'panelGlideFrom'
    ]);
    const wanted = new Set([...required, 'panelGlideEpoch']);
    const found = new Map();
    const selected = new Set();
    function select(name, node) {
        if (!wanted.has(name)) return;
        if (found.has(name)) throw new Error('រកឃើញ declaration ស្ទួន៖ ' + name);
        found.set(name, node);
        selected.add(node);
    }
    function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'FunctionDeclaration' && node.id) select(node.id.name, node);
        if (node.type === 'VariableDeclaration') {
            for (const item of node.declarations) {
                if (item.id.type === 'Identifier') select(item.id.name, node);
            }
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(walk);
            else if (value && typeof value === 'object') walk(value);
        }
    }
    walk(acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' }));
    for (const name of required) {
        if (!found.has(name)) throw new Error('ខ្វះ declaration ពិត៖ ' + name);
    }
    return [...selected].sort((a, b) => a.start - b.start)
        .map(node => source.slice(node.start, node.end)).join('\n');
}

function environment(code, options = {}) {
    let now = 0;
    let nextTimer = 1;
    let animationCalls = 0;
    const timers = new Map();
    const context = vm.createContext({
        document: {
            getElementById: id => id === 'appPages' && !options.missingPages ? {} : null
        },
        queueMicrotask,
        window: {
            innerWidth: options.width === undefined ? 412 : options.width,
            matchMedia: () => ({ matches: options.reducedMotion === true })
        },
        setTimeout: (callback, delay) => {
            const id = nextTimer++;
            timers.set(id, { at: now + delay, callback });
            return id;
        },
        clearTimeout: id => timers.delete(id),
        isFinite
    });
    // ⛔ ZoeW ជា React ៖ `#appPages.panel-gliding` ជា `uiState.panelGliding` ដែល `AppPages.tsx` គូរ ➜ ស្រទាប់ React ពិត
    //    ចូល sandbox ហើយ `paused()` អាន class ពី **JSX ពិត** (មិនមែន classList ក្លែង)
    vm.runInContext(reactRuntime(APP_SOURCE, { context }), context, { timeout: 1000 });
    const pages = renderedElement(ROOT, context, 'src/app/components/AppPages.tsx', 'AppPages', 'appPages');
    vm.runInContext(code + '\nglobalThis.api = { panelGlideFrom, beginPanelGlideSnapPause, endPanelGlideSnapPause };',
        context, { timeout: 1000 });

    function tick(target) {
        if (!Number.isFinite(target) || target < now) throw new Error('នាឡិកាតេស្តមិនត្រូវថយក្រោយ');
        let steps = 0;
        while (true) {
            const pair = [...timers].filter(([, timer]) => timer.at <= target)
                .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
            if (!pair) break;
            if (++steps > 100) throw new Error('timer មិនព្រមបញ្ចប់');
            now = pair[1].at;
            timers.delete(pair[0]);
            pair[1].callback();
        }
        now = target;
    }

    function glide(mode = 'promise', beforeTop = 361) {
        let resolve;
        let reject;
        const finished = new Promise((done, failed) => { resolve = done; reject = failed; });
        const animation = mode === 'promise' ? { finished } : mode === 'legacy' ? {} : null;
        const element = {
            getBoundingClientRect: () => ({ top: 0 }),
            animate: () => {
                animationCalls++;
                if (mode === 'throw') throw new Error('animation តេស្តបោះកំហុស');
                return animation;
            }
        };
        context.api.panelGlideFrom(element, beforeTop);
        return { resolve, reject, animation };
    }
    return {
        api: context.api, glide, tick,
        paused: () => pages.classList.contains('panel-gliding'),
        timers: () => timers.size,
        animationCalls: () => animationCalls
    };
}

async function flush() {
    await Promise.resolve();
    await Promise.resolve();
}

async function main() {
    const code = extractActualSource();
    const cases = [
        ['ចលនាស្របគ្នា', async e => {
            const first = e.glide();
            const second = e.glide();
            check(e.paused(), 'ចលនា ២ ចាប់ផ្តើម ➜ snap ផ្អាក');
            first.resolve();
            await flush();
            check(e.paused(), 'ចលនាទី១ ចប់ ➜ ចលនាទី២ រក្សាការផ្អាក');
            second.resolve();
            await flush();
            check(!e.paused() && e.timers() === 0, 'ចលនាទាំង២ ចប់ ➜ snap ស្តារ និងដក timer');
        }],
        ['callback ជោគជ័យចាស់មកក្រោយ watchdog', async e => {
            const old = e.glide();
            e.tick(480);
            check(!e.paused(), 'watchdog ដោះចលនាចាស់ដែលព្យួរ');
            e.tick(500);
            const current = e.glide();
            check(e.paused(), 'ចលនាថ្មីផ្អាក snap វិញ');
            old.resolve();
            await flush();
            check(e.paused(), 'callback ជោគជ័យចាស់មិនត្រូវដោះការផ្អាករបស់ចលនាថ្មី');
            current.resolve();
            await flush();
            check(!e.paused(), 'callback ថ្មីដោះការផ្អាករបស់ខ្លួន');
        }],
        ['callback បដិសេធចាស់មកក្រោយ watchdog', async e => {
            const old = e.glide();
            e.tick(480);
            const current = e.glide();
            old.reject(new Error('ការបោះបង់ចាស់មកយឺត'));
            await flush();
            check(e.paused(), 'callback បដិសេធចាស់មិនត្រូវដោះការផ្អាករបស់ចលនាថ្មី');
            current.resolve();
            await flush();
            check(!e.paused(), 'ចលនាថ្មីចប់ក្រោយ callback បដិសេធចាស់ ➜ snap ស្តារ');
        }],
        ['callback ចាស់មកក្រោយ cleanup', async e => {
            const old = e.glide();
            e.api.endPanelGlideSnapPause();
            check(!e.paused() && e.timers() === 0, 'cleanup ដោះការផ្អាក និង timer');
            const current = e.glide();
            old.resolve();
            await flush();
            check(e.paused(), 'callback មុន cleanup មិនត្រូវដោះការផ្អាករបស់ចលនាថ្មី');
            current.resolve();
            await flush();
            check(!e.paused(), 'ចលនាថ្មីក្រោយ cleanup ស្តារ snap ពេលចប់');
        }],
        ['ម្ចាស់ចាស់ច្រើនមកយឺត', async e => {
            const firstOld = e.glide();
            const secondOld = e.glide();
            e.tick(480);
            const firstNew = e.glide();
            const secondNew = e.glide();
            firstOld.resolve();
            secondOld.resolve();
            await flush();
            check(e.paused(), 'callback ចាស់ ២ មិនត្រូវដោះការផ្អាករបស់ចលនាថ្មី ២');
            firstNew.resolve();
            await flush();
            check(e.paused(), 'ចលនាថ្មីទី១ ចប់ ➜ ចលនាថ្មីទី២ នៅតែផ្អាក snap');
            secondNew.resolve();
            await flush();
            check(!e.paused(), 'ចលនាថ្មីទាំង២ ចប់ ➜ snap ស្តារ');
        }],
        ['ការដោះស្ទួន', async e => {
            const first = e.api.beginPanelGlideSnapPause();
            const second = e.api.beginPanelGlideSnapPause();
            first();
            first();
            check(e.paused(), 'ហៅ release ទី១ ពីរដងមិនត្រូវដោះម្ចាស់ទី២');
            second();
            check(!e.paused(), 'ម្ចាស់ទី២ ដោះបានត្រឹមត្រូវ');
        }],
        ['watchdog សម្រាប់ promise ព្យួរ', async e => {
            e.glide();
            e.tick(479);
            check(e.paused(), 'មុន 480ms ការផ្អាកនៅមាន');
            e.tick(480);
            check(!e.paused() && e.timers() === 0, 'ដល់ 480ms watchdog សម្អាត promise ព្យួរ');
        }],
        ['ម្ចាស់ថ្មីបន្តពេល watchdog', async e => {
            e.glide();
            e.tick(400);
            e.glide();
            e.tick(480);
            check(e.paused(), 'timer ចាស់ត្រូវបានដកពេលចលនាថ្មីចាប់ផ្តើម');
            e.tick(879);
            check(e.paused(), 'ម្ចាស់ថ្មីនៅមាន grace របស់ខ្លួន');
            e.tick(880);
            check(!e.paused(), 'watchdog ថ្មីសម្អាតក្រោយពិដានថ្មី');
        }],
        ['animate បោះកំហុស', async e => {
            e.glide('throw');
            check(!e.paused() && e.timers() === 0, 'animate បោះកំហុស ➜ មិនទុកការផ្អាកជាប់');
        }],
        ['ផ្លូវ onfinish ចាស់', async e => {
            const first = e.glide('legacy');
            check(typeof first.animation.onfinish === 'function', 'គ្មាន finished ➜ ភ្ជាប់ onfinish');
            first.animation.onfinish();
            check(!e.paused(), 'onfinish ស្តារ snap បាន');
            e.glide('legacy');
            e.tick(480);
            check(!e.paused(), 'onfinish មិនមក ➜ watchdog ស្តារ snap បាន');
        }],
        ['គ្មាន appPages', async (_e, build) => {
            const e = build({ missingPages: true });
            const release = e.api.beginPanelGlideSnapPause();
            release();
            release();
            check(!e.paused() && e.timers() === 0, 'គ្មាន appPages ➜ release ទទេ មិនបង្កើត timer');
        }],
        ['អ្នកប្រើកាត់បន្ថយចលនា', async (_e, build) => {
            const e = build({ reducedMotion: true });
            e.glide();
            check(e.animationCalls() === 0 && !e.paused() && e.timers() === 0,
                'reduced-motion ➜ មិនចាប់ផ្តើម animation ឬផ្អាក snap');
        }],
        ['អេក្រង់ desktop', async (_e, build) => {
            const e = build({ width: 992 });
            e.glide();
            check(e.animationCalls() === 0 && !e.paused() && e.timers() === 0,
                'desktop 992px ➜ មិនចាប់ផ្តើម animation ឬផ្អាក snap');
        }],
        ['delta តូច ឬមិនមែនលេខ', async e => {
            e.glide('promise', 1);
            e.glide('promise', NaN);
            e.glide('promise', Infinity);
            check(e.animationCalls() === 0 && !e.paused() && e.timers() === 0,
                'delta តូច ឬខូច ➜ មិនចាប់ផ្តើម animation ឬផ្អាក snap');
        }]
    ];
    for (const [label, run] of cases) {
        try { await run(environment(code), options => environment(code, options)); }
        catch (error) { check(false, label + ' ៖ ' + error.message); }
    }
}

main().catch(error => check(false, 'មិនអាចរត់កូដពិត ៖ ' + error.message)).finally(() => {
    console.log('\n' + pass + ' PASS / ' + fail + ' FAIL');
    process.exitCode = fail ? 1 : 0;
});
