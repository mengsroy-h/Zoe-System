export function pageClass(active: boolean): string {
    return active ? 'app-page active' : 'app-page';
}

export function panelSectionClass(base: string, collapsed: boolean, searchFocus: boolean): string {
    let cls = base;
    if (collapsed) cls += ' collapsed';
    if (searchFocus) cls += ' search-focus';
    return cls;
}
