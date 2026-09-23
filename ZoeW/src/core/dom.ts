/**
 * អ្នកចូលដំណើរការ DOM តែមួយ។
 *
 * ⛔ វាត្រឡប់ `any` **ដោយចេតនា** ៖ កូដដែលផ្ទេរពី `app.js` មិនដែលពិនិត្យ
 * `null` ទេ ហើយការបន្ថែមការពិនិត្យថ្មី **ជាការប្តូរឥរិយាបថ** — មិនមែន
 * ការបន្ថែមសុវត្ថិភាព។ ការចង type ពិតត្រូវធ្វើ *តាមធាតុម្តងមួយៗ*
 * ក្នុងកូដថ្មី (មើល `elInput()` · `elButton()` ខាងក្រោម)។
 */

export function byId(id: string): any {
    return document.getElementById(id);
}

export function qs(selector: string, root: ParentNode = document): any {
    return root.querySelector(selector);
}

export function qsa(selector: string, root: ParentNode = document): any[] {
    return Array.from(root.querySelectorAll(selector));
}

/* ── អ្នកចូលដំណើរការដែលមាន type ពិត (សម្រាប់កូដថ្មី) ─────────────── */

export function elInput(id: string): HTMLInputElement | null {
    const el = document.getElementById(id);
    return el instanceof HTMLInputElement ? el : null;
}

export function elButton(id: string): HTMLButtonElement | null {
    const el = document.getElementById(id);
    return el instanceof HTMLButtonElement ? el : null;
}

export function elDiv(id: string): HTMLElement | null {
    const el = document.getElementById(id);
    return el instanceof HTMLElement ? el : null;
}
