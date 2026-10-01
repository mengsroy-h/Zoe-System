/**
 * ⛔ icon PWA របស់ App ទាំង ២ (រាយការណ៍ដោយម្ចាស់គម្រោង ៖ «icon ពេល install ពី Chrome មក desktop សល់គែមស និងមិនសូវច្បាស់» ·
 *    «logo ZoeKeyGen សល់គែមសខ្លួនឯង») — វាស់ **ភីកសែលពិត** នៃ PNG ដែល ship មិនមែនឈ្មោះឯកសារ ៖
 *    ១. icon `any` ៖ ជ្រុងថ្លា (alpha 0) ហើយ **គ្មានភីកសែលស/ស្រាលក្បែរគែម** (PNG ZoeKeyGen ដើមមានជ្រុងសពិត)
 *    ២. icon `maskable` និង `apple-touch-icon` ៖ ពេញផ្ទៃ មិនថ្លាសូម្បីតែភីកសែលមួយ (Chrome/iOS កាត់រាងខ្លួនឯង ➜ ផ្ទៃថ្លាក្លាយជាពណ៌ស/ខ្មៅ)
 *    ៣. ទំហំក្នុង manifest = ទំហំពិតរបស់ PNG · `any` និង `maskable` ជាធាតុដាច់ (មិនមែន `"any maskable"`) · maskable ≥ 1024 (Retina)
 *    ៤. logo ក្នុង App (`<img>` ក្នុង ZoeKeyGen) ជា icon `any` (ជ្រុងថ្លា)
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';

const APP = path.resolve(__dirname, '..');
const SETS = [
    { name: 'ZoeW', dir: path.join(APP, 'public'), html: path.join(APP, 'index.html') },
    { name: 'ZoeKeyGen', dir: path.join(APP, '..', 'ZoeKeyGen'), html: path.join(APP, '..', 'ZoeKeyGen', 'index.html') }
];

function decodePng(file: string) {
    const buf = fs.readFileSync(file);
    expect(buf.subarray(0, 8).toString('hex'), file).toBe('89504e470d0a1a0a');
    let at = 8, w = 0, h = 0, depth = 0, color = 0, interlace = 0;
    const idat: Buffer[] = [];
    while (at < buf.length) {
        const len = buf.readUInt32BE(at);
        const type = buf.toString('ascii', at + 4, at + 8);
        const data = buf.subarray(at + 8, at + 8 + len);
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; color = data[9]; interlace = data[12]; }
        if (type === 'IDAT') idat.push(data);
        at += 12 + len;
    }
    expect({ depth, color, interlace }, file + ' ត្រូវជា RGBA 8-bit មិន interlace').toEqual({ depth: 8, color: 6, interlace: 0 });
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = w * 4;
    const px = Buffer.alloc(stride * h);
    for (let y = 0; y < h; y++) {
        const f = raw[y * (stride + 1)];
        for (let i = 0; i < stride; i++) {
            const x = raw[y * (stride + 1) + 1 + i];
            const a = i >= 4 ? px[y * stride + i - 4] : 0;
            const b = y ? px[(y - 1) * stride + i] : 0;
            const c = i >= 4 && y ? px[(y - 1) * stride + i - 4] : 0;
            let pred = 0;
            if (f === 1) pred = a; else if (f === 2) pred = b; else if (f === 3) pred = (a + b) >> 1;
            else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); pred = pa <= pb && pa <= pc ? a : (pb <= pc ? b : c); }
            px[y * stride + i] = (x + pred) & 0xff;
        }
    }
    const at4 = (x: number, y: number) => Array.from(px.subarray((y * w + x) * 4, (y * w + x) * 4 + 4));
    return { w, h, at: at4 };
}

/** ភីកសែលស/ស្រាល (មិនថ្លា) ក្នុងចម្ងាយ ≤ band ពីគែមរូប ➜ «គែមស» */
function whiteEdgePixels(img: ReturnType<typeof decodePng>, band: number) {
    const bad: string[] = [];
    for (let y = 0; y < img.h; y++) {
        for (let x = 0; x < img.w; x++) {
            if (Math.min(x, y, img.w - 1 - x, img.h - 1 - y) > band) continue;
            const [r, g, b, a] = img.at(x, y);
            if (a > 32 && r > 225 && g > 225 && b > 225) bad.push(x + ',' + y);
        }
    }
    return bad;
}

