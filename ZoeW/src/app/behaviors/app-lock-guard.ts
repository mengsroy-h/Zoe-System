import { APP_LOCK_EXCUSE_SELECTOR, noteAppLockAway, noteAppLockExcuse, relockAppAfterAway } from '../../features/app-lock';

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
