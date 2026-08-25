try {
    const whenDomReady = function (fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
        else fn();
    };

    whenDomReady(function () {
        setTimeout(function () {
            const splash = document.getElementById('bootSplash');
            if (!splash || splash.classList.contains('boot-splash-out')) return;
            splash.classList.add('boot-splash-out');
            setTimeout(function () { splash.classList.add('boot-splash-gone'); }, 700);
        }, 6000);
    });
} catch (e) {}
