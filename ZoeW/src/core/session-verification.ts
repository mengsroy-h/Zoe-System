import { firebaseState } from './state';
import { serverClockIsTrustworthy } from './clock';
import { localAuthSessionCurrent } from '../services/local-logout-intent';
import { loginBackendScope } from '../features/login-memory';

function locallySignedOut() {
    return firebaseState.sessionExpiryCheck === 'signed-out' || !!firebaseState.auth?.currentUser
        && !localAuthSessionCurrent(firebaseState.auth, loginBackendScope(), firebaseState.auth.currentUser);
}

export function sessionVerificationRequired() {
    return !!firebaseState.auth?.currentUser && firebaseState.sessionExpiryCheck !== 'signed-out'
        && (!localAuthSessionCurrent(firebaseState.auth, loginBackendScope(), firebaseState.auth.currentUser) || firebaseState.sessionExpiryCheck !== 'live' || !firebaseState.serverClockTrusted);
}

export function sessionUserActionAllowed(name) {
    if (!firebaseState.auth?.currentUser) return true;
    if (locallySignedOut()) return ['submitLoginForm', 'toggleRememberPassword', 'openRegisterForm', 'openResetPasswordForm', 'submitRegisterForm', 'submitResetPasswordForm', 'backToLoginForm', 'logoutApp', 'promptLogout', 'confirmLogout', 'cancelLogout'].includes(name);
    serverClockIsTrustworthy();
    return !sessionVerificationRequired() || name === 'retrySessionVerification' || name === 'logoutApp' || name === 'promptLogout' || name === 'confirmLogout' || name === 'cancelLogout';
}
