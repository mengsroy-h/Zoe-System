/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «កញ្ចប់មិនទាន់បិទក្នុង ZTO Palm យូរម៉ោងខ្លះមិនបង្ហាញប្រាប់ ក្នុង ZoeW បិទតែ ZTO Palm មិនទាន់បិទ ឬមកពីកញ្ចប់នោះចូលធុងសំរាមបន្ទាប់ពី ២ម៉ោង»
 *    ➜ ចម្លើយ ៖ «៣ ថ្ងៃ» (របា «ZTO មិនទាន់បិទ» រំលឹករហូតដល់ ZTO បិទ ឬ ៣ ថ្ងៃ)។
 *    មុនកែ ៖ ធុងសំរាម «យករួច» រាប់តែ ១២ ម៉ោងក្រោយចូល (≈ ១៤ ម៉ោងក្រោយបិទ) · សាលក្រមក្នុង localStorage ផុត ១២ ម៉ោង · ទុកបាន ៣០០ ➜ កញ្ចប់ម្សិលមិញបាត់ពីរបា។
 *    ច្បាប់ ៖ `ZTO_STATUS_TTL_MS` = ៣ ថ្ងៃ (ធុងសំរាម «យករួច» · សាលក្រម) · `ZTO_STATUS_MAX` ទុកសាលក្រម ៣ ថ្ងៃបានគ្រប់ (មិនបណ្តេញ ➜ មិនសួរ ZTO ម្តងទៀតក្រោយបើក App)។
 *    ទិសផ្ទុយ ៖ ចាស់ជាង ៣ ថ្ងៃ · ធុងសំរាមមិនមែន «យករួច» (លុប · ដក · ត្រឡប់) · សាលក្រម `true` ➜ មិនបង្ហាញ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { firebaseState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { getServerNow } from '../src/core/clock';
import {
    ZTO_STATUS_MAX, ZTO_STATUS_TTL_MS, clearZtoPickupStatusStore, loadZtoPickupStatusOnce, setZtoPickupVerdict, ztoPickupStatus, ztoStatusPendingList
} from '../src/features/zto-status';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const STORE_KEY = 'zoew_zto_pickup_status_v1';

function trashItem(code: string, ageMs: number, reason = 'pickup') {
    const deletedAt = getServerNow() - ageMs;
    return { id: 'T' + code, phone: '012000111', trashReason: reason, deletedAt, isFromDeletion: true,
        barcodes: [{ code, isClosed: true, closedAt: deletedAt - 2 * HOUR }] };
}

beforeEach(() => {
    clearZtoPickupStatusStore();
    ztoState.ztoStatusLoaded = false;
});

afterEach(() => {
    vi.useRealTimers();
    firebaseState.serverTimeOffsetMs = 0;
    clearZtoPickupStatusStore();
    ztoState.ztoStatusLoaded = false;
});

describe('⛔ របា «ZTO មិនទាន់បិទ» រំលឹក ៣ ថ្ងៃ (សំណើម្ចាស់គម្រោង)', () => {
    it('⛔ ព្រំដែន = ៣ ថ្ងៃ · guide.html ប្រាប់ចំនួនថ្ងៃដដែល (ដកពីកូដ)', () => {
        expect(ZTO_STATUS_TTL_MS).toBe(3 * DAY);
        const days = String(ZTO_STATUS_TTL_MS / DAY).replace(/\d/g, (d) => '០១២៣៤៥៦៧៨៩'[Number(d)]);
        const guide = readFileSync(path.join(__dirname, '..', 'public', 'guide.html'), 'utf8');
        const section = guide.slice(guide.indexOf('«ZTO មិនទាន់បិទ»'), guide.indexOf('<section id="money">'));
        expect(section).toContain('<strong>' + days + ' ថ្ងៃ</strong>');
    });

    it('⛔ ធុងសំរាម «យករួច» ១៤ ម៉ោង · ២ ថ្ងៃ · ៣ ថ្ងៃគត់ + ZTO `false` ➜ នៅក្នុងរបា · លើស ៣ ថ្ងៃ ➜ ចេញ', () => {
        const trash = [trashItem('ZT14H', 14 * HOUR), trashItem('ZT2D', 2 * DAY), trashItem('ZT3D', 3 * DAY - 60000), trashItem('ZTOLD', 3 * DAY + HOUR)];
        for (const t of trash) setZtoPickupVerdict(t.barcodes[0].code, false);
        const codes = ztoStatusPendingList([], trash).map((e) => e.code);
        expect(codes).toEqual(['ZT14H', 'ZT2D', 'ZT3D']);
    });

    it('ទិសផ្ទុយ ៖ លុប · ដក · ត្រឡប់ · សាលក្រម true ➜ មិនបង្ហាញ', () => {
        const trash = [trashItem('ZTDEL', 2 * DAY, 'delete'), trashItem('ZTREM', 2 * DAY, 'remove'), trashItem('ZTEXP', 2 * DAY, 'returned'), trashItem('ZTOK', 2 * DAY)];
        for (const t of trash.slice(0, 3)) setZtoPickupVerdict(t.barcodes[0].code, false);
        setZtoPickupVerdict('ZTOK', true);
        expect(ztoStatusPendingList([], trash)).toEqual([]);
    });

    it('⛔ សាលក្រម `false` ពី ២ ថ្ងៃមុន (បើក App ឡើងវិញ) ➜ នៅចាំ · ចាស់ជាង ៣ ថ្ងៃ ➜ បោះចោល', () => {
        const now = Date.now();
        appLocalStore!.setItem(STORE_KEY, JSON.stringify({ ZT2D: { closed: false, at: now - 2 * DAY }, ZTOLD: { closed: false, at: now - 3 * DAY - HOUR } }));
        loadZtoPickupStatusOnce();
        expect(ztoPickupStatus.get('ZT2D')).toEqual({ closed: false, at: now - 2 * DAY });
        expect(ztoPickupStatus.has('ZTOLD')).toBe(false);
    });

    it('⛔ ៣ ថ្ងៃ × ៤០០ កញ្ចប់ ➜ សាលក្រមទាំងអស់នៅ (មិនបណ្តេញ ➜ មិនសួរ ZTO ម្តងទៀតក្រោយបើក App)', () => {
        for (let i = 0; i < 1200; i++) setZtoPickupVerdict('ZTV' + String(i).padStart(5, '0'), i % 7 === 0 ? false : true);
        expect(ZTO_STATUS_MAX).toBeGreaterThanOrEqual(1200);
        expect(ztoPickupStatus.size).toBe(1200);
        ztoState.ztoStatusLoaded = false;
        ztoPickupStatus.clear();
        loadZtoPickupStatusOnce();
        expect(ztoPickupStatus.size).toBe(1200);
    });
});


describe('ZTO Sign ៖ រក្សាម៉ោង Sign ពិត សម្រាប់ព្រំសម្អាត', () => {
    it('ម៉ោង ZTO ជា Asia/Phnom_Penh · រក្សាតាមការទាញសារជាថ្មី និងបើក App ឡើងវិញ', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-19T08:00:00Z'));
        const signedAt = Date.parse('2026-10-19T06:45:01Z');
        setZtoPickupVerdict('ZTSIGNTIME', true, '2026-10-19 13:45:01');
        expect(ztoPickupStatus.get('ZTSIGNTIME')).toMatchObject({ signedAt, signedAtExact: true });
        vi.setSystemTime(new Date('2026-10-19T09:00:00Z'));
        setZtoPickupVerdict('ZTSIGNTIME', true);
        expect(ztoPickupStatus.get('ZTSIGNTIME')).toMatchObject({ signedAt, signedAtExact: true });
        ztoPickupStatus.clear();
        ztoState.ztoStatusLoaded = false;
        loadZtoPickupStatusOnce();
        expect(ztoPickupStatus.get('ZTSIGNTIME')).toMatchObject({ signedAt, signedAtExact: true });
        setZtoPickupVerdict('ZTSIGNTIME', false);
        expect(ztoPickupStatus.get('ZTSIGNTIME').signedAt).toBeUndefined();
    });

    it('គ្មានម៉ោងពី ZTO ➜ ប្រើម៉ោង Server ពេលបញ្ជាក់ដំបូង · មិនប្រើម៉ោងឧបករណ៍', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-19T08:00:00Z'));
        firebaseState.serverTimeOffsetMs = 3 * HOUR;
        const first = getServerNow();
        setZtoPickupVerdict('ZTSIGNOBSERVED', true);
        expect(ztoPickupStatus.get('ZTSIGNOBSERVED').signedAt).toBe(first);
        vi.setSystemTime(new Date('2026-10-19T09:00:00Z'));
        setZtoPickupVerdict('ZTSIGNOBSERVED', true);
        expect(ztoPickupStatus.get('ZTSIGNOBSERVED').signedAt).toBe(first);
        setZtoPickupVerdict('ZTSIGNOBSERVED', null);
        setZtoPickupVerdict('ZTSIGNOBSERVED', true);
        expect(ztoPickupStatus.get('ZTSIGNOBSERVED').signedAt).toBe(getServerNow());
    });

    it.each([undefined, null, NaN, Infinity, {}, [], '', '2026-02-31 08:00:00', '2026-10-20 08:00:00', '2026-10-19 08:00:00garbage'])('ម៉ោងខូច/អនាគត %j ➜ មិនបង្កើតព្រំ Sign នៅអតីតកាល', (stamp) => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-19T08:00:00Z'));
        setZtoPickupVerdict('ZTSIGNINVALID', true, stamp);
        expect(ztoPickupStatus.get('ZTSIGNINVALID').signedAt).toBe(getServerNow());
    });
});
