import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { initFirebase } from '../src/services/firebase-init';

const sb = vi.hoisted(() => ({ sdk: null as any }));
vi.mock('../src/services/supabase-backend', () => ({ createZoeSupabaseSdk: () => sb.sdk }));

const REF_FIELDS = ['dbRefDailyRevenue', 'dbRefMonthlyRevenue', 'dbRefDailyPickup', 'dbRefDailyCollected', 'dbRefHistory', 'dbRefDeleted', 'dbRefExchangeRate', 'dbRefConnected', 'dbRefServerTimeOffset'] as const;

function fakeSdk(name: string, supabase: boolean) {
    let apps: any[] = [];
    const off: any[] = [];
    const sdk: any = {
        getApps: () => apps,
        deleteApp: async () => { apps = []; },
        initializeApp: () => { const a = { name }; apps.push(a); return a; },
        getAuth: () => ({ currentUser: null, owner: name }),
        getDatabase: () => ({ name }),
        goOnline() {},
        off: (ref: any) => { off.push(ref); },
        ref: (db: any, path: string) => ({ owner: name, db, path }),
        onValue: () => () => {},
        onAuthStateChanged: () => () => {}
    };
    if (supabase) sdk.__supabase = true;
    return { sdk, off, seedApp: () => { apps = [{ name }]; } };
}

function installOld(old: ReturnType<typeof fakeSdk>) {
    old.seedApp();
    firebaseState.fb = old.sdk;
    firebaseState.db = { name: 'old' } as any;
    for (const field of REF_FIELDS) (firebaseState as any)[field] = { owner: 'old', path: field };
}
const oldRefs = (list: any[]) => list.filter((r) => r && r.owner === 'old').map((r) => r.path).sort();

beforeEach(() => {
    vi.useFakeTimers();
    firebaseState.authGeneration++;
    firebaseState.isInitializingFirebase = false;
});
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    delete (window as any).firebaseSDK;
    appLocalStore.clear();
});

describe('backend switch (NETWORK-2) ៖ the old listeners are detached through the SDK that attached them', () => {
    it('1. Firebase ➜ Supabase ៖ every old ref is detached by the old Firebase SDK · the new SDK never receives an old ref', async () => {
        const old = fakeSdk('fb-old', false);
        installOld(old);
        const next = fakeSdk('sb-new', true);
        sb.sdk = next.sdk;
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' }));
        expect(await initFirebase()).toBe(true);
        expect(firebaseState.fb).toBe(next.sdk);
        expect(oldRefs(old.off)).toEqual([...REF_FIELDS].sort());
        expect(oldRefs(next.off)).toEqual([]);
    });

    it('2. Supabase ➜ Firebase ៖ every old ref is detached by the old Supabase SDK · the new SDK never receives an old ref', async () => {
        const old = fakeSdk('sb-old', true);
        installOld(old);
        const next = fakeSdk('fb-new', false);
        (window as any).firebaseSDK = next.sdk;
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'test', databaseURL: 'https://next.firebaseio.com' }));
        expect(await initFirebase()).toBe(true);
        expect(oldRefs(old.off)).toEqual([...REF_FIELDS].sort());
        expect(oldRefs(next.off)).toEqual([]);
    });

    it('3. reverse ៖ Firebase project ➜ Firebase project (one SDK) ៖ the old refs are still detached', async () => {
        const one = fakeSdk('fb', false);
        installOld(one);
        (window as any).firebaseSDK = one.sdk;
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'test', databaseURL: 'https://next.firebaseio.com' }));
        expect(await initFirebase()).toBe(true);
        expect(oldRefs(one.off)).toEqual([...REF_FIELDS].sort());
    });
});
