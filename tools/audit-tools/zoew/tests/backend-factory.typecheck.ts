import { createSupabaseSdk } from '../../../../ZoeW/src/services/supabase-sdk';
import type { BackendApp, BackendDatabase, BackendReference, BackendSdk, BackendSnapshot, BackendUser } from '../../../../ZoeW/src/services/backend-types';
import type { FirebaseState } from '../../../../ZoeW/src/core/state';

type IsAny<T> = 0 extends 1 & T ? true : false;
type FactorySdk = ReturnType<typeof createSupabaseSdk>;
type NativeLoaderSdk = Pick<typeof import('firebase/app'), 'initializeApp' | 'getApps' | 'deleteApp'>
    & Pick<typeof import('firebase/auth'), 'getAuth' | 'onAuthStateChanged' | 'beforeAuthStateChanged' | 'signInWithEmailAndPassword' | 'signOut' | 'setPersistence' | 'browserLocalPersistence' | 'browserSessionPersistence' | 'getIdTokenResult'>
    & Pick<typeof import('firebase/database'), 'getDatabase' | 'ref' | 'onValue' | 'off' | 'get' | 'set' | 'update' | 'goOnline' | 'goOffline' | 'runTransaction' | 'increment'>;
const factoryIsTyped: IsAny<FactorySdk> = false;
const storedSdkIsTyped: IsAny<FirebaseState['fb']> = false;
const storedAuthIsTyped: IsAny<FirebaseState['auth']> = false;
const storedDatabaseIsTyped: IsAny<FirebaseState['db']> = false;
const storedReferenceIsTyped: IsAny<FirebaseState['dbRefHistory']> = false;
const supabaseDatabaseIsTyped: IsAny<ReturnType<FactorySdk['getDatabase']>> = false;
const supabaseAuthIsTyped: IsAny<ReturnType<FactorySdk['getAuth']>> = false;
declare const actualFactory: FactorySdk;
const providerContract: BackendSdk = actualFactory;
function nativeProviderContract(nativeLoader: NativeLoaderSdk) {
    const app = nativeLoader.initializeApp({ databaseURL: 'https://typed.invalid', projectId: 'typed' });
    const database = nativeLoader.getDatabase(app);
    const auth = nativeLoader.getAuth(app);
    const reference = nativeLoader.ref(database, '.info/connected');
    const commonApp: BackendApp = app;
    const commonDatabase: BackendDatabase = database;
    const commonReference: BackendReference = reference;
    nativeLoader.onValue(reference, snapshot => {
        const commonSnapshot: BackendSnapshot = snapshot;
        void commonSnapshot;
    });
    nativeLoader.onAuthStateChanged(auth, user => {
        const commonUser: BackendUser | null = user;
        void commonUser;
    });
    void [commonApp, commonDatabase, commonReference];
}
// @ts-expect-error actual Supabase factory SDK ទាមទារ string password
actualFactory.signInWithEmailAndPassword(null, 'u', 123);
// @ts-expect-error actual factory SDK មិនមាន operation ដែលបង្កើតដោយអក្សរខុស
actualFactory.runTransacton();
// @ts-expect-error stored SDK ទាមទារ methods ដែល backend ផ្គត់ផ្គង់
const invalidStoredSdk: FirebaseState['fb'] = {};
void [factoryIsTyped, storedSdkIsTyped, storedAuthIsTyped, storedDatabaseIsTyped, storedReferenceIsTyped, supabaseDatabaseIsTyped, supabaseAuthIsTyped,
    providerContract, nativeProviderContract, invalidStoredSdk];
