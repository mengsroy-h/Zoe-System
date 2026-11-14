'use strict';
const assert = require('node:assert/strict');

// Explicit positive SDK fixture bootstrap using the selected source bundle's
// real authentication policy. It never substitutes a successful auth guard.
function initializeSdkSession(api) {
    const auth = api.firebaseState.auth;
    const scope = api.loginBackendScope();
    const saved = api.appLocalStore.getItem('zoew_firebase_config');
    assert.ok(scope && saved, 'SDK fixture requires its declared saved backend');
    assert.equal(api.loginBackendScope(JSON.parse(saved)), scope, 'SDK fixture backend scope must match its saved Config');
    assert.equal(api.acceptLocalAuthSession(auth, scope, auth?.currentUser), true, 'SDK fixture requires an accepted actual actor');
}

module.exports = { initializeSdkSession };
