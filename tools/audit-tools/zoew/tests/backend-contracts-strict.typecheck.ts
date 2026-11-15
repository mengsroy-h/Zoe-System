import type { BackendApp, BackendAuth, BackendDatabase, BackendSdk, BackendTokenResult, BackendUser } from '../../../../ZoeW/src/services/backend-types';
import type { DeletedParcelRow, LegacyRestoreClaimString, ParcelRestoreClaim } from '../../../../ZoeW/src/domain/parcel';

declare const sdk: BackendSdk;
declare const database: BackendDatabase;
declare const app: BackendApp;
declare const auth: BackendAuth;
declare const user: BackendUser;
declare const token: BackendTokenResult;

const optionalAuth: BackendAuth | null = null;
// @ts-expect-error Auth handle មិនអាចប្រើមុនពិនិត្យ null
void optionalAuth.currentUser;
// @ts-expect-error SDK methods ទាមទារ Auth handle ពិត
sdk.signOut({ currentUser: null });
// @ts-expect-error លេខមិនមែនពាក្យសម្ងាត់
sdk.signInWithEmailAndPassword(auth, 'u@example.invalid', 123);
// @ts-expect-error លេខមិនមែន BackendApp
sdk.getDatabase(1);
// @ts-expect-error Database handle ទាមទារ native app ឬ Supabase marker
sdk.ref({}, 'unreviewed/path');
// @ts-expect-error User handle មិនមែនតែ uid
sdk.getIdTokenResult({ uid: 'u' });
// @ts-expect-error JSON claims មិនអនុញ្ញាត unchecked property call
token.claims.aud.toUpperCase();

sdk.getAuth(app);
sdk.getIdTokenResult(user);

const unknownRef = sdk.ref(database, 'unreviewed/path');
sdk.get(unknownRef).then(snapshot => {
    const value = snapshot.val();
    // @ts-expect-error raw path មិនធានា shape ទិន្នន័យ
    void value.cod;
});

const amount = sdk.ref(database, 'zoew_daily_revenue_cod_dod/2026-11-01/codDollar');
sdk.set(amount, 12);
// @ts-expect-error leaf codDollar ជាលេខ មិនមែន bucket
sdk.set(amount, { codDollar: 12 });
// @ts-expect-error ទិន្នន័យក្នុង transaction ត្រូវស៊ីគ្នានឹង reference
sdk.runTransaction(amount, () => 'wrong');
const parcelMoney = sdk.ref(database, 'zoew_scan_history_cod_dod/row/barcodes/0/cod');
sdk.set(parcelMoney, 2.5);
// @ts-expect-error nested barcode cod ជាលេខ
sdk.set(parcelMoney, '2.5');
const pickupPhone = sdk.ref(database, 'zoew_daily_pickup_cod_dod/2026-11-01/pickedUpPhones/phone');
sdk.set(pickupPhone, 1);
// @ts-expect-error pickup phone count មិនមែន object
sdk.set(pickupPhone, { count: 1 });
const collectedMoney = sdk.ref(database, 'zoew_daily_collected_cod_dod/2026-11-01/barcode/c');
sdk.set(collectedMoney, 3);
// @ts-expect-error collected currency leaf ជាលេខ
sdk.set(collectedMoney, '3');
const finalizationToken = sdk.ref(database, 'zoew_restore_finalizations/source/token');
sdk.set(finalizationToken, 'token');
// @ts-expect-error token leaf មិនមែន finalization object
sdk.set(finalizationToken, { token: 'token' });

const legacyClaim: LegacyRestoreClaimString = 'legacy-token';
const absentToken: undefined = legacyClaim.token;
const legacyRow: DeletedParcelRow = { restoreClaim: legacyClaim };
const partialRow: DeletedParcelRow = { restoreClaim: { targetId: 'target' } };
const verifiedClaim: ParcelRestoreClaim = { token: 'token', claimedAt: 1 };
// @ts-expect-error claim view token ដែលមានត្រូវជា string
const wrongClaim: DeletedParcelRow = { restoreClaim: { token: 1 } };
// @ts-expect-error validated claim ទាមទារ token និង claimedAt
const incompleteClaim: ParcelRestoreClaim = { targetId: 'target' };
void [absentToken, legacyRow, partialRow, verifiedClaim, wrongClaim, incompleteClaim];
