try {
    const isIOSStandalone = window.navigator.standalone === true;
    if (isIOSStandalone) document.documentElement.classList.add('ios-standalone');
    if (isIOSStandalone && sessionStorage.getItem('zoew_ptr_reload_pending') === '1' && 'scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
} catch (e) {}
