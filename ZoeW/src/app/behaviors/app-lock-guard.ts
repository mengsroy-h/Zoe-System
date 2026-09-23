import { APP_LOCK_EXCUSE_SELECTOR, noteAppLockAway, noteAppLockExcuse, relockAppAfterAway } from '../../features/app-lock';

/**
 * ការចុចដែល «ចាកចេញពី App ដោយចេតនា» (ខល · អ៊ីមែល · ទាញយក · ជ្រើសឯកសារ) ➜
 * ត្រឡប់មកវិញមិនសុំ PIN (`CLAUDE.md` ៖ «ចាក់សោ App ពេលបើក និងពេលត្រឡប់មក»)។
 *
 * ⛔ វាអានតែ **គោលដៅនៃព្រឹត្តិការណ៍** (`closest`) ➜ វារស់នៅស្រទាប់ React
 *    (`src/app`) មិនមែនក្នុងកូដមុខងារ។ `label.control` = ធាតុដែល label ចង
 *    (ដូច `getElementById(label.htmlFor)` ដើម សម្រាប់ `<input>`)។
 */
export function appLockClickIsExcusable(target) {
    if (!target || typeof target.closest !== 'function') return false;
    if (target.closest(APP_LOCK_EXCUSE_SELECTOR)) return true;
    const label = target.closest('label[for]');
    if (!label) return false;
    const bound = label.control;
    return !!bound && bound.tagName === 'INPUT' && bound.type === 'file';
}

export function setupAppLockAwayGuard() {
    document.addEventListener('click', (e) => {
        if (appLockClickIsExcusable(e.target)) noteAppLockExcuse();
    }, true);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) noteAppLockAway();
        else relockAppAfterAway();
    });
}
