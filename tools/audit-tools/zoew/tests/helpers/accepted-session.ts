import { firebaseState } from '../../../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../../../ZoeW/src/core/storage';
import { loginBackendScope } from '../../../../../ZoeW/src/features/login-memory';
import { acceptLocalAuthSession } from '../../../../../ZoeW/src/services/local-logout-intent';

let nextBackend = 0;

export function configureFixtureBackend(label: string) {
    const config = { databaseURL: 'https://' + label + '-' + (++nextBackend) + '.firebaseio.com' };
    firebaseState.firebaseConfig = config;
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(config));
    return config;
}

export function acceptFixtureSession() {
    const auth = firebaseState.auth, user = auth?.currentUser;
    if (!user || !acceptLocalAuthSession(auth, loginBackendScope(), user)) throw new Error('Fixture requires a coherent accepted SDK session');
}
