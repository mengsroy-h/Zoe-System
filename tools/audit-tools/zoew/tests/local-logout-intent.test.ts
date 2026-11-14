import { expect, it } from 'vitest';
import { acceptLocalAuthSession, createLocalLogoutIntentStore, localAuthSessionCurrent, localLogoutIntent, LOCAL_LOGOUT_INTENT_PREFIX } from '../../../../ZoeW/src/services/local-logout-intent';
import { appLocalStore, appSessionStore } from '../../../../ZoeW/src/core/storage';

function storage() {
    const data = new Map<string, string>();
    return { data, get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null,
        getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); },
        removeItem: (key: string) => { data.delete(key); } };
}
const scope = 'fb:https://synthetic.firebaseio.com', uid = 'synthetic-user';

let sessionNumber = 0;
function acceptedFixture() {
    appLocalStore.clear(); appSessionStore.clear();
    const user = { uid: 'accepted-session-' + (++sessionNumber) }, auth = { currentUser: null as any };
    auth.currentUser = user;
    expect(localAuthSessionCurrent(auth, scope, user)).toBe(false);
    expect(acceptLocalAuthSession(auth, scope, user)).toBe(true);
    return { auth, user, other: createLocalLogoutIntentStore(appLocalStore, storage()) };
}

it('accepted session admission belongs to the actual auth, backend and current UID', () => {
    const { auth, user } = acceptedFixture();
    expect(localAuthSessionCurrent(auth, scope, user)).toBe(true);
    expect(localAuthSessionCurrent({ currentUser: user }, scope, user)).toBe(false);
    expect(localAuthSessionCurrent(auth, 'sb:https://other.supabase.co', user)).toBe(false);
    auth.currentUser = { uid: 'other-uid' };
    expect(localAuthSessionCurrent(auth, scope, auth.currentUser)).toBe(false);
    expect(acceptLocalAuthSession(auth, scope, user)).toBe(false);
    expect(acceptLocalAuthSession(auth, scope, auth.currentUser)).toBe(true);
    expect(localAuthSessionCurrent(auth, scope, auth.currentUser)).toBe(true);
});

it('accepted session cannot be refreshed by an automatic callback after foreign logout and login, even without reading during logout', () => {
    const { auth, user, other } = acceptedFixture();
    expect(other.note(scope, user.uid)).toBe(true);
    expect(other.acknowledge(scope, user.uid, other.capture(scope))).toBe(true);
    expect(localLogoutIntent.blocked(scope, user.uid)).toBe(false);
    expect(localAuthSessionCurrent(auth, scope, user)).toBe(false);
    expect(acceptLocalAuthSession(auth, scope, user)).toBe(false);
    expect(localAuthSessionCurrent(auth, scope, user)).toBe(false);
});

it('owned explicit login accepts the acknowledged intent and preserves pending evidence', () => {
    const { auth, user, other } = acceptedFixture();
    appLocalStore.setItem('synthetic-pending-journal', 'unknown-original-operation');
    expect(other.note(scope, user.uid)).toBe(true);
    expect(acceptLocalAuthSession(auth, scope, user, true)).toBe(false);
    const captured = localLogoutIntent.capture(scope);
    expect(localLogoutIntent.acknowledge(scope, user.uid, captured)).toBe(true);
    expect(acceptLocalAuthSession(auth, scope, user, true, captured)).toBe(true);
    expect(localAuthSessionCurrent(auth, scope, user)).toBe(true);
    expect(appLocalStore.getItem('synthetic-pending-journal')).toBe('unknown-original-operation');
});

it('accepted session ignores foreign scope and UID intent revisions', () => {
    const { auth, user, other } = acceptedFixture();
    other.note('sb:https://other.supabase.co', user.uid);
    other.note(scope, 'other-uid');
    expect(localAuthSessionCurrent(auth, scope, user)).toBe(true);
});

it('accepted session requires a new owned credential proof after stored backend configuration changes', () => {
    const { auth, user } = acceptedFixture();
    appLocalStore.setItem('zoew_firebase_config', '{"databaseURL":"https://other.invalid"}');
    expect(localAuthSessionCurrent(auth, scope, user)).toBe(false);
    expect(acceptLocalAuthSession(auth, scope, user)).toBe(false);
    expect(acceptLocalAuthSession(auth, scope, user, true, localLogoutIntent.capture(scope))).toBe(true);
    expect(localAuthSessionCurrent(auth, scope, user)).toBe(true);
});

