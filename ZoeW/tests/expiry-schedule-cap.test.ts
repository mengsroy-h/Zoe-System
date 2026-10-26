import { describe, expect, it } from 'vitest';
import { ABANDON_AGE_MS } from '../src/features/session';
import { expiryScheduleTimes, NOTIFY_SCHEDULE_MAX, NOTIFY_SCHEDULE_STEP_MS } from '../src/features/notifications';

const NOW = Date.UTC(2026, 9, 26, 3);
const HOUR = 60 * 60 * 1000;
const row = (id: string, hours: number, count = 1) => ({ id, phone: '081000001', createdAt: NOW - ABANDON_AGE_MS + hours * HOUR,
    barcodes: Array.from({ length: count }, (_, i) => ({ code: id + '-' + i, isClosed: false })) });

describe('ការរំលឹកត្រឡប់ ៖ ហាងដែលមានកញ្ចប់លើសពិដាន', () => {
    it('កញ្ចប់ជិតត្រឡប់នៅចុងបញ្ជីចូលជំនួសកញ្ចប់នៅសល់ច្រើនថ្ងៃ', () => {
        const future = Array.from({ length: NOTIFY_SCHEDULE_MAX }, (_, i) => row('future-' + i, 6 * 24));
        const due = row('near-return', 1);
        const times = expiryScheduleTimes([...future, due], NOW);
        expect(times).toHaveLength(NOTIFY_SCHEDULE_MAX);
        expect(times[0]).toBeGreaterThan(NOW + HOUR);
        expect(times[0]).toBeLessThanOrEqual(NOW + HOUR + NOTIFY_SCHEDULE_STEP_MS);
        expect(times).toEqual(expiryScheduleTimes([due, ...future], NOW));
    });

    it('លំដាប់ history មិនប្តូរកញ្ចប់ជិតបំផុតដែលបានរក្សា · ម៉ោងដូចគ្នានៅរាប់តាមចំនួនកញ្ចប់', () => {
        const rows = Array.from({ length: NOTIFY_SCHEDULE_MAX + 37 }, (_, i) => row('parcel-' + i, 1 + i % 150));
        const all = rows.flatMap((entry) => expiryScheduleTimes([entry], NOW));
        const expected = all.sort((a, b) => a - b).slice(0, NOTIFY_SCHEDULE_MAX);
        expect(expiryScheduleTimes(rows, NOW)).toEqual(expected);
        expect(expiryScheduleTimes(rows.slice().reverse(), NOW)).toEqual(expected);
        expect(expiryScheduleTimes([row('same-time', 1, 3)], NOW)).toHaveLength(3);
    });
});
