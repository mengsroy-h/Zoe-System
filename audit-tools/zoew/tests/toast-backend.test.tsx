/**
 * ⛔ សារ toast ត្រូវនិយាយឈ្មោះ backend **ដែល App កំពុងប្រើ** (សំណើម្ចាស់គម្រោង ៖ «ពេល App ប្រើ Supabase
 *    toast នៅតែនិយាយថា Firebase»)។ ចំណុចតែមួយ ៖ `toastBackendText()` ក្នុង `showToast()` ·
 *    `reannounceOrShowToast()` · `paintToast()` (toast រស់) ➜ សារថ្មីណាមួយក្នុងអនាគតត្រូវគ្របដោយស្វ័យប្រវត្តិ។
 *    ⛔ ទិសផ្ទុយ ៖ «Firebase Config» · «Firebase Console» · បញ្ជីវាល «…របស់ Firebase៖» និយាយអំពី Config
 *    ដែលកំពុងបិទភ្ជាប់ មិនមែន backend សកម្ម ➜ មិនប្តូរ · App Firebase មិនប្រែអ្វីសោះ។
 */
import fs from 'node:fs';
import ts from 'typescript';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act as reactAct } from 'react';
import { ToastList } from '../../../ZoeW/src/app/components/toast/ToastList';
import { uiState } from '../../../ZoeW/src/core/state';
import { viewState } from '../../../ZoeW/src/core/view-state';
import { paintToast, reannounceOrShowToast, showToast, toastBackendText } from '../../../ZoeW/src/ui/toast';

let host: HTMLElement;
let root: any;

function step(fn: () => void) {
    reactAct(() => { fn(); uiState.flush(); });
}

function texts() {
    return Array.from(host.querySelectorAll('.toast')).map((t) => t.textContent || '');
}

beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    host = document.createElement('div');
    host.className = 'toast-container';
    document.body.appendChild(host);
    root = createRoot(host);
    reactAct(() => { root.render(<ToastList />); });
    reactAct(() => { uiState.toasts = []; uiState.flush(); });
});

afterEach(() => {
    reactAct(() => { vi.runOnlyPendingTimers(); uiState.flush(); });
    vi.useRealTimers();
    viewState.backendKind = 'firebase';
});

const SRC = path.join(__dirname, '../../../ZoeW', 'src');
function sourceFiles(dir: string, out: string[] = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) sourceFiles(p, out);
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
    return out;
}
// Parse branches and interpolated messages without evaluating expressions. Keep
// interpolation boundaries so static fragments cannot invent a backend name.
function toastLiterals(source: string, backend = /Firebase/) {
    const out: string[] = [];
    const file = ts.createSourceFile('inventory.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
            && ['showToast', 'reannounceOrShowToast'].includes(node.expression.text) && node.arguments[0]) {
            const collect = (part: ts.Node) => {
                if (ts.isTemplateExpression(part)) {
                    const text = part.head.text + part.templateSpans.map(span => '${…}' + span.literal.text).join('');
                    if (backend.test(text)) out.push(text);
                    else for (const span of part.templateSpans) collect(span.expression);
                    return;
                }
                if (ts.isStringLiteralLike(part) && backend.test(part.text)) out.push(part.text);
                ts.forEachChild(part, collect);
            };
            collect(node.arguments[0]);
        }
        ts.forEachChild(node, visit);
    };
    visit(file);
    return out;
}
const sources = sourceFiles(SRC).map(file => ({
    name: path.relative(SRC, file).split(path.sep).join('/'),
    source: fs.readFileSync(file, 'utf8'),
}));
const inventory = Object.fromEntries(sources.map(({ name, source }) => [name, toastLiterals(source)]));
// រាប់សារពិតទាំងអស់ រួមទាំងសារថ្មីក្រៅបញ្ជីអប្បបរមាខាងក្រោម។
const literals = Object.values(inventory).flat();
// ព្រំដែនចាស់ 30 រួមមាន toast 2 ក្នុង deleteSingleDeletedItemFromFirebase ដែលគ្មានអ្នកហៅ។
// ការដក helper នោះចេញទុកសារពិត 28៖ history-write នៅសល់ 10 និងឯកសារផ្សេងទៀត 18។
// កំណត់តាមឯកសារ ដើម្បីកុំឱ្យសារបន្ថែមនៅទីផ្សេងបាំងការបាត់សារដែលនៅប្រើ។
const minimumByFile: Record<string, number> = {
    'domain/collected.ts': 1,
    'domain/pickup.ts': 1,
    'features/clear-history.ts': 1,
    'features/config.ts': 1,
    'features/entry-ops.ts': 8,
    'features/exchange-rate.ts': 3,
    'features/locker-assign.ts': 1,
    'features/scan-remove.ts': 1,
    'features/stats-modals.ts': 1,
    'services/history-write.ts': 10,
};
function inventoryDeficits(found: Record<string, string[]>) {
    return Object.entries(minimumByFile).flatMap(([file, minimum]) => {
        const actual = found[file]?.length ?? 0;
        return actual < minimum ? [{ file, minimum, actual }] : [];
    });
}