it.each([undefined, null, NaN, {}, []])('accepted session rejects malformed auth identity %s without throwing', auth => {
    expect(() => acceptLocalAuthSession(auth, scope, undefined)).not.toThrow();
    expect(acceptLocalAuthSession(auth, scope, undefined)).toBe(false);
    expect(localAuthSessionCurrent(auth, scope, undefined)).toBe(false);
});

const circular: any = {}; circular.self = circular;
const malformedIdentities = [
    { label: 'undefined', value: undefined }, { label: 'null', value: null }, { label: 'NaN', value: NaN },
    { label: 'object', value: {} }, { label: 'array', value: [] }, { label: 'circular', value: circular }, { label: 'empty', value: '' }
];
for (const field of ['scope', 'uid']) it.each(malformedIdentities)(field + ' $label មិនត្រូវបើក guard ឬបង្ក exception', ({ value }) => {
    const local = storage(), session = storage(), store = createLocalLogoutIntentStore(local, session);
    const where = field === 'scope' ? value : scope, actor = field === 'uid' ? value : uid;
    expect(() => store.blocked(where, actor)).not.toThrow();
    expect(store.blocked(where, actor)).toBe(true);
    expect(() => store.capture(where)).not.toThrow();
    const captured = store.capture(where);
    if (field === 'scope') expect(captured.ready).toBe(false);
    expect(() => store.note(where, actor)).not.toThrow();
    expect(store.note(where, actor)).toBe(false);
    expect(() => store.fence(where, actor)).not.toThrow();
    expect(() => store.witness(where, actor)).not.toThrow();
    expect(store.witness(where, actor)()).toBe(false);
    expect(store.affects(where, actor, 'irrelevant')).toBe(false);
    expect(() => store.acknowledge(where, actor, captured)).not.toThrow();
    expect(store.acknowledge(where, actor, captured)).toBe(false);
    expect(local.length).toBe(0); expect(session.length).toBe(0);
    expect(store.blocked(scope, uid)).toBe(false);
});

it('normal restored session មាន storage អានបាន និងគ្មាន logout intent មិនត្រូវហាម', () => {
    const local = storage(), session = storage(), store = createLocalLogoutIntentStore(local, session);
    expect(store.blocked(scope, uid)).toBe(false);
    expect(store.capture(scope).ready).toBe(true);
});

it('logout intent រស់ក្រោយ reload ដោយមិនប៉ះ pending journals', () => {
    const local = storage(), session = storage(), store = createLocalLogoutIntentStore(local, session);
    local.setItem('synthetic-pending-journal', '{"outcome":"unknown","operation":"original"}');
    expect(store.note(scope, uid)).toBe(true);
    expect(createLocalLogoutIntentStore(local, session).blocked(scope, uid)).toBe(true);
    expect(local.getItem('synthetic-pending-journal')).toBe('{"outcome":"unknown","operation":"original"}');
});

it('explicit login ដែលមាន proof ដើមត្រូវគ្នា acknowledge intent ហើយ reload បន្ទាប់អនុញ្ញាត', () => {
    const local = storage(), session = storage(), store = createLocalLogoutIntentStore(local, session);
    store.note(scope, uid);
    expect(store.acknowledge(scope, uid, store.capture(scope))).toBe(true);
    expect(store.blocked(scope, uid)).toBe(false);
    expect(createLocalLogoutIntentStore(local, session).blocked(scope, uid)).toBe(false);
});

it('a foreign logout and acknowledgement inside local ACK read-back cannot confirm an older credential capture', () => {
    const local = storage(), session = storage(), tab = createLocalLogoutIntentStore(local, session);
    const other = createLocalLogoutIntentStore(local, storage());
    expect(tab.note(scope, uid)).toBe(true);
    const captured = tab.capture(scope), key = LOCAL_LOGOUT_INTENT_PREFIX + JSON.stringify(scope) + ':' + JSON.stringify(uid);
    const originalIntent = local.getItem(key), get = local.getItem;
    let injected = 0;
    local.getItem = name => {
        const value = get(name);
        if (!injected && name === key + ':ack' && value === originalIntent) {
            injected++;
            expect(other.note(scope, uid)).toBe(true);
            expect(other.acknowledge(scope, uid, other.capture(scope))).toBe(true);
        }
        return value;
    };
    expect(tab.acknowledge(scope, uid, captured)).toBe(false);
    expect(injected).toBe(1);
    expect(local.getItem(key)).not.toBe(originalIntent);
});

