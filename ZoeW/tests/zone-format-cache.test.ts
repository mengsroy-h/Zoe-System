/**
 * ⛔ SCALE-7 ៖ `appZoneParts()` (ថ្ងៃ · ម៉ោងកម្ពុជា) បង្កើត `Intl.DateTimeFormat` ថ្មីរាល់ការហៅ ➜ រាល់ជួរប្រវត្តិ · ការស្កេន · ស្ថិតិ · Export
 *    បង់តម្លៃបង្កើត formatter (ធ្ងន់ជាងការ format ច្រើនដង)។
 * ⛔ formatter បង្កើតម្តង ហើយប្រើឡើងវិញ · ទុកលើ function ខ្លួនវា (checker `extractFn` ស្រង់តែ function ➜ ⛔ គ្មានអថេរ module) ·
 *    `Intl.DateTimeFormat` ប្តូរ (ឬបាត់/បោះ) ➜ បង្កើតថ្មី ឬត្រឡប់ទៅ fallback UTC+7 ដូចដើម · លទ្ធផលដូចការបង្កើតថ្មីរាល់ដង។
 *    វាស់តាមចំនួនការបង្កើត មិនមែនតាមម៉ោង។
 */
import { afterEach, describe, expect, it } from 'vitest';
import { appZoneParts, getFormattedClockTime, getZoneDateKey } from '../src/core/timezone';

const RealDTF = Intl.DateTimeFormat;
let built = 0;
function installCounting() {
    const Counting: any = function (this: any, ...args: any[]) {
        built++;
        return new (RealDTF as any)(...args);
    };
    Counting.prototype = RealDTF.prototype;
    (Intl as any).DateTimeFormat = Counting;
}

afterEach(() => {
    (Intl as any).DateTimeFormat = RealDTF;
    built = 0;
});

const PROBES = [0, 1696716000000, 1727740800000, 1759276799000, 1759276800000, 1790812800000 + 12345];
function reference(ms: number) {
    const parts: any = {};
    new RealDTF('en-GB', { timeZone: 'Asia/Phnom_Penh', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(ms).forEach((p) => { if (p.type !== 'literal') parts[p.type] = p.value; });
    if (parts.hour === '24') parts.hour = '00';
    return parts;
}

describe('SCALE-7 ៖ formatter ម៉ោងកម្ពុជាបង្កើតម្តង', () => {
    it('⛔ ហៅ ៥០០ ដង ➜ បង្កើត formatter ≤ ១ ដង · លទ្ធផលស្មើការបង្កើតថ្មី', () => {
        installCounting();
        for (let i = 0; i < 500; i++) appZoneParts(PROBES[i % PROBES.length] + i * 1000);
        expect(built).toBeLessThanOrEqual(1);
        for (const ms of PROBES) expect(appZoneParts(ms)).toEqual(reference(ms));
    });

    it('ទិសផ្ទុយ ៖ Intl បោះ (បាត់តំបន់ម៉ោង) ➜ fallback UTC+7 ផ្តល់ថ្ងៃ/ម៉ោងដូចគ្នា · Intl ត្រឡប់មក ➜ ប្រើ Intl វិញ', () => {
        appZoneParts(PROBES[1]);
        (Intl as any).DateTimeFormat = function () { throw new RangeError('Invalid time zone specified'); };
        for (const ms of PROBES) {
            expect(appZoneParts(ms)).toEqual(reference(ms));
            expect(getZoneDateKey(ms, -1)).toBe(getZoneDateKey(ms - 86400000, 0));
        }
        installCounting();
        for (const ms of PROBES) expect(getFormattedClockTime(ms)).toBe(reference(ms).hour + ':' + reference(ms).minute + ':' + reference(ms).second);
        expect(built).toBe(1);
    });
});
