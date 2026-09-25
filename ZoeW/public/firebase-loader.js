(function () {
    var BASE = 'https://www.gstatic.com/firebasejs/12.19.0/';
    Promise.all([
        import(BASE + 'firebase-app.js'),
        import(BASE + 'firebase-auth.js'),
        import(BASE + 'firebase-database.js')
    ]).then(function (mods) {
        var appMod = mods[0];
        var authMod = mods[1];
        var dbMod = mods[2];

        window.firebaseSDK = {
            initializeApp: appMod.initializeApp,
            getApps: appMod.getApps,
            deleteApp: appMod.deleteApp,

            getAuth: authMod.getAuth,
            onAuthStateChanged: authMod.onAuthStateChanged,
            signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
            signOut: authMod.signOut,
            setPersistence: authMod.setPersistence,
            browserLocalPersistence: authMod.browserLocalPersistence,
            browserSessionPersistence: authMod.browserSessionPersistence,
            getIdTokenResult: authMod.getIdTokenResult,

            getDatabase: dbMod.getDatabase,
            ref: dbMod.ref,
            onValue: dbMod.onValue,
            off: dbMod.off,
            get: dbMod.get,
            set: dbMod.set,
            update: dbMod.update,
            goOnline: dbMod.goOnline,
            goOffline: dbMod.goOffline,
            runTransaction: dbMod.runTransaction,
            increment: dbMod.increment
        };
        window.dispatchEvent(new Event('firebasesdkready'));
    }).catch(function () {
    });
})();
