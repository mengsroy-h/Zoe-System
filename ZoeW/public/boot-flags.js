try {
    const isIOSStandalone = window.navigator.standalone === true;
    if (isIOSStandalone) document.documentElement.classList.add('ios-standalone');
    let isNativeAndroid = false;
    try {
        const cap = window.Capacitor;
        isNativeAndroid = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform() &&
            typeof cap.getPlatform === 'function' && cap.getPlatform() === 'android');
    } catch (e) {}
    if (isNativeAndroid) document.documentElement.classList.add('native-android');
    const ptrReloadPending = sessionStorage.getItem('zoew_ptr_reload_pending') === '1';
    if ((isIOSStandalone || isNativeAndroid) && ptrReloadPending && 'scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    if (ptrReloadPending) document.documentElement.classList.add('boot-instant');
} catch (e) {}

try {
    const whenDomReady = function (fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
        else fn();
    };

    whenDomReady(function () {
        const link = document.getElementById('webFontCss');
        if (link && link.media !== 'all') link.media = 'all';
    });
} catch (e) {}
