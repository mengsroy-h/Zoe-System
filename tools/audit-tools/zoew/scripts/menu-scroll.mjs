/**
 * ម៉ឺនុយ (...) ↔ ការរមូរ — helper សម្រាប់ harness ដែលចុចម៉ឺនុយ (...) (`cleanup-rules-check.mjs`)។
 *
 * App បិទម៉ឺនុយ (...) លើ **រាល់** ព្រឹត្តិការណ៍ `scroll` (capture លើ `window` ·
 * លើកលែងការរមូរខាងក្នុងម៉ឺនុយ) — ឥរិយាបថដោយចេតនា (`src/app/lifecycle/boot.ts` ៖ `startGlobalDismissals`)។
 * តែ `#appPages` មាន `scroll-snap-type: y proximity` ➜ ក្រោយការប្តូរទំព័រ browser អាច **snap ឡើងវិញ** តាមម៉ោង **ពិត**
 * (ឯករាជ្យពីនាឡិកា JS ដែល harness ផ្អាក) ➜ ការ snap នោះអាចបាញ់ **ក្រោយ** harness បើកម៉ឺនុយ ➜ ធាតុម៉ឺនុយ «មើលមិនឃើញ»
 * ➜ `page.click` ផុត ៥ វិ.។ វាស់បាន ៖ `#appPages` 0 ➜ 369 (ចំណុច snap របស់ `.page-main`) ខណៈម៉ឺនុយ `display:block` ·
 * ធ្លាក់ម្តងម្កាលលើ build ណាមួយ (CI ៖ Android) ទាំងដែលគ្មាននរណាកែ។
 *
 * ⛔ ការកែជា **រចនាសម្ព័ន្ធ** ពីរជាន់ ៖
 *   ១. `scrollQuiet()` ៖ រង់ចាំការរមូរស្ងប់ **មុន** ចុចប៊ូតុងបើក (ដូចអ្នកប្រើដែលចុចពេលអេក្រង់ឈប់)។
 *   ២. `openMenuItem()` ៖ បើកម៉ឺនុយម្តងទៀត **តែពេលវាស់ឃើញ** ព្រឹត្តិការណ៍ `scroll` ក្រោយការបើក (មូលហេតុបិទតែមួយ
 *      ដែល App ចង្អុល) · ពិដាន `tries` · ម៉ឺនុយដែលមិនបើក/បិទ **ដោយគ្មានការរមូរ** ➜ **ធ្លាក់** (⛔ មិនមែនការចុចម្តងទៀត
 *      ឥតលក្ខខណ្ឌ ៖ វានឹងលាក់ម៉ឺនុយដែលមិនបើកពិត)។
 * ⛔ កុំ «កែ» វាដោយបិទ scroll-snap ឬការបិទម៉ឺនុយលើ scroll ក្នុង App — តំបន់ហាមចូល (`CLAUDE.md` ច្បាប់ ១១)។
 */

/** ⛔ ត្រូវចាក់តាម `addInitScript` មុន script របស់ App · រាប់ដូចអ្វីដែល App ប្រើបិទម៉ឺនុយ (លើកលែងការរមូរខាងក្នុងម៉ឺនុយ) */
export const SCROLL_PROBE = `window.__scrollEvents = 0; window.addEventListener('scroll', (e) => {
    const menu = document.getElementById('globalMoreMenu');
    const t = e.target;
    if (menu && t && t.nodeType === 1 && menu.contains(t)) return;
    window.__scrollEvents++;
}, { capture: true, passive: true });`;

const SCROLL_SETTLE_MS = 10000;
const scrollCount = (p) => p.evaluate(() => window.__scrollEvents || 0);

/** ការរមូរស្ងប់ = `window.__scrollEvents` មិនប្រែ ៣ ដងជាប់ៗ (ចន្លោះ ៨០ms ម៉ោងពិត) */
export async function scrollQuiet(p, settleMs = SCROLL_SETTLE_MS) {
    const deadline = Date.now() + settleMs;
    let last = -1;
    let still = 0;
    for (;;) {
        const n = await scrollCount(p);
        still = n === last ? still + 1 : 0;
        last = n;
        if (still >= 3) return;
        if (Date.now() > deadline) throw new Error('ការរមូរមិនស្ងប់ក្នុង ' + settleMs / 1000 + ' វិ.');
        await p.waitForTimeout(80);
    }
}

/**
 * បើកម៉ឺនុយដោយ `opener` ➜ ចុច `item`។ `tick(p)` = អ្វីដែល harness រំកិលនាឡិកាក្រោយការចុច។
 * ត្រឡប់ចំនួនការបើក (១ = ធម្មតា · > ១ = ការរមូររបស់ browser បិទវា ហើយត្រូវបើកម្តងទៀត)។
 */
export async function openMenuItem(p, opener, item, { tick, timeout = 5000, tries = 3 } = {}) {
    for (let attempt = 1; ; attempt++) {
        await scrollQuiet(p);
        const before = await scrollCount(p);
        await p.click(opener, { timeout });
        if (tick) await tick(p);
        let clickError = null;
        if (await p.isVisible(item)) {
            try {
                await p.click(item, { timeout });
                return attempt;
            } catch (e) {
                clickError = e;
            }
        }
        const scrolled = (await scrollCount(p)) !== before;
        if (!scrolled) {
            if (clickError) throw clickError;
            throw new Error('ម៉ឺនុយ (...) មិនបើកដោយគ្មានការរមូរ ៖ ' + opener + ' ➜ ' + item);
        }
        if (attempt >= tries) throw new Error('ម៉ឺនុយ (...) ត្រូវការរមូរបិទ ' + tries + ' ដងជាប់ៗ ៖ ' + opener + ' ➜ ' + item);
    }
}
