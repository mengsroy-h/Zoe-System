if (window.Sentry && typeof window.Sentry.onLoad === 'function') {
    window.Sentry.onLoad(function () {
        try { window.Sentry.setTag('app', 'zoekeygen'); } catch (e) {}
    });
}

try {
    const whenDomReady = function (fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
        else fn();
    };

    whenDomReady(function () {
        const link = document.getElementById('webFontCss');
        if (link && link.media !== 'all') link.media = 'all';
    });

    whenDomReady(function () {
        setTimeout(function () {
            const splash = document.getElementById('bootSplash');
            if (!splash || splash.classList.contains('boot-splash-out')) return;
            splash.classList.add('boot-splash-out');
            setTimeout(function () { splash.classList.add('boot-splash-gone'); }, 700);
        }, 6000);
    });
} catch (e) {}
