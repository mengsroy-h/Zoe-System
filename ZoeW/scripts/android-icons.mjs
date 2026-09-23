/**
 * បង្កើត logo និង splash របស់ App Android ពី `resources/icon.svg` (រូបមេតែមួយ)។
 *
 *   npm run android:icons
 *
 * ⛔ រូបមេគឺ icon របស់ PWA ដដែល (ប្រអប់ក្រហម · គូបស) ➜ App Android និង web
 *    មើលទៅជាផលិតផលតែមួយ។ ការប្តូរ logo ៖ កែ `resources/icon.svg` រួចរត់ឡើងវិញ។
 * ⛔ Adaptive icon (Android 8+) ៖ ផ្ទៃក្រោយ = gradient ក្រហម (vector) ·
 *    ផ្ទៃមុខ = គូបតែឯង ក្នុងតំបន់សុវត្ថិភាព 66dp · themed icon (Android 13+) =
 *    ស្រមោលគូបពណ៌តែមួយ។ Android 7 (API 24–25) ប្រើ PNG legacy ។
 * ⛔ ត្រូវការ Chromium ៖ `CHROMIUM_PATH` · `/opt/pw-browsers/chromium` ·
 *    ឬ Chrome/Edge ដែលដំឡើងរួច (Windows)។
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RES = path.join(ROOT, 'android/app/src/main/res');
const svg = fs.readFileSync(path.join(ROOT, 'resources/icon.svg'), 'utf8');
const SPLASH_BG = '#f8fafc';

if (!fs.existsSync(RES)) {
    console.error('⛔ រក android/app/src/main/res មិនឃើញ — រត់ `npx cap add android` ជាមុន');
    process.exit(2);
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SPLASH = {
    'drawable': [480, 320],
    'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280],
    'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920],
    'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720],
    'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280]
};

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

const browser = await launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body style="margin:0"></body></html>');

/**
 * គូររូបមេតាមរបៀប (`mode`) ក្នុង canvas ទំហំ w×h រួចត្រឡប់ PNG ជា base64។
 *   full       ៖ icon ពេញ (ប្រអប់មូលជ្រុង) — legacy ic_launcher
 *   round      ៖ រង្វង់ក្រហម + គូប — legacy ic_launcher_round
 *   foreground ៖ គូបតែឯង ក្នុង canvas 108dp (adaptive)
 *   monochrome ៖ ស្រមោលគូប (បន្ទាត់ត្រូវកាត់ចេញ) — themed icon
 *   splash     ៖ icon ពេញ កណ្តាលផ្ទៃភ្លឺ
 */
async function render(mode, w, h) {
    return page.evaluate(async ({ svg, mode, w, h, splashBg }) => {
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const root = doc.documentElement;
        const plate = doc.getElementById('plate');
        const seam = doc.getElementById('seam');
        if (mode === 'round') {
            plate.innerHTML = '<circle cx="256" cy="256" r="256" fill="url(#bg)"/>';
        } else if (mode === 'foreground') {
            plate.remove();
        } else if (mode === 'monochrome') {
            plate.remove();
            const cube = doc.getElementById('cube');
            cube.querySelectorAll('path').forEach((p) => { if (p !== seam) { p.setAttribute('fill', '#ffffff'); p.setAttribute('stroke', '#ffffff'); } });
            seam.setAttribute('stroke', '#000000');
            const defs = doc.querySelector('defs');
            defs.insertAdjacentHTML('beforeend', '<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="#fff"/><path d="M256 269 L256 400" stroke="#000" stroke-width="10" stroke-linecap="round"/></mask>');
            seam.remove();
            cube.setAttribute('mask', 'url(#cut)');
        }
        const text = new XMLSerializer().serializeToString(root);
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text)));
        await img.decode();
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        if (mode === 'splash') {
            g.fillStyle = splashBg;
            g.fillRect(0, 0, w, h);
            const size = Math.round(Math.min(w, h) * 0.34);
            g.drawImage(img, Math.round((w - size) / 2), Math.round((h - size) / 2), size, size);
        } else if (mode === 'foreground' || mode === 'monochrome') {
            // 512 ឯកតា ↔ 72dp (ផ្ទៃដែល launcher បង្ហាញ) ក្នុង canvas 108dp
            const inner = w * 72 / 108;
            const off = (w - inner) / 2;
            g.drawImage(img, off, off, inner, inner);
        } else {
            g.drawImage(img, 0, 0, w, h);
        }
        return c.toDataURL('image/png').split(',')[1];
    }, { svg, mode, w, h, splashBg: SPLASH_BG });
}

function write(rel, b64) {
    const file = path.join(RES, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    return rel;
}

const written = [];
for (const [density, scale] of Object.entries(DENSITIES)) {
    const legacy = Math.round(48 * scale);
    const adaptive = Math.round(108 * scale);
    written.push(write(`mipmap-${density}/ic_launcher.png`, await render('full', legacy, legacy)));
    written.push(write(`mipmap-${density}/ic_launcher_round.png`, await render('round', legacy, legacy)));
    written.push(write(`mipmap-${density}/ic_launcher_foreground.png`, await render('foreground', adaptive, adaptive)));
    written.push(write(`mipmap-${density}/ic_launcher_monochrome.png`, await render('monochrome', adaptive, adaptive)));
}
for (const [dir, [w, h]] of Object.entries(SPLASH)) {
    written.push(write(`${dir}/splash.png`, await render('splash', w, h)));
}
await browser.close();
console.log(`✅ បង្កើតរូប ${written.length} ក្នុង android/app/src/main/res`);
