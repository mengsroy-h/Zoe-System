// Z6 (deep audit 8): a sign-text mismatch remembers where its range began (`ztoSignedMismatchFrom`) so no read counts as
// complete until a mismatch-free read covers it. The marker never aged: a mismatch that lasted ~24 days in one session widened
// the sign read past ZTO's 31-day range ➜ every read refused (`ZTO_LIST_RANGE_INVALID`), never complete, the 8-day hold
// episodes ran out and abandon proceeded without sign proof. No open parcel is older than `ZTO_SIGNED_SWEEP_MAX_DAYS`, so the
// marker is clamped to that floor ➜ the range stays readable and a mismatch-free read can still clear it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ztoState } from '../src/core/state';
import { firebaseState } from '../src/core/state';
import { getZoneDateKey } from '../src/core/timezone';
import { ZTO_SIGNED_SWEEP_MAX_DAYS, ztoSignedSweepRange } from '../src/features/zto-status';

const NOW = Date.UTC(2026, 9, 20, 5, 0, 0);
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    ztoState.ztoSignedSweepOkAt = 0;
    ztoState.ztoSignedMismatchWideAt = 0;
});

afterEach(() => {
    vi.useRealTimers();
    ztoState.ztoSignedMismatchFrom = '';
});

describe('Z6 ៖ សញ្ញា mismatch ចាស់មិនពង្រីកការអាន Sign លើស ៣១ ថ្ងៃ', () => {
    it('a mismatch from 40 days ago ➜ the range starts at the floor (≤ 31 days) and covers the stored marker', () => {
        ztoState.ztoSignedMismatchFrom = getZoneDateKey(NOW, -40);
        const range = ztoSignedSweepRange();
        expect({ from: range.from, span: days(range.from, range.to) <= 31 })
            .toEqual({ from: getZoneDateKey(NOW, -ZTO_SIGNED_SWEEP_MAX_DAYS), span: true });
        expect(range.from <= ztoState.ztoSignedMismatchFrom, 'a mismatch-free read over this range can clear the marker').toBe(true);
    });

    it('control ៖ a mismatch inside the window widens the read to its start', () => {
        ztoState.ztoSignedMismatchFrom = getZoneDateKey(NOW, -12);
        expect(ztoSignedSweepRange().from).toBe(getZoneDateKey(NOW, -12));
    });
});