it('credential-bound witness cannot adopt a foreign logout acknowledged after its own ACK returned', () => {
    const local = storage(), session = storage(), tab = createLocalLogoutIntentStore(local, session);
    const other = createLocalLogoutIntentStore(local, storage());
    expect(tab.note(scope, uid)).toBe(true);
    const captured = tab.capture(scope);
    expect(tab.acknowledge(scope, uid, captured)).toBe(true);
    expect(tab.witness(scope, uid, captured)()).toBe(true);
    expect(other.note(scope, uid)).toBe(true);
    expect(other.acknowledge(scope, uid, other.capture(scope))).toBe(true);
    expect(tab.blocked(scope, uid)).toBe(false);
    expect(tab.witness(scope, uid, captured)()).toBe(false);
});

it.each([null, NaN, {}, [], { ready: true, scope, stores: [] }, { ready: true, scope, stores: [{}, {}] }])('malformed original credential capture %j fails closed without throwing', captured => {
    const tab = createLocalLogoutIntentStore(storage(), storage());
    expect(() => tab.witness(scope, uid, captured)).not.toThrow();
    expect(tab.witness(scope, uid, captured)()).toBe(false);
});

it('explicit accepted session keeps the original credential capture across the ACK-to-acceptance boundary', () => {
    const { auth, user, other } = acceptedFixture();
    const captured = localLogoutIntent.capture(scope);
    expect(localLogoutIntent.acknowledge(scope, user.uid, captured)).toBe(true);
    expect(other.note(scope, user.uid)).toBe(true);
    expect(other.acknowledge(scope, user.uid, other.capture(scope))).toBe(true);
    expect(localLogoutIntent.blocked(scope, user.uid)).toBe(false);
    expect(acceptLocalAuthSession(auth, scope, user, true, captured)).toBe(false);
    expect(localAuthSessionCurrent(auth, scope, user)).toBe(false);
});

it('scope និង UID មិនអាចបិទ ឬសម្អាត intent របស់គណនី/Backend ផ្សេង', () => {
    const local = storage(), session = storage(), store = createLocalLogoutIntentStore(local, session);
    store.note(scope, uid);
    expect(store.blocked('sb:https://synthetic.supabase.co', uid)).toBe(false);
    expect(store.blocked(scope, 'other-user')).toBe(false);
    expect(store.acknowledge(scope, 'other-user', store.capture(scope))).toBe(true);
    expect(store.blocked(scope, uid)).toBe(true);
    expect(store.acknowledge('sb:https://synthetic.supabase.co', uid, store.capture(scope))).toBe(false);
});

it('logout ថ្មីក្នុង credential request មិនត្រូវ acknowledge ដោយ login ចាស់', () => {
    const local = storage(), session = storage(), store = createLocalLogoutIntentStore(local, session);
    const before = store.capture(scope);
    store.note(scope, uid);
    expect(store.acknowledge(scope, uid, before)).toBe(false);
    expect(store.blocked(scope, uid)).toBe(true);
});

it('login មិនស្គាល់ UID មុន response ក៏មិនអាច consume logout ថ្មីរបស់ UID នោះ', () => {
    const local = storage(), session = storage(), store = createLocalLogoutIntentStore(local, session);
    store.note(scope, 'old-user');
    const before = store.capture(scope);
    store.note(scope, 'new-user');
    expect(store.acknowledge(scope, 'new-user', before)).toBe(false);
    expect(store.blocked(scope, 'new-user')).toBe(true);
});