for (const set of SETS) {
    const manifest = JSON.parse(fs.readFileSync(path.join(set.dir, 'manifest.json'), 'utf8'));
    const icons: Array<{ src: string; sizes: string; purpose: string }> = manifest.icons || [];
    const file = (src: string) => path.join(set.dir, src.replace(/^\.?\//, ''));

    describe(set.name + ' ៖ icon PWA', () => {
        it('any និង maskable ជាធាតុដាច់ · ទំហំ manifest = ទំហំពិត · maskable ≥ 1024', () => {
            expect(icons.filter((i) => i.purpose === 'any').length).toBeGreaterThanOrEqual(2);
            expect(icons.filter((i) => i.purpose === 'maskable').length).toBeGreaterThanOrEqual(2);
            expect(icons.filter((i) => /\s/.test(String(i.purpose)))).toEqual([]);
            for (const i of icons) {
                const img = decodePng(file(i.src));
                expect(i.sizes, i.src).toBe(img.w + 'x' + img.h);
            }
            expect(Math.max(...icons.filter((i) => i.purpose === 'maskable').map((i) => parseInt(i.sizes, 10)))).toBeGreaterThanOrEqual(1024);
        });

        it('any ៖ ជ្រុងថ្លា · គ្មានគែមស', () => {
            for (const i of icons.filter((x) => x.purpose === 'any')) {
                const img = decodePng(file(i.src));
                for (const [x, y] of [[0, 0], [img.w - 1, 0], [0, img.h - 1], [img.w - 1, img.h - 1]]) {
                    expect(img.at(x, y)[3], i.src + ' ជ្រុង ' + x + ',' + y).toBe(0);
                }
                expect(whiteEdgePixels(img, Math.round(img.w * 0.12)).slice(0, 5), i.src).toEqual([]);
            }
        });

        it('maskable · apple-touch-icon ៖ ពេញផ្ទៃ (គ្មានភីកសែលថ្លា) · គ្មានគែមស', () => {
            const html = fs.readFileSync(set.html, 'utf8');
            const apple = [...html.matchAll(/<link rel="apple-touch-icon"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
            expect(apple.length).toBeGreaterThan(0);
            for (const src of icons.filter((x) => x.purpose === 'maskable').map((x) => x.src).concat(apple)) {
                const img = decodePng(file(src));
                let transparent = 0;
                for (let y = 0; y < img.h; y += 3) for (let x = 0; x < img.w; x += 3) if (img.at(x, y)[3] < 255) transparent++;
                expect(transparent, src).toBe(0);
                expect(whiteEdgePixels(img, 2).slice(0, 5), src).toEqual([]);
            }
        });
    });
}

describe('ZoeKeyGen ៖ logo ក្នុង App ជា icon any', () => {
    it('<img> ក្នុង navbar/boot ចង្អុល icon any (ជ្រុងថ្លា) មិនមែន maskable', () => {
        const html = fs.readFileSync(SETS[1].html, 'utf8');
        const srcs = [...html.matchAll(/<img class="app-icon-mark" src="([^"]+)"/g)].map((m) => m[1]);
        const manifest = JSON.parse(fs.readFileSync(path.join(SETS[1].dir, 'manifest.json'), 'utf8'));
        const any = manifest.icons.filter((i: any) => i.purpose === 'any').map((i: any) => i.src);
        expect(srcs.length).toBeGreaterThanOrEqual(2);
        for (const s of srcs) expect(any).toContain(s);
    });
});
