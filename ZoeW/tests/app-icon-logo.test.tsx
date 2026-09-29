/**
 * ⛔ logo ក្នុង App ត្រូវដូច **App icon** (សំណើម្ចាស់គម្រោង) ៖ navbar · boot splash · សៀវភៅណែនាំ របស់ ZoeW
 *    និង navbar · boot splash របស់ ZoeKeyGen។ អក្សរ «Zoe»/«Key» ចាស់ជា logo ទី ២ ដែលមើលទៅជា App ផ្សេង។
 * ⛔ ការវាស់ **ដេរីវេពីប្រភព icon ពិត** (`resources/icon.svg` ដែល `android-icons.mjs` សាង launcher icon ·
 *    `manifest.json` របស់ ZoeKeyGen) មិនមែនសរសេរធរណីមាត្រម្តងទៀតក្នុងតេស្ត ➜ ប្តូរ icon ដោយភ្លេច logo ➜ ធ្លាក់។
 * ⛔ ទិសផ្ទុយ ៖ SVG ២ ក្នុងទំព័រតែមួយ (navbar + splash) មិនត្រូវចែក id gradient (id ស្ទួន ➜ ធាតុទី ២ អាចបាត់ពណ៌
 *    ពេល splash ជា `display:none`)។
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AppNavbar } from '../src/app/components/AppNavbar';
import { BootSplash } from '../src/app/components/BootSplash';
import { mount, unmount } from './native/react-harness';

const APP = path.resolve(__dirname, '..');
const KEYGEN = path.resolve(APP, '..', 'ZoeKeyGen');

type IconShape = {
    viewBox: string | null;
    plate: { rx: string | null; paint: string };
    faces: Array<{ d: string | null; fill: string; stroke: string }>;
    seam: { d: string | null; stroke: string; width: string | null; cap: string | null };
    groupWidth: string | null;
    groupJoin: string | null;
};

function paintOf(svg: Element, raw: string | null): string {
    const m = /^url\(#([^)]+)\)$/.exec(String(raw || ''));
    if (!m) return String(raw || '').toLowerCase();
    const grad = Array.from(svg.querySelectorAll('linearGradient')).find((g) => g.getAttribute('id') === m[1]);
    if (!grad) return 'missing:' + m[1];
    const dir = ['x1', 'y1', 'x2', 'y2'].map((k) => grad.getAttribute(k)).join(',');
    const stops = Array.from(grad.querySelectorAll('stop'))
        .map((s) => s.getAttribute('offset') + ':' + String(s.getAttribute('stop-color')).toLowerCase());
    return 'grad(' + dir + '|' + stops.join('|') + ')';
}

function shapeOf(svg: Element): IconShape {
    const rect = svg.querySelector('rect');
    const paths = Array.from(svg.querySelectorAll('path'));
    const seam = paths.find((p) => p.getAttribute('fill') === 'none')!;
    const faces = paths.filter((p) => p !== seam);
    const group = faces[0] && faces[0].parentElement;
    return {
        viewBox: svg.getAttribute('viewBox'),
        plate: { rx: rect && rect.getAttribute('rx'), paint: paintOf(svg, rect && rect.getAttribute('fill')) },
        faces: faces.map((p) => ({ d: p.getAttribute('d'), fill: paintOf(svg, p.getAttribute('fill')), stroke: paintOf(svg, p.getAttribute('stroke')) })),
        seam: {
            d: seam && seam.getAttribute('d'),
            stroke: paintOf(svg, seam && seam.getAttribute('stroke')),
            width: seam && seam.getAttribute('stroke-width'),
            cap: seam && seam.getAttribute('stroke-linecap')
        },
        groupWidth: group && group.getAttribute('stroke-width'),
        groupJoin: group && group.getAttribute('stroke-linejoin')
    };
}

function parseHtmlBody(html: string): Document {
    const inert = html.replace(/<link\b[^>]*>/gi, '').replace(/<script\b[\s\S]*?<\/script>/gi, '');
    return new DOMParser().parseFromString(inert, 'text/html');
}

function sourceIcon(): IconShape {
    const text = readFileSync(path.join(APP, 'resources', 'icon.svg'), 'utf8');
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    return shapeOf(doc.documentElement);
}

afterEach(() => unmount());

describe('ZoeW ៖ logo = App icon (resources/icon.svg)', () => {
    it('ប្រភព icon អានបាន និងមានធាតុគ្រប់ (ទិសផ្ទុយ ៖ ការវាស់មិនទទេ)', () => {
        const src = sourceIcon();
        expect(src.viewBox).toBe('0 0 512 512');
        expect(src.faces).toHaveLength(3);
        expect(src.plate.paint.startsWith('grad(')).toBe(true);
        expect(src.seam.d).toBeTruthy();
    });

    it('navbar និង boot splash គូរ SVG ដូច icon បេះបិទ ហើយគ្មានអក្សរ logo ចាស់', () => {
        mount(<><AppNavbar /><BootSplash /></>);
        const src = sourceIcon();
        for (const sel of ['.brand-logo', '.boot-splash-logo']) {
            const box = document.querySelector(sel)!;
            expect(box, sel).toBeTruthy();
            expect(box.textContent, sel).toBe('');
            const svg = box.querySelector('svg')!;
            expect(svg, sel).toBeTruthy();
            expect(shapeOf(svg), sel).toEqual(src);
        }
    });

    it('SVG ២ ក្នុងទំព័រតែមួយមិនចែក id gradient', () => {
        mount(<><AppNavbar /><BootSplash /></>);
        const ids = Array.from(document.querySelectorAll('svg [id]')).map((el) => el.getAttribute('id'));
        expect(ids.length).toBeGreaterThanOrEqual(4);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('សៀវភៅណែនាំ (guide.html) ប្រើ icon ដដែល', () => {
        const html = readFileSync(path.join(APP, 'public', 'guide.html'), 'utf8');
        const doc = parseHtmlBody(html);
        const svg = doc.querySelector('.brand .brand-mark');
        expect(svg && svg.tagName.toLowerCase()).toBe('svg');
        expect(shapeOf(svg!)).toEqual(sourceIcon());
        expect(svg!.textContent!.trim()).toBe('');
    });
});

describe('ZoeKeyGen ៖ logo = App icon (manifest.json)', () => {
    it('navbar និង boot splash ប្រើរូប icon របស់ manifest ដែលនៅក្នុងសំបក SW', () => {
        const manifest = JSON.parse(readFileSync(path.join(KEYGEN, 'manifest.json'), 'utf8'));
        const icons = (manifest.icons || []).map((i: any) => String(i.src).replace(/^\.?\//, ''));
        expect(icons.length).toBeGreaterThan(0);
        const doc = parseHtmlBody(readFileSync(path.join(KEYGEN, 'index.html'), 'utf8'));
        const sw = readFileSync(path.join(KEYGEN, 'sw.js'), 'utf8');
        const core = /CORE_SHELL\s*=\s*\[([\s\S]*?)\]/.exec(sw);
        expect(core).toBeTruthy();
        for (const sel of ['.brand-logo', '.boot-splash-logo']) {
            const box = doc.querySelector(sel)!;
            expect(box, sel).toBeTruthy();
            expect(box.textContent!.trim(), sel).toBe('');
            const img = box.querySelector('img')!;
            expect(img, sel).toBeTruthy();
            const src = String(img.getAttribute('src')).replace(/^\.?\//, '');
            expect(icons, sel).toContain(src);
            expect(core![1], sel).toContain(src);
            expect(img.getAttribute('alt'), sel).toBe('');
        }
    });
});
