/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

declare const __CACHE_VERSION__: string;
declare const __CORE_SHELL__: string[];
declare const __OPTIONAL_SHELL__: string[];
declare const __BACKEND_SHELL__: string[];

const CACHE_VERSION = __CACHE_VERSION__;
const CORE_SHELL = __CORE_SHELL__;
const OPTIONAL_SHELL = __OPTIONAL_SHELL__;
const BACKEND_SHELL = __BACKEND_SHELL__;

const FRESH: RequestCache = 'no-cache';

const pathOf = (url: string): string => new URL(url, self.location.href).pathname;

const SHELL_PATHS = new Set(
    CORE_SHELL.concat(OPTIONAL_SHELL, BACKEND_SHELL).map(pathOf)
);

const BACKEND_PATHS = new Set(BACKEND_SHELL.map(pathOf));
const BACKEND_PREFIXES = BACKEND_SHELL.map((url) => pathOf(url).replace(/-[^-/]+\.js$/, '-'));
const SHELL_SCHEME_KEY = './__zoew-shell-scheme';
const BACKEND_USED_KEY = './__zoew-backend-used';

function cacheUsedBackend(cache: Cache): Promise<{ used: boolean; marked: boolean }> {
    return cache.match(SHELL_SCHEME_KEY).then((scheme) => {
        if (scheme) return cache.match(BACKEND_USED_KEY).then((used) => ({ used: !!used, marked: !!used }));
        return cache.keys().then((requests) => ({
            used: requests.some((r) => BACKEND_PREFIXES.some((prefix) => new URL(r.url).pathname.startsWith(prefix))),
            marked: false
        }));
    });
}

function previousBackendUse(): Promise<{ used: boolean; marked: boolean }> {
    if (!BACKEND_SHELL.length) return Promise.resolve({ used: false, marked: false });
    return caches.keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith('zoew-') && key !== CACHE_VERSION).map((key) => caches.open(key).then(cacheUsedBackend))))
        .then((results) => ({ used: results.some((r) => r.used), marked: results.some((r) => r.marked) }), () => ({ used: false, marked: false }));
}

function noteBackendUse(cache: Cache): Promise<void> {
    return cache.match(BACKEND_USED_KEY).then((seen) => (seen ? undefined : cache.put(BACKEND_USED_KEY, new Response('1')))).catch(() => {});
}

const OPTIONAL_INSTALL_TIMEOUT_MS = 20000;

function addOptionalShell(cache: Cache, url: string): Promise<void> {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const request = new Request(url, controller ? { cache: FRESH, signal: controller.signal } : { cache: FRESH });
    return new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
            if (controller) { try { controller.abort(); } catch (e) {} }
            resolve();
        }, OPTIONAL_INSTALL_TIMEOUT_MS);
        cache.add(request).catch(() => {}).then(() => {
            clearTimeout(timer);
            resolve();
        });
    });
}

self.addEventListener('install', (event: ExtendableEvent) => {
    event.waitUntil(
        Promise.all([caches.open(CACHE_VERSION), previousBackendUse()])
            .then(([cache, backend]) => cache.addAll(CORE_SHELL.concat(backend.used ? BACKEND_SHELL : []).map((url) => new Request(url, { cache: FRESH })))
                .then(() => cache.put(SHELL_SCHEME_KEY, new Response('1')))
                .then(() => (backend.marked ? cache.put(BACKEND_USED_KEY, new Response('1')) : undefined))
                .then(() => Promise.all(
                    OPTIONAL_SHELL.map((url) => addOptionalShell(cache, url))
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

function responseFitsKey(cacheKey: string | Request, response: Response): boolean {
    if (typeof cacheKey !== 'string' || /\.html$/i.test(cacheKey) || /\/$/.test(cacheKey)) return true;
    return !/^\s*text\/html\b/i.test(response.headers.get('content-type') || '');
}

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
                if (released || !response || !response.ok || response.redirected || !responseFitsKey(cacheKey, response)) return;
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
                if (BACKEND_PATHS.has(url.pathname)) {
                    try { event.waitUntil(noteBackendUse(cache)); }
                    catch (e) { noteBackendUse(cache); }
                }
                if (cached && isShell) {
                    try { event.waitUntil(revalidateShell(cache, request, cacheKey)); }
                    catch (e) { revalidateShell(cache, request, cacheKey); }
                    return cached;
                }

                const networkFetch = timedFetch(networkTarget, networkOptions)
                    .then((response) => {
                        if (isShell && response && response.ok && !response.redirected && responseFitsKey(cacheKey, response)) cache.put(cacheKey, response.clone()).catch(() => {});
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

const PUSH_TITLE_MAX = 120;
const PUSH_BODY_MAX = 240;

function pushOpenUrl(raw: unknown): string {
    try {
        const url = new URL(typeof raw === 'string' && raw ? raw : './?notify=1', self.registration.scope);
        return url.origin === self.location.origin ? url.href : new URL('./?notify=1', self.registration.scope).href;
    } catch (e) {
        return self.registration.scope;
    }
}

function readPushData(event: PushEvent): Record<string, unknown> {
    try {
        const data = event.data ? event.data.json() : null;
        return data && typeof data === 'object' ? data : {};
    } catch (e) {
        return {};
    }
}

self.addEventListener('push', (event: PushEvent) => {
    const data = readPushData(event);
    const title = String(data.title || 'ZoeW').slice(0, PUSH_TITLE_MAX);
    const body = String(data.body || '').slice(0, PUSH_BODY_MAX);
    const tag = String(data.tag || 'zoew').slice(0, 64);
    const options: NotificationOptions & Record<string, unknown> = {
        body: body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: tag,
        renotify: true,
        timestamp: Date.now(),
        data: { url: pushOpenUrl(data.url) }
    };
    const nav = self.navigator as any;
    event.waitUntil(Promise.all([
        self.registration.showNotification(title, options),
        Promise.resolve().then(() => (nav && typeof nav.setAppBadge === 'function' ? nav.setAppBadge() : null)).catch(() => {}),
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((list) => list.forEach((client) => client.postMessage({ type: 'zoew-push' })))
            .catch(() => {})
    ]));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close();
    const target = pushOpenUrl(event.notification.data && event.notification.data.url);
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            const client = list.find((c) => new URL(c.url).origin === self.location.origin) as WindowClient | undefined;
            if (client) {
                client.postMessage({ type: 'zoew-open-notify' });
                return client.focus().catch(() => self.clients.openWindow(target));
            }
            return self.clients.openWindow(target);
        }).catch(() => self.clients.openWindow(target))
    );
});
