/**
 * រូបភាពអេក្រង់ទាំងមូល — ប្រើរួមដោយ `parity-live` និង `parity-deep`
 * (ច្បាប់ ១២ ៖ ច្បាប់ចម្លង ២ ➜ ជុំក្រោយកែមួយ ភ្លេចមួយ)។
 *
 * ⛔ រត់ **ក្នុង browser** តាម `page.evaluate(SNAPSHOT)` ➜ គ្មាន closure ខាងក្រៅ។
 */
export const SNAPSHOT = (opts) => {
    const skipToasts = !!(opts && opts.skipToasts);
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
        count++;
        const attrs = Array.from(el.attributes)
            .filter((a) => !SKIP.includes(a.name))
            .map((a) => a.name + '=' + (a.name === 'style' ? normStyle(a.value) : (a.name === 'class' ? dropTransient(a.value) : a.value)))
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
        out.push(`${'  '.repeat(Math.min(depth, 10))}${el.tagName}[${attrs}]{${cs.display}}${live}${text ? '::' + text : ''}`);
        for (const c of el.children) walk(c, depth + 1);
    };
    for (const c of document.body.children) walk(c, 0);
    return { elements: count, tree: out.join('\n') };
};
