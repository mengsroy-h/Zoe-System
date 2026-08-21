        import { initializeApp, getApps, deleteApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
        import {
            getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
            setPersistence, browserLocalPersistence, browserSessionPersistence, getIdTokenResult
        } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
        import {
            getDatabase, ref, onValue, off, get, set, update, goOnline, runTransaction, increment
        } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

        window.firebaseSDK = {
            initializeApp, getApps, deleteApp,
            getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence, getIdTokenResult,
            getDatabase, ref, onValue, off, get, set, update, goOnline, runTransaction, increment
        };
        window.dispatchEvent(new Event('firebasesdkready'));
