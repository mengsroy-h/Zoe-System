        import { initializeApp, getApps, deleteApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
        import {
            getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
            setPersistence, browserLocalPersistence, browserSessionPersistence, getIdTokenResult
        } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
        import {
            getDatabase, ref, onValue, off, get, set, update, goOnline, goOffline, runTransaction
        } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

        window.firebaseSDK = {
            initializeApp, getApps, deleteApp,
            getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence, getIdTokenResult,
            getDatabase, ref, onValue, off, get, set, update, goOnline, goOffline, runTransaction
        };
        window.dispatchEvent(new Event('firebasesdkready'));
