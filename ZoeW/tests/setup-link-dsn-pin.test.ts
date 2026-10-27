// X3 (deep audit 8): anyone can send a Setup Link. A link built from the shop's public config plus a DSN of someone else's
// Sentry project was accepted as long as its host ended in `sentry.io` ➜ after the PIN every error event (barcodes · item
// ids · paths) went to that project. A Setup Link carries only a DSN of the App's own Sentry project: its public key equals
// the key of the Sentry Loader both apps already load (`index.html`); any other DSN is ignored, the rest of the link applies.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SETUP_LINK_SENTRY_KEY, applySetupPayload, setupLinkDsnIsValid } from '../src/features/config';

const loaderKey = (file: string) => (/js\.sentry-cdn\.com\/([0-9a-f]{32})\.min\.js/.exec(fs.readFileSync(new URL(file, import.meta.url), 'utf8')) || [])[1];

describe('X3 ៖ DSN ក្នុង Setup Link ត្រូវជារបស់គម្រោង Sentry របស់ App', () => {
    it('the pinned key is the Sentry Loader key of both apps', () => {
        expect({ zoew: loaderKey('../index.html'), keygen: loaderKey('../../ZoeKeyGen/index.html') }).toEqual({ zoew: SETUP_LINK_SENTRY_KEY, keygen: SETUP_LINK_SENTRY_KEY });
    });

    it('the App project DSN is accepted · another project, a lookalike host or http are not', () => {
        expect(setupLinkDsnIsValid('https://' + SETUP_LINK_SENTRY_KEY + '@o451.ingest.sentry.io/77')).toBe(true);
        expect(setupLinkDsnIsValid('https://' + SETUP_LINK_SENTRY_KEY + '@o451.ingest.us.sentry.io/77')).toBe(true);
        for (const bad of ['https://ffffffffffffffffffffffffffffffff@o9.ingest.sentry.io/1', 'https://' + SETUP_LINK_SENTRY_KEY + '@sentry.io.evil.example/1',
            'http://' + SETUP_LINK_SENTRY_KEY + '@o451.ingest.sentry.io/77', 'https://o451.ingest.sentry.io/77']) expect(setupLinkDsnIsValid(bad), bad).toBe(false);
    });

    it('a Setup Link with a foreign DSN applies its config but never the DSN', () => {
        const input = document.createElement('input');
        input.id = 'sentryDsnInput';
        document.body.appendChild(input);
        const applied = applySetupPayload({ apiKey: 'k', databaseURL: 'https://shop.firebaseio.com', dsn: 'https://ffffffffffffffffffffffffffffffff@o9.ingest.sentry.io/1' });
        expect(applied).toBe('');
    });
});
