import { firebaseState, securityState } from '../core/state';
import { shopScope } from '../core/shop-scope';
import { listSignJobs, openSignJob } from '../services/palm-sign-outbox-store';
import { saveOriginalQueuedPhoto } from '../platform/queued-photo-output';
import { showToast } from '../ui/toast';

const exporting = new Set<string>();

export async function exportQueuedSignPhoto(id: string, expectedCode: string): Promise<void> {
    if (exporting.has(id)) return;
    const shop = shopScope();
    const operationAuth = firebaseState.auth;
    const uid = operationAuth?.currentUser?.uid;
    const operationDb = firebaseState.db;
    const generation = firebaseState.authGeneration;
    const key = securityState.lookupSecretKey as CryptoKey | null;
    const owns = () => !!shop && !!uid && !!operationDb && !!key && shopScope() === shop
        && firebaseState.auth === operationAuth && firebaseState.auth?.currentUser?.uid === uid && firebaseState.db === operationDb
        && firebaseState.authGeneration === generation && securityState.lookupSecretKey === key
        && !securityState.appIsLocked && !securityState.appLockVeiled;
    if (!owns()) {
        showToast('⚠️ សូមដោះសោ App និងចូលគណនីហាងដើម ដើម្បីរក្សារូប។');
        return;
    }
    const owner = JSON.stringify([shop, uid]);
    let invalid = false;
    const current = () => !invalid && owns();
    const observe = () => { if (!owns()) invalid = true; };
    const offAuth = firebaseState.subscribe(observe);
    const offSecurity = securityState.subscribe(observe);
    exporting.add(id);
    try {
        const rows = await listSignJobs(owner);
        if (!current()) return;
        const row = rows.find((value) => value.id === id && value.owner === owner);
        if (!row) throw new Error('outbox:missing');
        const job = await openSignJob(row, key!);
        if (!current()) return;
        if (job.code !== expectedCode || typeof job.photo !== 'string' || !/^[A-Za-z0-9_-]+$/.test(job.code)) throw new Error('outbox:photo');
        const result = await saveOriginalQueuedPhoto(job.photo, 'ZoeW-' + job.code + '-original.jpg', current);
        if (!current()) return;
        if (result === 'saved') showToast('✅ ' + job.code + ' · បានទាញយករូបដើមក្នុងជួរ។ មិនបាន Sign ឬលុបការងារ។');
        if (result === 'shared') showToast('ℹ️ ' + job.code + ' · បានបិទផ្ទាំងរក្សាទុក/ចែករំលែក។ សូមផ្ទៀងឯកសារនៅទីតាំងដែលអ្នកជ្រើស។ ការងារ Sign នៅដដែល។');
    } catch {
        if (current()) showToast('⚠️ រូបដើមអាន ឬរក្សាទុកមិនបាន។ សូមប្រើគណនីហាង និង PIN ដើម។ កុំលុបទិន្នន័យ App; ការងារអ៊ិនគ្រីបនៅដដែល។');
    } finally {
        offAuth(); offSecurity(); exporting.delete(id);
    }
}
