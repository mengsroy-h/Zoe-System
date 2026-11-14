// Shared VM adapter; executes the selected target's actual auth modules, not a checker.
'use strict';
const vm = require('node:vm');
const { moduleRuntime, memoryStorage } = require('./react-view');

function localAuthRuntime(root, source) {
    const present = /\bfunction\s+createLocalLogoutIntentStore\s*\(/.test(source);
    if (!present) {
        if (/\blocalAuthSessionCurrent\s*\(/.test(source)) throw new Error('local auth source boundary missing');
        return { code: '', names: new Set(), functionNames: new Set(), variableNames: new Set(), withoutBindings: code => code,
            prepare() {}, seed() {}, install() {} };
    }
    const runtime = moduleRuntime(root, source, [
        { path: 'src/core/storage.ts', expose: ['safeStoreGet'] },
        { path: 'src/features/login-memory.ts', expose: ['loginBackendScope'] },
        { path: 'src/services/local-logout-intent.ts', expose: ['LOCAL_LOGOUT_INTENT_PREFIX', 'createLocalLogoutIntentStore', 'localLogoutIntent', 'acceptLocalAuthSession', 'localAuthSessionCurrent'] }
    ]);
    const prepare = (context, config) => {
        if (!config || typeof config !== 'object') throw new Error('local auth fixture requires its declared backend Config');
        for (const [binding, physical] of [['appLocalStore', 'localStorage'], ['appSessionStore', 'sessionStorage']]) {
            if (context[binding] == null) Object.defineProperty(context, binding, { configurable: true, enumerable: true, writable: true, value: memoryStorage() });
            if (context[physical] == null) context[physical] = context[binding];
            if (context.window && context.window[physical] == null) context.window[physical] = context[binding];
        }
        context.firebaseConfig = config;
    };
    const seed = (context, config, accept = true) => {
        context.__declaredLocalAuthConfig = config;
        context.__acceptDeclaredLocalAuth = accept;
        try {
            vm.runInContext(`firebaseConfig = __declaredLocalAuthConfig;
                appLocalStore.setItem('zoew_firebase_config', JSON.stringify(firebaseConfig));
                if (__acceptDeclaredLocalAuth && typeof auth !== 'undefined' && auth?.currentUser
                    && !acceptLocalAuthSession(auth, loginBackendScope(), auth.currentUser))
                    throw new Error('local auth fixture did not establish an accepted SDK actor');`, context);
        } finally {
            delete context.__declaredLocalAuthConfig;
            delete context.__acceptDeclaredLocalAuth;
        }
    };
    return { ...runtime, prepare, seed, install(context, config, accept = true) {
        prepare(context, config);
        vm.runInContext(runtime.code, context);
        seed(context, config, accept);
    } };
}

module.exports = { localAuthRuntime };
