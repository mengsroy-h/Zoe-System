/**
 * ⛔ 🩺 ពិនិត្យសុខភាព ៖ ជួរដែល React គូរ ត្រូវដូច `healthRowHtml()` ដើម
 *    (អ្នកសម្រេច) បេះបិទ — class · រូប · អត្ថបទ · ការគេចអក្សរ។
 *
 * វាស់បាន (`parity-deep`) ៖ អ្នកសាងជួរនៅត្រឡប់ **ខ្សែអក្សរ HTML** ខណៈ
 * component រំពឹង model ➜ ប្រអប់បង្ហាញ **ជួរទទេ ៩** ខណៈ parity ស្តាទិច ១០០%។
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act as reactAct } from 'react';
import { HealthCheckList } from '../src/app/components/health/HealthCheckList';
import { healthPendingRow, healthRow } from '../src/app/components/health/model';
import { healthRowHtml } from './oracles/health-row-html';
import { uiState } from '../src/core/state';

function canon(el: Element): string {
    const attrs = Array.from(el.attributes).map((a) => a.name + '=' + a.value).sort().join('|');
    const text = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => (n as Text).data).join('');
    return `<${el.tagName}[${attrs}]${text ? '::' + text : ''}>` + Array.from(el.children).map(canon).join('');
}

function renderRows(rows: any[]): string {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    reactAct(() => { uiState.healthRows = rows; uiState.flush(); root.render(<HealthCheckList />); });
    const out = Array.from(host.children).map(canon).join('\n');
    reactAct(() => root.unmount());
    host.remove();
    return out;
}

function fromHtml(html: string): string {
    const box = document.createElement('div');
    box.innerHTML = html;
    return Array.from(box.children).map(canon).join('\n');
}

afterEach(() => { reactAct(() => { uiState.healthRows = null; uiState.flush(); }); });

const CASES: [string, string, string][] = [
    ['ok', 'អ៊ីនធឺណិត', 'ភ្ជាប់'],
    ['warn', 'Firebase', 'ភ្ជាប់រួច តែទិន្នន័យ 2 ផ្នែកមិនទាន់មកដល់'],
    ['bad', 'Lookup អតិថិជន (ZTO)', 'ភ្ជាប់ទៅ Server មិនបាន — <script>alert(1)</script> & "q"'],
    ['info', 'តារាងអតិថិជន', 'មិនទាន់ទាញមកទេ'],
    ['bogus', 'សាលក្រមមិនស្គាល់', 'ត្រូវធ្លាក់ទៅ info'],
    ['ok', '', '']
];

describe('ជួរពិនិត្យសុខភាព ៖ React ធៀបនឹង healthRowHtml() ដើម', () => {
    for (const [state, label, detail] of CASES) {
        it(`${state} · «${label || '(ទទេ)'}»`, () => {
            expect(renderRows([healthRow(state, label, detail)])).toBe(fromHtml(healthRowHtml(state, label, detail)));
        });
    }

    it('ជួរ ៩ ក្នុងលំដាប់ដដែល', () => {
        const rows = CASES.map(([s, l, d]) => healthRow(s, l, d));
        expect(renderRows(rows)).toBe(fromHtml(CASES.map(([s, l, d]) => healthRowHtml(s, l, d)).join('')));
    });

    it('ជួរ «កំពុងពិនិត្យ…» ដូច markup ដើម (⏳ · គ្មាន detail)', () => {
        const original = '<div class="health-row health-info"><span class="health-ico">⏳</span>'
            + '<span class="health-text"><b>កំពុងពិនិត្យ…</b></span></div>';
        expect(renderRows([healthPendingRow()])).toBe(fromHtml(original));
    });

    it('ទិសផ្ទុយ ៖ ខ្សែអក្សរ HTML មិនមែនជាជួរ (ជួរទទេ = កំហុសដែលវាស់បាន)', () => {
        const broken = renderRows([healthRowHtml('ok', 'X', 'Y') as any]);
        expect(broken).not.toBe(fromHtml(healthRowHtml('ok', 'X', 'Y')));
    });
});
