/**
 * រូបភាពអេក្រង់ទាំងមូល — ប្រើរួមដោយ `parity-live` និង `parity-deep`
 * (ច្បាប់ ១២ ៖ ច្បាប់ចម្លង ២ ➜ ជុំក្រោយកែមួយ ភ្លេចមួយ)។
 *
 * ⛔ រត់ **ក្នុង browser** តាម `page.evaluate(SNAPSHOT)` ➜ គ្មាន closure ខាងក្រៅ។
 */
/**
 * ⛔ ការខុសគ្នា **ដោយចេតនា** ពី App ដើម (ZoeW ≤ 2.37.3) ដែលការប្រៀប parity ទាំង ៣ (`parity:dom` · `parity:live` · `parity:deep`)
 *    ត្រូវមិនរាប់ — បញ្ជីតែមួយនេះ (ច្បាប់ ១២) ៖ បើអត់ គ្រប់ជំហានក្រហម ➜ ការខុសគ្នាពិតលិចក្នុងសំលេងរំខាន (វាស់បាន ៖ `parity:deep`
 *    ក្រហម ៧៩/៧៩ តាំងពី 2.43.0 ដោយមានតែ ២ ប្រភេទនៃការខុសគ្នា ហើយគ្មាននរណារត់វា)។ ⛔ បន្ថែមធាតុ **តែ** ពេលកំណែ App ពិតជាបន្ថែម/ផ្លាស់
 *    ផ្ទៃនោះ ហើយសរសេរកំណែជាប់ — កុំប្រើវាដើម្បីបិទការខុសគ្នាដែលមិនយល់។
 *    · `skip` ៖ ផ្ទៃបន្ថែម/ផ្លាស់ទី — ផ្ទាំង 🔔 និងប៊ូតុងរបស់វា (2.43.0) · «Powered By ZoeW» ផ្លាស់ពី navbar ចូលជើងផ្ទាំង 🔔 (2.43.0) ·
 *      ល្បឿនស៊ុម/កំណែ WebView និង «ស៊ុមកក» ក្នុងជើងរបា Slide (2.42.11 · 2.45.1 · 2.45.2 ៖ លេខវាស់ពី browser តាមពេល)
 *    · `opaque` ៖ logo (ផ្ទាំង boot · navbar) ប្តូរពីអក្សរ «Zoe» ទៅ App icon SVG (2.43.0) ➜ ប្រៀបធាតុខ្លួនវា មិនមែនមាតិកាខាងក្នុង
 *    · `floating` ៖ ម៉ឺនុយ (...) និងប្រអប់ណែនាំលេខ ជាស្រទាប់ `position: fixed` ដែលតាំងតាមធាតុយុថ្កា ➜ `top`/`left` ជាលទ្ធផល layout
 *      (navbar ទាបជាងដើម ១៤px ក្រោយ «Powered By» ផ្លាស់ចេញ · 2.43.0) មិនមែនឥរិយាបថ ➜ ប្រៀបតែ display · ទទឹង
 *    · `navbarShrinkPx` ៖ navbar លើទូរស័ព្ទទាបជាងដើម **១៤px តែប៉ុណ្ណោះ** (65 ➜ 51 · 2.43.0) ➜ `parity:dom` ទទួលយក **តែ** ការរំកិល
 *      ឡើងលើ ១៤px និងកម្ពស់បន្ថែម ១៤px របស់ផ្ទាំងដែលបំពេញអេក្រង់ — x · ទទឹង · តម្លៃ CSS ផ្សេងទៀត ត្រូវដូចដើមបេះបិទ
 */
export const INTENTIONAL_UI = {
    skip: '#navNotifyBtn, #notifyDrawer, .notify-backdrop, .app-navbar .credit-tag, #displayRateLine, #jankLine',
    opaque: '.boot-splash-logo, .brand-logo',
    floating: '#globalMoreMenu, #phoneSuggestBox',
    navbarShrinkPx: 14
};

