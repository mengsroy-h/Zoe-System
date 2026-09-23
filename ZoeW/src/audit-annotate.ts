/**
 * ⛔ សម្រាប់តែ build វាស់ (`audit-compat.ts` · `scripts/build-audit.mjs`) — **មិនដែលចូលផលិតកម្ម**។
 *
 * checker ដើមអាន/ចុចធាតុតាម attribute ផ្ទេរសកម្មភាព (`data-act` · `data-args` · `data-on` · `data-evt` ·
 * `data-self`) ដែល App ដើមសរសេរក្នុង `index.html`។ ក្នុង React សកម្មភាពរស់ជា **prop** (`onClick={onAct('x')}`)
 * ហើយ `onAct()` ដាក់ `actionName`/`actionOptions` លើ handler ➜ អត្ថន័យដដែល តែគ្មាន attribute។
 *
 * function នេះ **អាន prop ពិតរបស់ React** ពីធាតុ DOM (`__reactProps$…`) ហើយសរសេរ attribute ដដែលនឹង App ដើម
 * ➜ checker វាស់ **សកម្មភាពដែល React ចងពិត** (ការចុចនៅតែទៅដល់ `onClick` របស់ React)។
 * ⛔ វាមិនបន្ថែមឥរិយាបថណាមួយទេ ៖ attribute ជាទិន្នន័យពិពណ៌នា (React មិនស្តាប់វា)។
 */

const EVENT_PROPS: Array<[string, string]> = [['onClick', 'click'], ['onChange', 'change'], ['onInput', 'input'], ['onSubmit', 'submit']];

/** សរសេរ `data-act` … លើធាតុក្រោម `root` ដែល React ចង `onAct()` — ត្រឡប់ចំនួនធាតុ */
export function annotateActions(root: Element): number {
    let count = 0;
    const all = [root, ...Array.from(root.querySelectorAll('*'))];
    for (const el of all) {
        const key = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
        if (!key) continue;
        const props = (el as any)[key];
        if (!props) continue;
        for (const [prop, eventName] of EVENT_PROPS) {
            const handler = props[prop];
            if (!handler || typeof handler.actionName !== 'string') continue;
            const options = handler.actionOptions || {};
            el.setAttribute('data-act', handler.actionName);
            if (eventName !== 'click') el.setAttribute('data-on', eventName);
            if (options.args && options.args.length) el.setAttribute('data-args', JSON.stringify(options.args));
            if (options.evt) el.setAttribute('data-evt', '1');
            if (options.self) el.setAttribute('data-self', '1');
            count++;
            break;
        }
    }
    return count;
}
