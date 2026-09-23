/**
 * ⛔ `PtrIndicator` (React) ជាអ្នកគូរធាតុនេះ ➜ កូដកាយវិការត្រូវ **រក** វា
 *    មិនមែន **សាង** វា។
 *
 * ⛔ ផ្លូវសាងជំនួសត្រូវរក្សាទុក ៖ បើសំបក React ប្តូរថ្ងៃណា PTR មិនត្រូវ
 *    ងាប់ស្ងាត់ៗលើ iPhone ដែលយើងសាកមិនបានទេ (ច្បាប់ «ការការពារដែលងាប់ =
 *    គ្មានការការពារ»)។ វាមិនមែនផ្លូវធម្មតាទេ — `App` គូរ `PtrIndicator`
 *    មុន `useLayoutEffect` រត់ ➜ ការស្វែងរកជោគជ័យជានិច្ច។
 */
export function ptrIndicatorElement(): any {
    const found = document.querySelector('.ptr-indicator');
    if (found) return found;

    const made = document.createElement('div');
    made.className = 'ptr-indicator';
    made.setAttribute('aria-hidden', 'true');
    const spinner = document.createElement('div');
    spinner.className = 'ptr-spinner';
    made.appendChild(spinner);
    document.body.appendChild(made);
    return made;
}