export const SNAPSHOT = (opts) => {
    const skipToasts = !!(opts && opts.skipToasts);
    const ui = (opts && opts.ui) || { skip: '', opaque: '', floating: '' };
    const matches = (el, sel) => !!(sel && el.matches && el.matches(sel));
    const probe = document.createElement('div');
    const normStyle = (v) => { probe.style.cssText = ''; probe.style.cssText = v; return Array.from(probe.style).map((p) => p + ':' + probe.style.getPropertyValue(p)).sort().join(';'); };
    const SKIP = ['data-act', 'data-args', 'data-a1', 'data-a2', 'data-evt', 'data-self', 'data-on', 'data-sig', 'data-id'];
    // ⛔ `connecting` ជា class **បណ្ដោះអាសន្ន** នៃ handshake ➜ ការសម្រាប់
    //    វានៅចំណុចពេលតែមួយ ជាការវាស់ដែលមិនស្ថិតស្ថេរ (flaky)។ អត្ថបទ
    //    ស្ថានភាពពិត (`#firebaseStatusText`) នៅត្រូវប្រៀបធៀបដដែល។
    const dropTransient = (v) => v.split(/\s+/).filter((c) => c !== 'connecting').join(' ');
    const out = [];
    let count = 0;
    const walk = (el, depth) => {
        if (el.id === 'root' && el.tagName === 'DIV') { for (const c of el.children) walk(c, depth); return; }
        if (el.tagName === 'SCRIPT' || el.tagName === 'LINK' || el.tagName === 'STYLE') return;
        // ⛔ toast ជា *សារតាមពេល* ៖ ការឃើញវានៅចំណុចពេលមួយអាស្រ័យលើពេលបណ្តាញឆ្លើយ
        //    ➜ `parity-deep` ប្រៀបធៀបវាជា **កំណត់ហេតុសារ** ជំនួស (skipToasts)។
        if (skipToasts && el.classList && el.classList.contains('toast')) return;
        if (matches(el, ui.skip)) return;
        count++;
        const floating = matches(el, ui.floating);
        const styleOf = (v) => (floating ? normStyle(v).split(';').filter((d) => !/^(top|left):/.test(d)).join(';') : normStyle(v));
        const attrs = Array.from(el.attributes)
            .filter((a) => !SKIP.includes(a.name))
            .map((a) => a.name + '=' + (a.name === 'style' ? styleOf(a.value) : (a.name === 'class' ? dropTransient(a.value) : a.value)))
            .filter((s) => s !== 'class=')
            .sort().join('|');
        // ⛔ ស្លាកកំណែ **ខុសគ្នាដោយចេតនា** (App ថ្មីមានកំណែថ្មី) ➜ ធ្វើឲ្យស្មើតែស្លាកនោះ
        const text = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.data).join('').replace(/\s+/g, ' ').trim()
            .replace(/^(កំណែប្រព័ន្ធ: )\d+\.\d+\.\d+$/, '$1<កំណែ>');
        const cs = getComputedStyle(el);
        // ⛔ តម្លៃរបស់ form control ជាស្ថានភាពដែលអ្នកប្រើឃើញ ➜ វាត្រូវចូល
        //    ការប្រៀបធៀបដែរ (attribute `value` មិនប្រែពេលវាយ)។
        const live = (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')
            ? '=' + JSON.stringify(el.type === 'checkbox' ? el.checked : el.value) : '';
        const opaqueLogo = matches(el, ui.opaque);
        out.push(`${'  '.repeat(Math.min(depth, 10))}${el.tagName}[${attrs}]{${cs.display}}${live}${text && !opaqueLogo ? '::' + text : ''}`);
        if (opaqueLogo) return;
        for (const c of el.children) walk(c, depth + 1);
    };
    for (const c of document.body.children) walk(c, 0);
    return { elements: count, tree: out.join('\n') };
};
