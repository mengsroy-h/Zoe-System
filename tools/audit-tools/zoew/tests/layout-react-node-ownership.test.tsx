import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { dataState, uiState } from '../../../../ZoeW/src/core/state';
import { MonthlyReportModal } from '../../../../ZoeW/src/app/components/modals/MonthlyReportModal';
import { AppPages } from '../../../../ZoeW/src/app/components/AppPages';
import { MONTHLY_REPORT_HEADERS } from '../../../../ZoeW/src/features/monthly-report';
import { mount, step, unmount } from './native/react-harness';

const source = fs.readFileSync('../tools/audit-tools/layout-check.js', 'utf8');
const tree = parse(source, { ecmaVersion: 'latest' });
const probes: any[] = [];
function walk(node: any) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.callee?.property?.name === 'evaluate'
        && node.arguments[0]?.params?.[0]?.name === 'hs') probes.push(node.arguments[0]);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') walk(value);
    }
}
walk(tree);
function probe(style = getComputedStyle) {
    expect(probes).toHaveLength(1);
    return vm.runInNewContext('(' + source.slice(probes[0].start, probes[0].end) + ')', {
        document, getComputedStyle: style
    })(MONTHLY_REPORT_HEADERS);
}
beforeEach(() => {
    uiState.monthlyReportMonth = '2026-11';
    uiState.modalDisplay = { monthlyReportModal: 'flex' };
    dataState.dailyRevenueData = { '2026-11-18': { codDollar: 10, dodDollar: 0, totalCount: 1 } };
    dataState.monthlyRevenueData = {}; dataState.dailyPickupData = {};
    dataState.scanHistory = []; dataState.deletedItems = [];
    mount(<><AppPages /><MonthlyReportModal /></>);
});
afterEach(unmount);
it('អ្នកវាស់ layout រក្សា node ដែល React កាន់ រួចគូរថ្មីមិនបាត់កាត App', () => {
    const host = document.getElementById('monthlyReportBody')!;
    const nodes = Array.from(host.childNodes);
    const pages = document.querySelector('.app-pages');
    expect(pages).not.toBeNull();
    const result = probe();
    expect(result.cols).toBe(MONTHLY_REPORT_HEADERS.length);
    expect(result.clipped).toEqual([]);
    nodes.forEach((node, index) => expect(host.childNodes[index]).toBe(node));
    step(() => { dataState.dailyRevenueData = {}; });
    expect(document.querySelector('.app-pages')).toBe(pages);
    expect(host.textContent).toContain('គ្មានទិន្នន័យសម្រាប់ខែនេះទេ');
});
it('ការវាស់ដែល throw ក៏ស្ដារ node និង display ដើម', () => {
    const host = document.getElementById('monthlyReportBody')!;
    const nodes = Array.from(host.childNodes);
    const displays = Array.from(document.querySelectorAll<HTMLElement>('.modal')).map(el => [el, el.style.display] as const);
    expect(() => probe(() => { throw new Error('fixture geometry failed'); })).toThrow('fixture geometry failed');
    nodes.forEach((node, index) => expect(host.childNodes[index]).toBe(node));
    displays.forEach(([el, display]) => expect(el.style.display).toBe(display));
});
it('គូរមាតិកាទទេក្រោយ probe មិនធ្វើឱ្យ React root បាត់', () => {
    probe();
    let failure: unknown;
    try { step(() => { dataState.dailyRevenueData = {}; }); } catch (error) { failure = error; }
    expect(document.querySelector('.app-pages .app-card')).not.toBeNull();
    expect(failure).toBeUndefined();
});