describe('toast ៖ ឈ្មោះ backend តាម Config សកម្ម', () => {
    it('inventory covers conditional toast branches but excludes comments and unrelated strings', () => {
        expect(toastLiterals(`
            // showToast('Firebase comment');
            const ignored = 'Firebase unrelated';
            showToast(ok ? 'Firebase saved' : 'Firebase failed');
            reannounceOrShowToast('Firebase direct');
            other('Firebase not a toast');
        `)).toEqual(['Firebase saved', 'Firebase failed', 'Firebase direct']);
    });
    it('inventory includes interpolated backend messages once without joining words across expressions', () => {
        expect(toastLiterals([
            '// showToast(`Firebase comment ${value}`);',
            'const ignored = `Firebase unrelated ${value}`;',
            'showToast(`Saved ${value} to Firebase`);',
            'showToast(ok ? `Firebase saved ${value} of ${total}` : `Firebase failed ${value}`);',
            'showToast(`Firebase ${"Firebase"} Firebase`);',
            'reannounceOrShowToast(`Fire${part}base`);',
            'showToast(`Saved ${ok ? "Firebase" : "Supabase"}`);',
            'other(`Firebase not a toast ${value}`);',
        ].join('\n'))).toEqual([
            'Saved ${…} to Firebase',
            'Firebase saved ${…} of ${…}',
            'Firebase failed ${…}',
            'Firebase ${…} Firebase',
            'Firebase',
        ]);
    });
    it('ជាន់អប្បបរមាតាមឯកសារ ៖ សារ Firebase ពិតយ៉ាងតិច 28 ក្រោយដក helper គ្មានអ្នកហៅ', () => {
        expect(Object.values(minimumByFile).reduce((sum, count) => sum + count, 0)).toBe(28);
        expect(inventoryDeficits(inventory)).toEqual([]);
        expect(literals.length).toBeGreaterThanOrEqual(28);
    });

    it('បាត់សារដែលនៅប្រើមួយក្នុងឯកសារណាមួយ ត្រូវបរាជ័យ ទោះបន្ថែមសារនៅទីផ្សេងក៏ដោយ', () => {
        for (const [file, minimum] of Object.entries(minimumByFile)) {
            const changed = {
                ...inventory,
                [file]: inventory[file].slice(0, minimum - 1),
                'negative-control.ts': ['Firebase replacement'],
            };
            expect(inventoryDeficits(changed)).toEqual([{ file, minimum, actual: minimum - 1 }]);
        }
    });

    it('helper ដែលដកចេញមិនមានសល់ក្នុង src ហើយមិនត្រូវបានរាប់បន្ថែមជាសារ toast', () => {
        const retired = new Set(['deleteSingleDeletedItemFromFirebase', 'purgeDeletedItemsQuietly']);
        const references: string[] = [];
        for (const { name, source } of sources) {
            const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
            const visit = (node: ts.Node) => {
                if (ts.isIdentifier(node) && retired.has(node.text)) references.push(`${name}:${node.text}`);
                ts.forEachChild(node, visit);
            };
            visit(file);
        }
        expect(references).toEqual([]);
    });

    it('Supabase ៖ រាល់សារពិតក្នុង src បង្ហាញ «Supabase» មិនមែន «Firebase» (លើកលែងតែ Config/Console)', () => {
        viewState.backendKind = 'supabase';
        const wrong = literals.map((t) => [t, toastBackendText(t)])
            .filter(([, shown]) => /Firebase(?!\s*(?:Config|Console|៖))/.test(shown) || !/Supabase|Firebase\s*(?:Config|Console|៖)/.test(shown));
        expect(wrong).toEqual([]);
    });

    it('Supabase ៖ អ្វីដែលអ្នកប្រើឃើញក្នុង DOM (showToast · reannounce · toast រស់)', () => {
        viewState.backendKind = 'supabase';
        step(() => { showToast('⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!'); });
        expect(texts()).toEqual(['⚠️ បរាជ័យក្នុងការ Save ទៅ Supabase!']);
        step(() => { reannounceOrShowToast('⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!'); });
        expect(texts()).toEqual(['⚠️ បរាជ័យក្នុងការ Save ទៅ Supabase!']);
        let id: any;
        step(() => { id = showToast('🔄 កំពុងតភ្ជាប់...'); });
        step(() => { paintToast(id, '⚠️ មិនទាន់ភ្ជាប់ Firebase ទេ!', 'warn'); });
        expect(texts()).toContain('⚠️ មិនទាន់ភ្ជាប់ Supabase ទេ!');
    });

    it.each(['firebase', 'supabase'] as const)('%s ៖ exchange-rate rejection remains a generic Server warning in both completion paths', (backend) => {
        const source = sources.find(({ name }) => name === 'features/exchange-rate.ts')!.source;
        const warnings = toastLiterals(source, /\bServer\b/);
        const expected = '⚠️ ការកែអត្រាប្រាក់នេះមិនបានរក្សាទុកទៅ Server ទេ។';
        expect(warnings).toEqual([expected, expected]);
        viewState.backendKind = backend;
        for (const warning of warnings) step(() => { showToast(warning); });
        expect(texts()).toEqual([expected, expected]);
    });

    it('ទិសផ្ទុយ ៖ App Firebase មិនប្រែ · Config/Console/បញ្ជីវាលមិនប្តូរ', () => {
        viewState.backendKind = 'firebase';
        step(() => { showToast('✅ បានរក្សាទុកទៅ Firebase រួចរាល់!'); });
        expect(texts()).toEqual(['✅ បានរក្សាទុកទៅ Firebase រួចរាល់!']);
        viewState.backendKind = 'supabase';
        for (const t of ['ℹ️ រំលងវាលដែលមិនមែនរបស់ Firebase៖ x', 'សូមបញ្ចូល Firebase Config!', 'សូម copy ពី Firebase Console ម្តងទៀត']) {
            expect(toastBackendText(t)).toBe(t);
        }
        expect(toastBackendText(null)).toBe(null);
        expect(toastBackendText(42 as any)).toBe(42);
    });
});
