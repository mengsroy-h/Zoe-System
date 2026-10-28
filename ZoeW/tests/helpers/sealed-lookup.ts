import { securityState } from '../../src/core/state';
import { encryptLookupSecret } from '../../src/services/crypto';

/**
 * Header Lookup រស់នៅតែអ៊ិនគ្រីបក្រោម PIN (`headerValueEnc`) ➜ fixture ដែលត្រូវផ្ញើសោភ្ជាប់ (ឧ. `X-Zoe-Proxy-Key` ទៅ Function ZTO ពិត)
 * បិទសោដោយសោ PIN ពិត ៖ ប្រើសោដែលតេស្តដាក់រួច ឬបង្កើតសោ AES-GCM មួយ (អ្នកហៅកំណត់ `securityState.lookupSecretKey = null` វិញក្នុង afterEach)។
 */
export async function sealLookupHeader<T extends object>(cfg: T, value: string): Promise<T & { headerValueEnc: { iv: number[]; data: number[] } }> {
    if (!securityState.lookupSecretKey) {
        securityState.lookupSecretKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as CryptoKey;
    }
    const headerValueEnc = await encryptLookupSecret(value);
    if (!headerValueEnc) throw new Error('sealLookupHeader: encrypt failed');
    return { ...cfg, headerValueEnc };
}