it('logout តាម tab ផ្សេងក្នុង acknowledgement មិនបាត់ដោយ stale acknowledgement', () => {
    const local = storage(), session = storage(), store = createLocalLogoutIntentStore(local, session);
    store.note(scope, uid);
    const before = store.capture(scope), put = local.setItem;
    let raced = false;
    local.setItem = (key, value) => {
        put(key, value);
        if (!raced && key.endsWith(':ack')) { raced = true; createLocalLogoutIntentStore(local, session).note(scope, uid); }
    };
    expect(store.acknowledge(scope, uid, before)).toBe(false);
    expect(createLocalLogoutIntentStore(local, session).blocked(scope, uid)).toBe(true);
});

it.each(['local', 'session', 'both'])('storage %s អានមិនបាន បិទ automatic restoration', kind => {
    const local = storage(), session = storage();
    if (kind !== 'session') local.getItem = () => { throw new Error('synthetic unavailable'); };
    if (kind !== 'local') session.getItem = () => { throw new Error('synthetic unavailable'); };
    const store = createLocalLogoutIntentStore(local, session);
    expect(store.blocked(scope, uid)).toBe(true);
    expect(store.capture(scope).ready).toBe(false);
    expect(store.acknowledge(scope, uid, store.capture(scope))).toBe(false);
});

it('local write បរាជ័យ៖ session storage រក្សា same-tab intent តែមិនអះអាង cross-tab durability', () => {
    const local = storage(), session = storage();
    local.setItem = () => { throw new Error('synthetic quota'); };
    const store = createLocalLogoutIntentStore(local, session);
    expect(store.note(scope, uid)).toBe(false);
    expect(createLocalLogoutIntentStore(local, session).blocked(scope, uid)).toBe(true);
    expect(createLocalLogoutIntentStore(local, storage()).blocked(scope, uid)).toBe(false);
});

it('គ្មាន storage សរសេរបាន មិនអះអាង durable logout ហើយ current page នៅហាម', () => {
    const local = storage(), session = storage();
    local.setItem = session.setItem = () => { throw new Error('synthetic storage refusal'); };
    const store = createLocalLogoutIntentStore(local, session);
    expect(store.note(scope, uid)).toBe(false);
    expect(store.blocked(scope, uid)).toBe(true);
});

it('acknowledgement សរសេរមិនចូល មិនដោះ intent', () => {
    const local = storage(), session = storage(), store = createLocalLogoutIntentStore(local, session);
    store.note(scope, uid);
    const before = store.capture(scope);
    session.setItem = () => { throw new Error('synthetic storage refusal'); };
    expect(store.acknowledge(scope, uid, before)).toBe(false);
    expect(store.blocked(scope, uid)).toBe(true);
});

it('intent ខូចមិនត្រូវចាត់ថាគ្មាន logout', () => {
    const local = storage(), session = storage();
    local.setItem(LOCAL_LOGOUT_INTENT_PREFIX + JSON.stringify(scope) + ':' + JSON.stringify(uid), '');
    const store = createLocalLogoutIntentStore(local, session);
    expect(store.blocked(scope, uid)).toBe(true);
    expect(store.capture(scope).ready).toBe(false);
});


it('initial implicit witnesses retain an unacknowledged capture while owned credential witnesses remain usable', () => {
    const local = storage(), tab = createLocalLogoutIntentStore(local, storage()), other = createLocalLogoutIntentStore(local, storage());
    expect(other.note(scope, uid)).toBe(true);
    const captured = tab.capture(scope);
    expect(captured.ready).toBe(true); expect(tab.blocked(scope, uid)).toBe(true);
    expect(other.acknowledge(scope, uid, other.capture(scope))).toBe(true);
    expect(tab.blocked(scope, uid)).toBe(false);
    expect(tab.witness(scope, uid, captured, true)()).toBe(false);
    expect(tab.witness(scope, uid, captured)()).toBe(true);
    expect(tab.witness(scope, uid, tab.capture(scope), true)()).toBe(true);
});

it('startup witness mode rejects missing capture proof and malformed mode without throwing', () => {
    const tab = createLocalLogoutIntentStore(storage(), storage());
    expect(tab.witness(scope, uid, undefined, true)()).toBe(false);
    expect(tab.witness(scope, uid, tab.capture(scope), null as any)()).toBe(false);
    expect(tab.witness(scope, uid, tab.capture(scope), true)()).toBe(true);
});
