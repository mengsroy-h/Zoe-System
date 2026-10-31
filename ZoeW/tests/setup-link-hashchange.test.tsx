// Re-audit ៖ ZoeKeyGen puts every Setup Link in the fragment (`#setup=`). Opening one in a tab or PWA window that already shows ZoeW
// only changes the fragment ➜ no reload, and the boot read never sees it: the link did nothing while its payload stayed in the address
// bar and history. The boot listens for `hashchange` and reads the link the same way (PIN gate · no auto-save · removed from the URL).
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as boot from '../src/app/lifecycle/boot';
import { createLifecycleScope } from '../src/app/lifecycle/scope';
import { securityState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';

vi.mock('../src/services/firebase-init', () => ({ initFirebase: vi.fn(), loadSupabaseFb: vi.fn() }));

const PAYLOAD = btoa(JSON.stringify({ apiKey: 'k', databaseURL: 'https://biz-b.firebaseio.com', projectId: 'biz-b' }));
let scope: ReturnType<typeof createLifecycleScope>;
const before = window.location.href;

beforeEach(() => {
    appLocalStore.clear();
    securityState.pinTargetAction = null;
    (window as any).happyDOM.setURL('https://zoew.example/');
    scope = createLifecycleScope();
});
afterEach(() => {
    scope.dispose();
    securityState.pinTargetAction = null;
    (window as any).happyDOM.setURL(before);
});

const navigate = (hash: string) => {
    window.history.replaceState(null, '', '/' + hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
};

it('a #setup= link opened in a running tab ➜ PIN gate · the payload leaves the URL', () => {
    expect(typeof (boot as any).listenSetupLinkNavigation, 'boot listens for links opened in a running tab').toBe('function');
    (boot as any).listenSetupLinkNavigation(scope);
    navigate('#setup=' + encodeURIComponent(PAYLOAD));
    expect(window.location.hash).toBe('');
    expect(typeof securityState.pinTargetAction).toBe('function');
});

it('control ៖ another fragment is left alone · a disposed scope no longer reads links', () => {
    expect(typeof (boot as any).listenSetupLinkNavigation).toBe('function');
    (boot as any).listenSetupLinkNavigation(scope);
    navigate('#other');
    expect({ hash: window.location.hash, gate: securityState.pinTargetAction }).toEqual({ hash: '#other', gate: null });
    scope.dispose();
    navigate('#setup=' + encodeURIComponent(PAYLOAD));
    expect(securityState.pinTargetAction).toBe(null);
});
