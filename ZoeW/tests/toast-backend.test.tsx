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
import { ToastList } from '../src/app/components/toast/ToastList';
import { uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { paintToast, reannounceOrShowToast, showToast, toastBackendText } from '../src/ui/toast';

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

const SRC = path.join(__dirname, '..', 'src');
function sourceFiles(dir: string, out: string[] = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) sourceFiles(p, out);
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
    return out;
}
// Parse call expressions, including conditional arguments. The old regexp missed
// newly conditional phone-save success messages and other existing branch literals.
function toastLiterals(source: string) {
    const out: string[] = [];
    const file = ts.createSourceFile('inventory.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
            && ['showToast', 'reannounceOrShowToast'].includes(node.expression.text) && node.arguments[0]) {
            const collect = (part: ts.Node) => {
                if (ts.isStringLiteralLike(part) && /Firebase/.test(part.text)) out.push(part.text);
                ts.forEachChild(part, collect);
            };
            collect(node.arguments[0]);
        }
        ts.forEachChild(node, visit);
    };
    visit(file);
    return out;
}
const literals = sourceFiles(SRC).flatMap(file => toastLiterals(fs.readFileSync(file, 'utf8')));

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
    it('ជាន់អប្បបរមា ៖ សារ toast ពិតក្នុង src ដែលនិយាយ «Firebase» ≥ 30', () => {
        expect(literals.length).toBeGreaterThanOrEqual(30);
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
