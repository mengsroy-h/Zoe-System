import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
    setPersistence, browserLocalPersistence, browserSessionPersistence, getIdTokenResult
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
    getDatabase, ref, onValue, off, update, goOnline
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

window.firebaseSDK = { initializeApp, getApps, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence, getIdTokenResult, getDatabase, ref, onValue, off, update, goOnline };
window.dispatchEvent(new Event('firebasesdkready'));
