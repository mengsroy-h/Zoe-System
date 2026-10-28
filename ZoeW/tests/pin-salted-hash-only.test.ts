/**
 * ⛔ Phase B (ការសម្រេចម្ចាស់ ៖ គ្មាន compat មុន launch) ៖ hash PIN ចាស់ = SHA-256 គ្មាន salt នៃ PIN ៦ ខ្ទង់ ➜ អ្នកអាន localStorage
 *    បាន (devtools · ឧបករណ៍ខ្ចី) រក PIN បានក្នុងការសាកតិចជាង ១ លានដង។ ច្បាប់ ៖ PIN ផ្ទៀងតែជាមួយ hash PBKDF2 (`pbkdf2:` · salt ·
 *    ១៥០,០០០ ជុំ) · hash គ្មាន salt មិនដែលត្រូវ ហើយមិនដែលត្រូវបានផ្លាស់ ➜ «ភ្លេច PIN?» កំណត់ PIN ថ្មី។
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPin, verifyStoredPin } from '../src/services/crypto';
import * as crypto from '../src/services/crypto';

describe('PIN ផ្ទៀងតែជាមួយ hash PBKDF2', () => {
    it('hash PBKDF2 ត្រឹមត្រូវ ➜ ត្រូវ · PIN ខុស ➜ មិនត្រូវ', async () => {
        const saved = await hashPin('246802');
        expect(saved.startsWith('pbkdf2:')).toBe(true);
        expect(await verifyStoredPin('246802', saved)).toBe(true);
        expect(await verifyStoredPin('246803', saved)).toBe(false);
    });

    it('⛔ hash SHA-256 គ្មាន salt នៃ PIN ដដែល ➜ មិនត្រូវ · គ្មាន helper hash ចាស់', async () => {
        const unsalted = createHash('sha256').update('246802').digest('hex');
        expect(await verifyStoredPin('246802', unsalted)).toBe(false);
        expect(await verifyStoredPin('246802', '')).toBe(false);
        expect('hashPinLegacy' in crypto).toBe(false);
    });
});
