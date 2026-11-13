import { afterEach, describe, expect, it, vi } from 'vitest';
import { ztoScanStampMillis, getZoneDateKey, getFormattedClockTime } from '../../../ZoeW/src/core/timezone';
import { acceptServerClockOffset, resetServerClock } from '../../../ZoeW/src/core/clock';
import { ztoReturnedTargets } from '../../../ZoeW/src/features/zto-returned';
import { ztoSignedTimeMillis } from '../../../ZoeW/src/features/zto-status';
import { classifyZtoListRows, ztoListRowOf } from '../../../ZoeW/src/features/zto-list-sync';

const invalid = ['2026-02-29 09:00:00', '2026-02-31 09:00:00', '2026-04-31 09:00:00', '2028-02-30 09:00:00', '2100-02-29 09:00:00'];
const code = '77130500000012';
const raw = (at: string) => ({ barcode: code, at, phone: '012345678', cod: 10, dod: 2 });
const partsOf = (stamp: string) => stamp.slice(0, 10).split('-').map(Number);
afterEach(() => { resetServerClock(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('ZTO៖ ថ្ងៃមិនមានក្នុងប្រតិទិន មិនក្លាយជាភស្តុតាង', () => {
    for (const stamp of invalid) {
        it('parser បដិសេធ ' + stamp, () => expect(ztoScanStampMillis(stamp)).toBe(0));
        it('បញ្ជីមិនមាន stamp authoritative ពី ' + stamp, () => expect(ztoListRowOf(raw(stamp), code).stampMs).toBe(0));
        it('ត្រឡប់មិនជ្រើសកញ្ចប់ដោយ ' + stamp, () => {
            const [year, month] = partsOf(stamp);
            const birth = Date.UTC(year, month - 1, 1);
            const items = [{ id: 'synthetic-item', createdAt: birth, barcodes: [{ code, createdAt: birth, isClosed: false }] }];
            expect(ztoReturnedTargets([raw(stamp)], items)).toHaveLength(0);
        });
        it('Sign មាន round-trip guard រួច៖ ' + stamp, () => expect(ztoSignedTimeMillis(stamp, Date.UTC(2101, 0, 1))).toBe(0));
        it('signed-only មិនបង្កើតជួរនាំចូលពី ' + stamp, () => {
            const [year, month, day] = partsOf(stamp);
            const now = Date.UTC(year, month - 1, day, 3);
            vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
            vi.spyOn(performance, 'now').mockReturnValue(1000); resetServerClock();
            expect(acceptServerClockOffset(0, Object.freeze({ epochMs: now, wallMs: now, monotonicMs: 1000 }), false)).toBe(true);
            const range = { from: stamp.slice(0, 7) + '-01', to: year + '-12-31' };
            const groups = classifyZtoListRows([], [], [], [raw(stamp)], range);
            expect(groups.fresh).toHaveLength(0);
        });
    }
    it.each(['', 'abc', null, undefined, '2026-13-10 10:00:00', '2026-09-10 25:00:00', '2026-09-00 10:00:00'])('ទិសផ្ទុយ៖ ត្រាខ្វះ/ខូច %s នៅតែ 0', stamp => {
        expect(ztoScanStampMillis(stamp)).toBe(0);
    });
    it.each([
        ['2000-02-29 23:59:59', Date.UTC(2000, 1, 29, 16, 59, 59)],
        ['2024-02-29T23:59', Date.UTC(2024, 1, 29, 16, 59)],
        ['2028-02-29 00:00:00', Date.UTC(2028, 1, 28, 17)],
        ['2026-04-30 09:00:00', Date.UTC(2026, 3, 30, 2)],
        ['2026-12-31T23:59:59', Date.UTC(2026, 11, 31, 16, 59, 59)]
    ] as const)('ទិសផ្ទុយ៖ %s រក្សា epoch ថ្ងៃ និងម៉ោង', (stamp, expected) => {
        const parsed = ztoScanStampMillis(stamp);
        expect(parsed).toBe(expected);
        expect(getZoneDateKey(parsed, 0)).toBe(stamp.slice(0, 10));
        expect(getFormattedClockTime(parsed)).toBe(stamp.slice(11).padEnd(8, ':00'));
        expect(ztoSignedTimeMillis(stamp, Date.UTC(2101, 0, 1))).toBe(expected);
    });
    it('Intl មិនមាន timezone៖ ប្រតិទិន invalid នៅបដិសេធ ហើយថ្ងៃត្រឹមត្រូវរក្សា UTC+7', () => {
        vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function () { throw new RangeError('synthetic unavailable timezone'); });
        for (const stamp of invalid) expect(ztoScanStampMillis(stamp)).toBe(0);
        expect(ztoScanStampMillis('2028-02-29 00:00:00')).toBe(Date.UTC(2028, 1, 28, 17));
    });
    it('ត្រឡប់ត្រឹមត្រូវថ្មីជាងថ្ងៃមកដល់ នៅជ្រើសកញ្ចប់', () => {
        const birth = Date.UTC(2026, 1, 28, 3);
        const items = [{ id: 'synthetic-item', createdAt: birth, barcodes: [{ code, createdAt: birth, isClosed: false }] }];
        expect(ztoReturnedTargets([raw('2026-03-01 09:00:00')], items)).toHaveLength(1);
    });
});
