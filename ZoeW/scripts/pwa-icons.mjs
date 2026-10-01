/**
 * បង្កើត icon PWA របស់ App ទាំង ២ ពីរូបមេ SVG តែមួយក្នុងមួយ App ៖
 *   ZoeW      ➜ `resources/icon.svg`          ➜ `public/`
 *   ZoeKeyGen ➜ `resources/keygen-icon.svg`   ➜ `../ZoeKeyGen/`
 *
 *   node scripts/pwa-icons.mjs
 *
 * ⛔ ហេតុអ្វី (រាយការណ៍ដោយម្ចាស់គម្រោង ៖ «icon ពេល install ពី Chrome មក desktop សល់គែមស និងមិនសូវច្បាស់» ·
 *    «logo ZoeKeyGen សល់គែមសខ្លួនឯង») ៖
 *    ១. PNG ZoeKeyGen ដើមមានជ្រុង **ពណ៌សពិត** (មិនមែនថ្លា) ➜ គែមសលើ navbar · boot · icon ដំឡើង
 *    ២. manifest ប្រើរូបតែមួយជា `"any maskable"` ➜ Chrome (macOS · Android) កាត់រាង icon លើរូបដែលមានជ្រុងមូលថ្លា ➜ ចន្លោះ
 *       ជ្រុងក្លាយជាពណ៌ស · icon maskable ត្រូវ **ពេញផ្ទៃ** (គ្មានជ្រុងថ្លា) ហើយមាតិកានៅក្នុងរង្វង់សុវត្ថិភាព ៨០%
 *    ៣. ទំហំធំបំផុត 512 ➜ Dock/អេក្រង់ Retina ត្រូវការ 1024 ➜ ពង្រីក ➜ ព្រិល
 *    ⛔ `apple-touch-icon` ក៏ត្រូវពេញផ្ទៃដែរ ៖ iOS បំពេញផ្ទៃថ្លាដោយពណ៌ខ្មៅ/ស ហើយកាត់ជ្រុងខ្លួនឯង
 * ⛔ អ្នកយាម ៖ `tests/pwa-icons.test.ts` (ទំហំពិត ↔ manifest · ជ្រុង any ថ្លា · maskable/apple មិនថ្លា · គ្មានគែមស)។
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PWA_ICON_SETS = [
    { svg: path.join(ROOT, 'resources/icon.svg'), out: path.join(ROOT, 'public') },
    { svg: path.join(ROOT, 'resources/keygen-icon.svg'), out: path.join(ROOT, '..', 'ZoeKeyGen') }
];
export const PWA_ANY_SIZES = [192, 512];
export const PWA_MASKABLE_SIZES = [192, 512, 1024];

function fullBleed(svg) {
    return svg.replace(/(<g id="plate">[\s\S]*?<\/g>)/, (plate) => plate.replace(/\s+rx="\d+"/g, ''));
}

async function launch() {
    const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean);
    for (const executablePath of candidates) {
        if (fs.existsSync(executablePath)) return chromium.launch({ executablePath, args: ['--no-sandbox'] });
    }
    for (const channel of ['chrome', 'msedge']) {
        try { return await chromium.launch({ channel }); } catch { /* សាកបន្ទាប់ */ }
    }
    throw new Error('រក Chromium មិនឃើញ — កំណត់ CHROMIUM_PATH');
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}
/** PNG RGBA 8-bit ៖ filter ល្អបំផុតក្នុងមួយជួរ (ផលបូកតម្លៃដាច់តូចបំផុត) + zlib កម្រិត ៩ ➜ gradient បង្ហាប់បានល្អជាង encoder របស់ canvas */
export function encodePng(rgba, w, h) {
    const stride = w * 4;
    const out = Buffer.alloc((stride + 1) * h);
    const prev = Buffer.alloc(stride);
    const cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
    for (let y = 0; y < h; y++) {
        const row = rgba.subarray(y * stride, (y + 1) * stride);
        const up = y ? rgba.subarray((y - 1) * stride, y * stride) : prev;
        let best = 0, bestSum = Infinity;
        for (let f = 0; f < 5; f++) {
            const o = cand[f];
            let sum = 0;
            for (let i = 0; i < stride; i++) {
                const a = i >= 4 ? row[i - 4] : 0, b = up[i], c = i >= 4 ? up[i - 4] : 0;
                let pred = 0;
                if (f === 1) pred = a;
                else if (f === 2) pred = b;
                else if (f === 3) pred = (a + b) >> 1;
                else if (f === 4) {
                    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                    pred = pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
                }
                const v = (row[i] - pred) & 0xff;
                o[i] = v;
                sum += v < 128 ? v : 256 - v;
            }
            if (sum < bestSum) { bestSum = sum; best = f; }
        }
        out[y * (stride + 1)] = best;
        cand[best].copy(out, y * (stride + 1) + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(out, { level: 9, memLevel: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

async function render(page, svg, size) {
    const rgba = await page.evaluate(async ({ svg, size }) => {
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
        await img.decode();
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        x.drawImage(img, 0, 0, size, size);
        return Array.from(x.getImageData(0, 0, size, size).data);
    }, { svg, size });
    return encodePng(Buffer.from(rgba), size, size);
}

const browser = await launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body style="margin:0"></body></html>');
for (const set of PWA_ICON_SETS) {
    const svg = fs.readFileSync(set.svg, 'utf8');
    if (!/<g id="plate">/.test(svg)) throw new Error('រូបមេគ្មាន <g id="plate"> ៖ ' + set.svg);
    for (const size of PWA_ANY_SIZES) {
        fs.writeFileSync(path.join(set.out, 'icon-' + size + '.png'), await render(page, svg, size));
    }
    for (const size of PWA_MASKABLE_SIZES) {
        fs.writeFileSync(path.join(set.out, 'icon-maskable-' + size + '.png'), await render(page, fullBleed(svg), size));
    }
    console.log('✅ ' + path.relative(ROOT, set.out) + ' ៖ any ' + PWA_ANY_SIZES.join('/') + ' · maskable ' + PWA_MASKABLE_SIZES.join('/'));
}
await browser.close();
