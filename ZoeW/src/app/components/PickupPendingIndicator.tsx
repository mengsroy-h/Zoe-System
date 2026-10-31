import { dataState, firebaseState, securityState } from '../../core/state';
import { pickupPendingSummary } from '../../domain/pickup';
import { useStoreFields, useStoreValue } from '../hooks/useStore';

const REASON_TEXT: Record<string, string> = {
    'legacy-proof': 'ការងារដែលត្រូវការភស្តុតាងបន្ថែម',
    'storage-unavailable': 'មិនអាចផ្ទៀងកំណត់ត្រាដែលរក្សាទុក',
    'reset-conflict': 'ត្រូវផ្ទៀងស្ថិតិក្រោយ Reset',
    'version-conflict': 'ទិន្នន័យបានប្រែប្រួល ត្រូវផ្ទៀងបន្ថែម',
    'recovery-pending': 'កំពុងរង់ចាំផ្ទៀងផ្ទាត់',
    'capacity': 'កំណត់ត្រារង់ចាំពេញ ត្រូវពិនិត្យ'
};

export function PickupPendingIndicator() {
    useStoreValue(dataState, s => s.pickupPendingVersion);
    const session = useStoreFields(firebaseState, ['auth', 'authGeneration', 'db', 'isInitializingFirebase']);
    const locked = useStoreValue(securityState, s => s.appIsLocked || s.appLockVeiled);
    if (locked || session.isInitializingFirebase || !session.auth?.currentUser) return null;
    const summary = pickupPendingSummary();
    if (!summary.total && !summary.reasons.length) return null;
    const count = summary.total > 0 ? summary.total + ' រង់ចាំ' : 'មិនទាន់ផ្ទៀងផ្ទាត់';
    const held = summary.held > 0 ? ' · ' + summary.held + ' ត្រូវពិនិត្យ' : '';
    const label = 'ការផ្ទៀងទិន្នន័យ៖ ' + count + held;
    const details = summary.reasons.map(reason => REASON_TEXT[reason] || REASON_TEXT['recovery-pending']).join(' · ');
    const description = label + (details ? '។ ' + details : '។ ការងារមិនទាន់ផ្ទៀងផ្ទាត់');
    return <span id="pickupPendingIndicator" className="pickup-pending-indicator" role="status" aria-live="polite"
        aria-atomic="true" aria-label={description} title={description}>
        <span aria-hidden="true">⏳</span>{label}
    </span>;
}
