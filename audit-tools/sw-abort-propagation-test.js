const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.SWABORT_APP_DIR || path.join(__dirname, '..');

async function checkApp(app) {
    const source = fs.readFileSync(path.join(ROOT, app, 'sw.js'), 'utf8');
    let capturedSignal = null;
    const self = {
        location: { href: 'https://example.test/', origin: 'https://example.test' },
        addEventListener: () => {},
        skipWaiting: () => Promise.resolve(),
        clients: { claim: () => Promise.resolve() }
    };
    const context = vm.createContext({
        self,
        URL,
        Set,
        Map,
        Promise,
        Error,
        AbortController,
        navigator: { onLine: true },
        caches: {
            open: () => Promise.resolve({ addAll: () => Promise.resolve(), add: () => Promise.resolve() }),
            keys: () => Promise.resolve([]),
            delete: () => Promise.resolve(true)
        },
        Response: { error: () => ({ ok: false }) },
        setTimeout,
        clearTimeout,
        fetch: (request, options) => {
            capturedSignal = options && options.signal;
            return new Promise((resolve, reject) => {
                if (!capturedSignal) return;
                const abort = () => {
                    const error = new Error('aborted');
                    error.name = 'AbortError';
                    reject(error);
                };
                if (capturedSignal.aborted) abort();
                else capturedSignal.addEventListener('abort', abort, { once: true });
            });
        }
    });
    vm.runInContext(source, context, { filename: app + '/sw.js' });
    const caller = new AbortController();
    const request = { url: 'https://example.test/.netlify/functions/zto-order-detail', signal: caller.signal };
    const pending = context.timedFetch(request).then(() => 'resolved', (error) => error && error.name);
    caller.abort();
    const result = await Promise.race([
        pending,
        new Promise((resolve) => setTimeout(() => resolve('still-pending'), 80))
    ]);
    return { app, linked: capturedSignal && capturedSignal.aborted === true && result === 'AbortError', result, forwarded: !!(capturedSignal && capturedSignal.aborted) };
}

(async () => {
    const results = [];
    for (const app of ['ZoeW', 'ZoeKeyGen']) results.push(await checkApp(app));
    const failed = results.filter((result) => !result.linked);
    if (failed.length) {
        console.error('sw-abort-propagation-test: FAIL', failed);
        process.exit(1);
    }
    console.log('sw-abort-propagation-test: ok', results.map((result) => result.app).join(', '));
    process.exit(0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
