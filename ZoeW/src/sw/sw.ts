/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

declare const __CACHE_VERSION__: string;
declare const __CORE_SHELL__: string[];
declare const __OPTIONAL_SHELL__: string[];

const CACHE_VERSION = __CACHE_VERSION__;
const CORE_SHELL = __CORE_SHELL__;
const OPTIONAL_SHELL = __OPTIONAL_SHELL__;

const FRESH: RequestCache = 'no-cache';

const SHELL_PATHS = new Set(
    CORE_SHELL.concat(OPTIONAL_SHELL).map((url) => new URL(url, self.location.href).pathname)
);

self.addEventListener('install', (event: ExtendableEvent) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(CORE_SHELL.map((url) => new Request(url, { cache: FRESH }))).then(() => Promise.all(
                OPTIONAL_SHELL.map((url) => cache.add(new Request(url, { cache: FRESH })).catch(() => {}))
            )))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => (key.startsWith('zoew-') || key.startsWith('zoeadmin-')) && key !== CACHE_VERSION).map((key) => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

const GUIDE_PATH = new URL('./guide.html', self.location.href).pathname;
const GUIDE_PRETTY_PATH = GUIDE_PATH.replace(/\.html$/, '');

function cacheKeyFor(request: Request): string | Request {
    const url = new URL(request.url);
    if (request.mode === 'navigate') {
        return url.pathname === GUIDE_PATH || url.pathname === GUIDE_PRETTY_PATH ? './guide.html' : './index.html';
    }
    return SHELL_PATHS.has(url.pathname) ? url.pathname : request;
}

function linkIsFrugal(): boolean {
    const nav = navigator as any;
    const link = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (!link) return false;
    if (link.saveData === true) return true;
    const type = String(link.effectiveType || '');
    return type === 'slow-2g' || type === '2g';
}

const REVALIDATE_TIMEOUT_MS = 6000;
const REVALIDATE_MAX_IN_FLIGHT = 3;
const revalidateInFlight = new Set<string>();

const DEPLOY_CHECK_TTL_MS = 60000;
let deployCheck: { at: number; current: Promise<boolean> } | null = null;

function shellDeployIsCurrent(): Promise<boolean> {
    const now = Date.now();
    if (deployCheck && now >= deployCheck.at && now - deployCheck.at < DEPLOY_CHECK_TTL_MS) return deployCheck.current;
    const controller: AbortController | null = typeof AbortController === 'function' ? new AbortController() : null;
    const markers = ["'" + CACHE_VERSION + "'", '"' + CACHE_VERSION + '"'];
    const current = new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (same: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(same);
        };
        const timer = setTimeout(() => {
            finish(false);
            if (controller) { try { controller.abort(); } catch (e) {} }
        }, REVALIDATE_TIMEOUT_MS);
        Promise.resolve().then(() => fetch(self.location.href, controller ? { signal: controller.signal, cache: FRESH } : { cache: FRESH }))
            .then((response) => (!settled && response && response.ok ? response.text() : ''))
            .then((text) => finish(markers.some((marker) => text.indexOf(marker) !== -1)), () => finish(false));
    });
    deployCheck = { at: now, current };
    return current;
}

function revalidateShell(cache: Cache, request: Request, cacheKey: string | Request): Promise<void> {
    if ((navigator.onLine as boolean) === false) return Promise.resolve();
    if (linkIsFrugal()) return Promise.resolve();
    const key = typeof cacheKey === 'string' ? cacheKey : request.url;
    if (/\.html$/i.test(key)) return Promise.resolve();
    if (revalidateInFlight.has(key)) return Promise.resolve();
    if (revalidateInFlight.size >= REVALIDATE_MAX_IN_FLIGHT) return Promise.resolve();
    revalidateInFlight.add(key);

    const controller: AbortController | null = typeof AbortController === 'function' ? new AbortController() : null;
    return new Promise<void>((resolve) => {
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            clearTimeout(timer);
            revalidateInFlight.delete(key);
            resolve();
        };
        const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
            release();
            if (controller) { try { controller.abort(); } catch (e) {} }
        }, REVALIDATE_TIMEOUT_MS);

        const target = typeof cacheKey === 'string' ? cacheKey : request;
        shellDeployIsCurrent().then((current) => {
            if (!current || released) return;
            return fetch(target, controller ? { signal: controller.signal, cache: FRESH } : { cache: FRESH }).then((response) => {
                if (released || !response || !response.ok || response.redirected) return;
                return cache.put(cacheKey, response.clone());
            });
        }).then(release, release);
    });
}

