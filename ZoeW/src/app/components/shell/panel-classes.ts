/** class របស់ទំព័រ (`.app-page` + `active`) */
export function pageClass(active: boolean): string {
    return active ? 'app-page active' : 'app-page';
}

/**
 * class របស់ `.page-side` ៖ `collapsed` (ប្រវត្តិពេញអេក្រង់) · `search-focus`
 * (ប្រអប់ស្វែងរកទាញឡើង) — ⛔ តំបន់ហាមចូល (`CLAUDE.md` ច្បាប់ ១១) ៖ state
 * ទាំងនេះសរសេរដោយកាយវិការ (`app/behaviors/panel-motion.ts`) ហើយ **ចុះ DOM
 * ភ្លាម** (`commitNow()`) មុនការវាស់ FLIP ដូចការប្តូរ class ផ្ទាល់របស់ដើម។
 */
export function panelSectionClass(base: string, collapsed: boolean, searchFocus: boolean): string {
    let cls = base;
    if (collapsed) cls += ' collapsed';
    if (searchFocus) cls += ' search-focus';
    return cls;
}
