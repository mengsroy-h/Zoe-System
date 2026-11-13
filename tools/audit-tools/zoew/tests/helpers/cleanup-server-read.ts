export function cleanupServerRead(getAt: (path: string) => any, afterRead?: (path: string) => void) {
    return async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        if (!/\.firebaseio\.com$/.test(url.hostname) || !url.pathname.endsWith('.json') || (init?.method && init.method !== 'GET')) throw new Error('Unexpected fixture request: ' + input);
        const path = decodeURIComponent(url.pathname.slice(1, -5));
        let value = getAt(path);
        const orderBy = url.searchParams.get('orderBy');
        if (orderBy !== null) {
            if (orderBy !== '"$key"') throw new Error('Unexpected fixture query: ' + input);
            const startAt = url.searchParams.has('startAt') ? JSON.parse(url.searchParams.get('startAt')!) : null;
            const endAt = url.searchParams.has('endAt') ? JSON.parse(url.searchParams.get('endAt')!) : null;
            const picked: Record<string, unknown> = {};
            Object.keys(value && typeof value === 'object' ? value : {}).sort().forEach((key) => {
                if ((startAt === null || key >= startAt) && (endAt === null || key <= endAt)) picked[key] = value[key];
            });
            value = Object.keys(picked).length ? picked : null;
        }
        afterRead?.(path);
        return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
}
