import { firebaseState } from './state';
import { serverClockIsTrustworthy } from './clock';

export function sessionVerificationRequired() {
    return !!firebaseState.auth?.currentUser && (firebaseState.sessionExpiryCheck !== 'live' || !firebaseState.serverClockTrusted);
}

export function sessionUserActionAllowed(name) {
    if (!firebaseState.auth?.currentUser) return true;
    serverClockIsTrustworthy();
    return !sessionVerificationRequired() || name === 'retrySessionVerification' || name === 'logoutApp';
}
