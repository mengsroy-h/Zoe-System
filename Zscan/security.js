(function () {
    function kickUserOut() {
        window.location.replace("about:blank");
    }
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let devToolsHitCount = 0;

    document.addEventListener('keydown', function (e) {
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c' || e.key === 'K' || e.key === 'k')) ||
            (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's')) ||
            (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c' || e.key === 'U' || e.key === 'u' || e.key === 'K' || e.key === 'k'))
        ) {
            e.preventDefault(); e.stopPropagation(); kickUserOut(); return false;
        }
    }, true);

    document.addEventListener('contextmenu', function (e) { e.preventDefault(); return false; }, true);

    function checkDevToolsBySize() {
        if (isMobile) return;
        const widthThreshold = window.outerWidth - window.innerWidth > 160;
        const heightThreshold = window.outerHeight - window.innerHeight > 160;
        if (widthThreshold || heightThreshold) {
            devToolsHitCount++;
            if (devToolsHitCount >= 2) kickUserOut();
        } else {
            devToolsHitCount = 0;
        }
    }

    let consoleOpenHitCount = 0;
    function checkDevToolsByConsole() {
        if (isMobile) return;
        let triggered = false;
        const probe = { get id() { triggered = true; return ''; } };
        console.log('%c', probe);
        if (triggered) {
            consoleOpenHitCount++;
            if (consoleOpenHitCount >= 2) kickUserOut();
        } else {
            consoleOpenHitCount = 0;
        }
    }

    function secureDebugger() {
        if (isMobile) return;
        function probe() { debugger; }
        function loop() {
            const startTime = performance.now();
            try { probe(); } catch (e) {}
            const endTime = performance.now();
            if (endTime - startTime > 1000) kickUserOut();
        }
        setInterval(loop, 1000);
    }

    setInterval(checkDevToolsBySize, 1000);
    setInterval(checkDevToolsByConsole, 1500);
    secureDebugger();
})();
