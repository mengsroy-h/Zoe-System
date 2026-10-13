import { afterEach, describe, it, expect, vi } from 'vitest';
import { createSupabaseTransport, SB_AUTH_STORAGE_KEY } from '../src/services/supabase-transport';
const lab = vi.hoisted(() => ({ client: null as any }));
vi.mock('@supabase/supabase-js', async importOriginal => {
  const actual: any = await importOriginal();
  return { ...actual, createClient: (...args: any[]) => { lab.client = actual.createClient(...args); return lab.client; } };
});
const turn = async () => { for (let i = 0; i < 35; i++) await Promise.resolve(); };
async function ready() {
  vi.stubGlobal('BroadcastChannel', undefined);
  const rows = new Map<string, string>();
  rows.set(SB_AUTH_STORAGE_KEY, JSON.stringify({ access_token: 'A.token.x', refresh_token: 'r-A', token_type: 'bearer',
    expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'A', aud: 'authenticated' } }));
  const storage = { getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => rows.set(k, v), removeItem: (k: string) => rows.delete(k) };
  const transport = createSupabaseTransport({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' },
    { localStorage: storage, sessionStorage: storage, eventTarget: new EventTarget(), fetch: async () => new Response(null, { status: 204 }) });
  await transport.restoreSession();
  vi.spyOn(lab.client.realtime, 'setAuth').mockResolvedValue(undefined);
  vi.spyOn(lab.client, 'removeChannel').mockResolvedValue('ok');
  let broadcast: any, status: any;
  const channel = { on: (_: any, __: any, fn: any) => { broadcast = fn; return channel; }, subscribe: (fn: any) => { status = fn; return channel; } };
  const createChannel = vi.spyOn(lab.client, 'channel').mockReturnValue(channel);
  return { transport, createChannel, broadcast: () => broadcast, status: () => status };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('Realtime callbacks and pending subscription ownership', () => {
  it('a token lookup resolving after transport close cannot create a channel', async () => {
    const r = await ready();
    r.transport.subscribe('zoe:A', vi.fn(), vi.fn());
    r.transport.close(); await turn();
    expect(r.createChannel).not.toHaveBeenCalled();
  });
  it('unsubscribed channels ignore already queued broadcast and status callbacks', async () => {
    const r = await ready(); const event = vi.fn(), status = vi.fn();
    const off = r.transport.subscribe('zoe:A', event, status);
    await turn(); expect(r.createChannel).toHaveBeenCalledOnce();
    r.broadcast()({ payload: { seq: 1 } }); r.status()('SUBSCRIBED');
    expect(event).toHaveBeenCalledOnce(); expect(status).toHaveBeenCalledOnce();
    off(); r.broadcast()({ payload: { seq: 90 } }); r.status()('CHANNEL_ERROR');
    r.transport.close();
    expect(event).toHaveBeenCalledOnce(); expect(status).toHaveBeenCalledOnce();
  });
  it('cancelled token failures cannot announce a new channel error', async () => {
    const r = await ready(); const status = vi.fn();
    let reject!: (error: Error) => void;
    vi.spyOn(lab.client.auth, 'getSession').mockReturnValue(new Promise((_, no) => { reject = no; }));
    const off = r.transport.subscribe('zoe:A', vi.fn(), status);
    off(); reject(new Error('stale token failure')); await turn(); r.transport.close();
    expect(status).not.toHaveBeenCalled();
  });
});
