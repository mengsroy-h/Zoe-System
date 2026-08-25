if (window.Sentry && typeof window.Sentry.onLoad === 'function') {
    window.Sentry.onLoad(function () {
        try { window.Sentry.setTag('app', 'zoekeygen'); } catch (e) {}
    });
}
