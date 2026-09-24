/**
 * ⛔ ពណ៌រូបតំណាងរបាស្ថានភាព (Android ពេញអេក្រង់) ត្រូវផ្ទុយពន្លឺនឹង **ផ្ទៃពិត** នៅក្រោមរបា ៖
 *    navbar ស ➜ រូបតំណាងខ្មៅ (`light`) · ប្រអប់ងងឹតថ្លាៗ ➜ រូបតំណាងស (`dark`)។
 *    ការសន្មតចាស់ «inset > 0 ➜ `dark`» ធ្វើឲ្យរូបតំណាង **ស លើផ្ទៃស** (របាយការណ៍អ្នកប្រើ)។
 *    ពណ៌ក្នុងតេស្តអានចេញពី `app.css` ពិត មិនមែនសរសេរដោយដៃ។
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compositeBackdrop, parseCssColor, relativeLuminance, statusBarToneFor, statusBarToneForLuminance } from '../../src/app/lifecycle/status-bar-tone';

const CSS = fs.readFileSync(path.resolve(__dirname, '../../src/styles/app.css'), 'utf8');
const cssVar = (name: string) => {
    const m = new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})').exec(CSS);
    if (!m) throw new Error('--' + name + ' missing');
    const hex = m[1];
    return `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
};
const ruleColor = (selector: string) => {
    const at = CSS.indexOf(selector + ' {');
    if (at < 0) throw new Error(selector + ' missing');
    const body = CSS.slice(at, CSS.indexOf('}', at));
    const m = /background(?:-color)?:\s*(rgba\([^)]*\))/.exec(body);
    if (!m) throw new Error(selector + ' background missing');
    return m[1];
};

const TRANSPARENT = { color: 'rgba(0, 0, 0, 0)', opacity: 1 };
const page = (top: Array<{ color: string; opacity: number }>) => [...top, { color: cssVar('body-bg'), opacity: 1 }, TRANSPARENT];
const navbar = { color: cssVar('card-bg'), opacity: 1 };

describe('ពណ៌រូបតំណាងរបាស្ថានភាព ៖ តាមផ្ទៃពិត', () => {
    it('navbar ស (`--card-bg`) ក្រោមរបាពេញអេក្រង់ ➜ រូបតំណាងខ្មៅ (`light`)', () => {
        expect(statusBarToneFor(24, [page([navbar]), page([navbar])])).toBe('light');
    });

    it('ប្រអប់បើក (ផ្ទៃ `.modal` ពិត) ➜ រូបតំណាងស (`dark`)', () => {
        const modal = { color: ruleColor('.modal'), opacity: 1 };
        expect(statusBarToneFor(24, [page([modal, navbar])])).toBe('dark');
    });

    it('ប្រអប់ទើបចាប់ផ្តើម fade (opacity 0) ➜ នៅតែ `light` · ចប់ fade ➜ `dark`', () => {
        const modal = ruleColor('.modal');
        expect(statusBarToneFor(24, [page([{ color: modal, opacity: 0 }, navbar])])).toBe('light');
        expect(statusBarToneFor(24, [page([{ color: modal, opacity: 1 }, navbar])])).toBe('dark');
    });

    it('WebView មិនពេញអេក្រង់ (inset 0) ➜ `light` ទោះផ្ទៃងងឹត', () => {
        expect(statusBarToneFor(0, [page([{ color: 'rgb(0, 0, 0)', opacity: 1 }])])).toBe('light');
        expect(statusBarToneFor(24, [])).toBe('light');
    });

    it('ទិសផ្ទុយ ៖ ផ្ទៃងងឹតពេញ ➜ `dark` · ផ្ទៃសពេញ ➜ `light`', () => {
        expect(statusBarToneFor(24, [page([{ color: 'rgb(15, 23, 42)', opacity: 1 }])])).toBe('dark');
        expect(statusBarToneFor(24, [page([{ color: 'rgb(255, 255, 255)', opacity: 1 }])])).toBe('light');
    });

    it('មធ្យមតាមទទឹង ៖ របា Slide (ស) ភាគច្រើន + ផ្ទៃងងឹតតូច ➜ `light`', () => {
        const drawer = { color: cssVar('card-bg'), opacity: 1 };
        const backdrop = { color: ruleColor('.drawer-backdrop'), opacity: 1 };
        const samples = [page([drawer]), page([drawer]), page([drawer]), page([drawer]), page([backdrop, navbar])];
        expect(statusBarToneFor(24, samples)).toBe('light');
    });
});

describe('គណិតពណ៌', () => {
    it('parseCssColor ៖ ទម្រង់ក្បៀស · ទម្រង់ `/` · transparent · ខូច ➜ null', () => {
        expect(parseCssColor('rgb(255, 255, 255)')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
        expect(parseCssColor('rgba(15, 23, 42, 0.6)')).toEqual({ r: 15, g: 23, b: 42, a: 0.6 });
        expect(parseCssColor('rgb(15 23 42 / 60%)')).toEqual({ r: 15, g: 23, b: 42, a: 0.6 });
        expect(parseCssColor('transparent')!.a).toBe(0);
        expect(parseCssColor('color(srgb 1 1 1)')).toBeNull();
        expect(parseCssColor(undefined as any)).toBeNull();
        expect(parseCssColor('rgb(a, b, c)')).toBeNull();
    });

    it('compositeBackdrop ៖ ស្រទាប់ខាងលើគេមុន · ពណ៌ខូច/ថ្លា រំលង', () => {
        expect(compositeBackdrop([])).toEqual({ r: 255, g: 255, b: 255, a: 1 });
        expect(compositeBackdrop([{ color: 'rgba(0, 0, 0, 0.5)', opacity: 1 }, { color: 'rgb(255, 255, 255)', opacity: 1 }]).r).toBeCloseTo(127.5);
        expect(compositeBackdrop([{ color: 'rgb(0, 0, 0)', opacity: 1 }, { color: 'rgb(255, 255, 255)', opacity: 1 }]).r).toBe(0);
        expect(compositeBackdrop([{ color: 'bogus', opacity: 1 }, { color: 'rgb(10, 10, 10)', opacity: 1 }]).r).toBe(10);
        expect(compositeBackdrop([{ color: 'rgb(0, 0, 0)', opacity: NaN }]).r).toBe(0);
    });

    it('relativeLuminance · កម្រិតផ្ទុយ ៖ ស = 1 · ខ្មៅ = 0 · ចំណុចបត់ ~0.179', () => {
        expect(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 })).toBeCloseTo(1);
        expect(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBe(0);
        expect(statusBarToneForLuminance(0.2)).toBe('light');
        expect(statusBarToneForLuminance(0.15)).toBe('dark');
        expect(statusBarToneForLuminance(NaN)).toBe('light');
    });
});
