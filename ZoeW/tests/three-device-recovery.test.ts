import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lab = require('./helpers/three-device-recovery.cjs');
const seeds = [1, 6, 23, 42, 71, 101];
const points = ['pre-history', 'post-history', 'post-month', 'post-day', 'pre-finalize', 'post-finalize', 'post-prepare', 'delayed-finalize'];
const cases = seeds.flatMap(seed => points.flatMap(point => ['remove', 'delete'].filter(mode => !(mode === 'delete' && ['post-month', 'post-day'].includes(point))).map(mode => ({ seed, point, mode }))));
afterEach(() => {
    lab.dispose();
    delete process.env.NEGATIVE_CONTROL;
    delete process.env.STALE_DAILY;
    delete process.env.LEGACY_BASELINE;
    delete process.env.MISSING_DAILY;
});
afterAll(() => lab.cleanup());
describe('ឧបករណ៍ A/B/C ឯករាជ្យ · journal លើថាស · បិទហើយបើកវិញ', () => {
    it('បិទ context ចាស់ · មិនអាចលុប journal ឬបន្តសំណើថ្មី', async () => { await lab.killedContextIsolation(); });
    it('របង witness · លុបក្រោយបញ្ចប់ និងប្រើជំនាន់ថ្មី', () => { lab.witnessCleanupFence(); });
    it.each(cases)('$seed $point $mode', async ({ seed, point, mode }) => {
        await lab.scenario(seed, point, mode);
    }, 10000);
    it('បូកស្ទួនត្រូវតេស្តចាប់បាន', async () => {
        process.env.NEGATIVE_CONTROL = 'duplicate-credit';
        await expect(lab.scenario(6, 'post-history', 'remove')).rejects.toThrow();
    });
    it('បាត់ journal ត្រូវតេស្តចាប់បាន', async () => {
        process.env.NEGATIVE_CONTROL = 'lost-journal';
        await expect(lab.scenario(6, 'post-history', 'remove')).rejects.toThrow(/zoew_daily_revenue_cod_dod/);
    });
    it('គ្មានភស្តុតាងចាស់ · រក្សា journal និងមិនបូកតាមសន្មត', async () => {
        process.env.LEGACY_BASELINE = '1';
        await lab.scenario(6, 'post-month', 'remove');
    });
    it('បាត់ bucket ថ្ងៃ · រក្សា journal និងមិនបូកតាមសន្មត', async () => {
        process.env.MISSING_DAILY = '1';
        await lab.scenario(6, 'post-month', 'remove');
    });
    it('listener ថ្ងៃយឺត · បិទក្រោយដកខែ · បើកវិញត្រូវបញ្ចប់ដកថ្ងៃ', async () => {
        process.env.STALE_DAILY = '1';
        await lab.scenario(6, 'post-month', 'remove');
    });
});
