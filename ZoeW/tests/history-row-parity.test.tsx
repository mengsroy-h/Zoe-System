/**
 * ⛔ តេស្ត parity នៃការគូរ ៖ React component ថ្មី ធៀបនឹង builder HTML ចាស់។
 *
 * ហេតុអ្វីតេស្តនេះមាន ៖ `buildHistoryRowHtml()` បានរត់លើផលិតកម្មជាង
 * ២០០ ជុំ audit។ ការសរសេរវាឡើងវិញជា JSX ជាហានិភ័យ ➜ ភាពដូចគ្នាត្រូវ
 * **វាស់លើទិន្នន័យចៃដន្យ** មិនមែនអានកូដ។
 */
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act as reactAct } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildHistoryRowHtml } from './oracles/history-row-html';
import { buildHistoryRowModel } from '../src/app/components/history/rowModel';
import { HistoryRow } from '../src/app/components/history/HistoryRow';
import { dataState } from '../src/core/state';
import { mulberry32, makeItem } from './fixtures';

/** ⛔ ចុះឈ្មោះសកម្មភាពត្រូវ stub ➜ តេស្តវាស់ *អ្វីដែលត្រូវហៅ* មិនមែនផលរំខាន។ */
const recorder: string[] = [];
vi.mock('../src/core/action-registry', () => ({
    ACTION_REGISTRY: {},
    ACTION_NAMES: [],
    lookupAction: (name: string) => (...args: unknown[]) => {
        const shown = args.map((a) => (a instanceof Event ? '<event>' : (a && (a as any).nodeType === 1 ? '<element>' : String(a))));
        (globalThis as any).__zoeRecorder.push(name + '(' + shown.join(', ') + ')');
    }
}));
(globalThis as any).__zoeRecorder = recorder;

/** attribute នៃការហៅសកម្មភាព ៖ ចាស់ប្រើ delegation · ថ្មីប្រើ handler */
const ACTION_ATTRS = ['data-act', 'data-args', 'data-a1', 'data-a2', 'data-evt', 'data-self', 'data-on'];

function canonical(html: string): string {
    const host = document.createElement('tr');
    host.innerHTML = html;
    const visit = (el: Element): string => {
        for (const a of ACTION_ATTRS) el.removeAttribute(a);
        const attrs = Array.from(el.attributes)
            .map((a) => {
                if (a.name !== 'style') return a.name + '=' + a.value;
                const probe = document.createElement('div');
                probe.style.cssText = a.value;
                return 'style=' + Array.from(probe.style).map((p) => p + ':' + probe.style.getPropertyValue(p)).sort().join(';');
            })
            .filter((s) => s !== 'class=')
            .sort()
            .join('|');
        const text = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => (n as Text).data).join('').replace(/\s+/g, ' ').trim();
        const kids = Array.from(el.children).map(visit).join('');
        return `<${el.tagName}[${attrs}]${text ? '::' + text : ''}>${kids}`;
    };
    return Array.from(host.children).map(visit).join('');
}

describe('ជួរដេកប្រវត្តិ ៖ React ធៀបនឹង builder ចាស់', () => {
    it('ផលិតរចនាសម្ព័ន្ធដូចគ្នាលើទិន្នន័យចៃដន្យ ៣០០ ធាតុ', () => {
        const rand = mulberry32(20260922);
        dataState.exchangeRateRiel = 4100;
        const mismatches: string[] = [];

        for (let i = 0; i < 300; i++) {
            const item = makeItem(rand, i);
            const rowNum = i + 1;
            const isOld = rand() < 0.5;
            const needsRecall = (item.callMark === 'no-answer' || item.callMark === 'no-connect') && rand() < 0.5;

            const legacy = buildHistoryRowHtml(item, rowNum, isOld, needsRecall);
            const model = buildHistoryRowModel(item, rowNum, isOld, needsRecall);
            const next = renderToStaticMarkup(<HistoryRow row={model} />);

            expect(model.isClosedRow, `item ${i} isClosedRow`).toBe(legacy.isClosedRow);

            const a = canonical(legacy.html);
            const b = canonical(next);
            if (a !== b) mismatches.push(`#${i}\n  ចាស់: ${a}\n  ថ្មី : ${b}`);
        }

        expect(mismatches.slice(0, 3).join('\n\n')).toBe('');
        expect(mismatches.length).toBe(0);
    });

    it('ការចុចពិត ហៅសកម្មភាពដដែលនឹង `data-act` ចាស់', async () => {
        const rand = mulberry32(777);
        for (let i = 0; i < 80; i++) {
            const item = makeItem(rand, i);
            const rowNum = i + 1;
            const isOld = rand() < 0.5;
            const needsRecall = rand() < 0.5;

            // ក. អ្វីដែល App ចាស់ *នឹងហៅ* ពេលចុចធាតុនីមួយៗ
            const legacy = buildHistoryRowHtml(item, rowNum, isOld, needsRecall);
            const host = document.createElement('tr');
            host.innerHTML = legacy.html;
            const expected = Array.from(host.querySelectorAll('[data-act]')).map((el) => {
                const args: unknown[] = [];
                const a1 = el.getAttribute('data-a1');
                if (a1 !== null) args.push(a1);
                if (el.getAttribute('data-evt')) args.unshift('<event>');
                if (el.getAttribute('data-self')) args.unshift('<element>');
                return el.getAttribute('data-act') + '(' + args.join(', ') + ')';
            });

            // ខ. អ្វីដែល App ថ្មី *ពិតជាហៅ* ពេលចុចពិតៗ
            const model = buildHistoryRowModel(item, rowNum, isOld, needsRecall);
            const mount = document.createElement('table');
            const tbody = document.createElement('tbody');
            const tr = document.createElement('tr');
            tbody.appendChild(tr);
            mount.appendChild(tbody);
            document.body.appendChild(mount);

            const root = createRoot(tr);
            await reactAct(async () => { root.render(<HistoryRow row={model} />); });

            const fired: string[] = [];
            recorder.length = 0;
            const clickable = Array.from(tr.querySelectorAll('button, a, .phone-clickable'));
            for (const el of clickable) {
                recorder.length = 0;
                await reactAct(async () => {
                    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                });
                for (const rec of recorder) fired.push(rec);
            }

            await reactAct(async () => { root.unmount(); });
            mount.remove();

            expect(fired.sort(), `item ${i}`).toEqual(expected.sort());
        }
    });
});
