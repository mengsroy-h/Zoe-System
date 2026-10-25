export function cleanupServerRead(getAt: (path: string) => any, afterRead?: (path: string) => void) {
    return async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        if (!/\.firebaseio\.com$/.test(url.hostname) || !url.pathname.endsWith('.json') || (init?.method && init.method !== 'GET')) throw new Error('Unexpected fixture request: ' + input);
        const path = decodeURIComponent(url.pathname.slice(1, -5));
        const value = getAt(path);
        afterRead?.(path);
        return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
}
