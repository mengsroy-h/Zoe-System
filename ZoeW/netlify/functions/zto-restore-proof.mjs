import * as blobs from '@netlify/blobs';
import core from './_shared/zto-order-detail-core.cjs';
import proof from './_shared/zto-restore-proof.cjs';
import firebase from './_shared/zto-restore-firebase.cjs';

const lookup = core.createTrustedRestoreHandler(blobs);
const env = new Proxy({}, {
    get(_target, key) {
        if (typeof key !== 'string') return undefined;
        return globalThis.Netlify?.env?.get(key) ?? process.env[key];
    }
});
const handler = proof.createRestoreProofHandler({ env, lookup,
    firebaseBackend: firebase.createFirebaseBackend({ verifyActor: core.verifyRestoreFirebaseActor }) });

export default async function restoreProof(request) {
    return handler(request);
}