const NETWORK_TIMEOUT_MS = 20000;

function timedFetch(request: RequestInfo, options?: RequestInit): Promise<Response> {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const sourceSignal: AbortSignal | null = (options && options.signal) || ((request as Request) && (request as Request).signal) || null;
    const opts: RequestInit | undefined = controller ? Object.assign({}, options || {}, { signal: controller.signal }) : options;
    return new Promise<Response>((resolve, reject) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const stop = () => {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
            if (sourceSignal && typeof sourceSignal.removeEventListener === 'function') {
                sourceSignal.removeEventListener('abort', abortFromSource);
            }
        };
        const abortFromSource = () => {
            if (settled) return;
            settled = true;
            if (controller) { try { controller.abort(); } catch (e) {} }
            stop();
            const err: any = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
        };
        if (sourceSignal && typeof sourceSignal.addEventListener === 'function') {
            if (sourceSignal.aborted) {
                abortFromSource();
                return;
            }
            sourceSignal.addEventListener('abort', abortFromSource, { once: true });
        }
        timer = setTimeout(() => {
            timer = null;
            if (settled) return;
            settled = true;
            if (controller) { try { controller.abort(); } catch (e) {} }
            stop();
            const err: any = new Error('Network timed out');
            err.name = 'AbortError';
            reject(err);
        }, NETWORK_TIMEOUT_MS);
        fetch(request, opts).then((response) => {
            if (settled) return;
            settled = true;
            stop();
            resolve(response);
        }, (err) => {
            if (settled) return;
            settled = true;
            stop();
            reject(err);
        });
    });
}

function networkOnly(request: RequestInfo, options?: RequestInit): Promise<Response> {
    return timedFetch(request, options).then((response) => response || Response.error(), () => Response.error());
}

self.addEventListener('fetch', (event: FetchEvent) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/.netlify/functions/')) {
        event.respondWith(networkOnly(request));
        return;
    }

    const cacheKey = cacheKeyFor(request);
    const isShell = typeof cacheKey === 'string';
    const networkTarget = request.mode === 'navigate' ? cacheKey : request;
    const networkOptions: RequestInit | undefined = request.mode === 'navigate'
        ? { signal: request.signal, cache: FRESH }
        : (isShell ? { cache: FRESH } : undefined);

    event.respondWith(
        caches.open(CACHE_VERSION).then((cache) =>
            cache.match(cacheKey).then((cached) => {
                if (cached && isShell) {
                    try { event.waitUntil(revalidateShell(cache, request, cacheKey)); }
                    catch (e) { revalidateShell(cache, request, cacheKey); }
                    return cached;
                }

                const networkFetch = timedFetch(networkTarget, networkOptions)
                    .then((response) => {
                        if (isShell && response && response.ok && !response.redirected) cache.put(cacheKey, response.clone()).catch(() => {});
                        return response;
                    })
                    .catch(() => null);

                if (!cached) {
                    return networkFetch.then((response) => {
                        if (response) return response;
                        if (request.mode !== 'navigate') return Response.error();
                        return cache.match('./index.html').then((fallback) => fallback || Response.error(), () => Response.error());
                    });
                }

                return Promise.race([
                    networkFetch.then((response) => response || cached),
                    new Promise((resolve) => setTimeout(() => resolve(cached), 3000))
                ]);
            }, () => networkOnly(networkTarget, networkOptions))
        ).catch(() => networkOnly(networkTarget, networkOptions))
    );
});
