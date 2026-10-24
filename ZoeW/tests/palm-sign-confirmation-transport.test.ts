import { describe, expect, it, vi } from 'vitest';
import * as transport from '../src/services/palm-sign-transport';

const automatic = (...args: any[]) => (transport as any).requestPalmSignWithConfirmation(...args);
const body = (stage = 'receipt') => ({ stage, barcode: '77130500000012', requestId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', signMan: 'សុខា', photo: 'photo-a', dispatchProof: 'proof-a' });
const answer = (status: number, value: any) => ({ res: { status, ok: status >= 200 && status < 300 }, body: value });
const warning = (stage = 'receipt', patch = {}) => answer(409, { code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: '77130500000012', stage,
    message: 'កញ្ចប់មានបញ្ហា តើបានដោះស្រាយហើយឬនៅ?', confirmationToken: 'sealed-warning-a', ...patch });
const success = answer(200, { success: true });

describe('ZTO ៖ បញ្ជាក់សារដែល Server អនុញ្ញាតដោយស្វ័យប្រវត្តិតែមួយដង', () => {
    it.each(['dispatch', 'receipt', 'receipt-check'])('%s ៖ ប្រើ token ចងសំណើដើម ហើយមិនប្ដូរ barcode រូប ឈ្មោះ ឬ proof', async (stage) => {
        const original = body(stage);
        const send = vi.fn().mockResolvedValueOnce(warning(stage === 'receipt-check' ? 'receipt' : stage)).mockResolvedValue(success);
        expect(await automatic(send, original, () => true)).toBe(success);
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls[0][0]).toEqual(original);
        expect(send.mock.calls[1][0]).toEqual({ ...original, confirmationToken: 'sealed-warning-a' });
        expect(original).not.toHaveProperty('confirmationToken');
    });

    it.each([
        warning('dispatch'), warning('receipt', { barcode: 'other-barcode' }), warning('receipt', { confirmationToken: '' }),
        warning('receipt', { confirmationToken: 'x'.repeat(8193) }), warning('receipt', { message: '' }),
        warning('receipt', { message: 'x'.repeat(4001) }), warning('receipt', { message: '\u0000invalid' }),
        answer(409, { code: 'ZTO_PALM_SIGN_CHECK_REJECTED' }), answer(504, { uncertain: true }), warning('receipt', { uncertain: true }),
        answer(401, { code: 'ZTO_AUTH_EXPIRED' }), answer(500, warning().body), answer(409, { ...warning().body, code: 'other' })
    ])('ចម្លើយខុសអត្តសញ្ញាណ ខូច ហាម ឬមិនប្រាកដ មិនត្រូវផ្ញើម្ដងទៀត', async (out) => {
        const send = vi.fn(async () => out);
        expect(await automatic(send, body(), () => true)).toBe(out);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('សារទីពីរប្រែ មិនរត់បញ្ជាក់ជារង្វង់', async () => {
        const second = warning('receipt', { message: 'បញ្ហាថ្មី', confirmationToken: 'sealed-warning-b' });
        const send = vi.fn().mockResolvedValueOnce(warning()).mockResolvedValue(second);
        expect(await automatic(send, body(), () => true)).toBe(second);
        expect(send).toHaveBeenCalledTimes(2);
    });

    it('សំណើមាន token រក្សាទុករួច មិនបញ្ជាក់សារថ្មីម្ដងទៀតក្រោយបើក App ឡើងវិញ', async () => {
        const send = vi.fn(async () => warning()); const persist = vi.fn();
        expect(await automatic(send, { ...body(), confirmationToken: 'already-approved' }, () => true, persist)).toEqual(warning());
        expect(send).toHaveBeenCalledTimes(1); expect(persist).not.toHaveBeenCalled();
    });

    it('ថតសំណើមុន await ដើម្បីកុំឱ្យការកែរូប ឈ្មោះ ឬ barcode ពេលរង់ចាំប្រែសំណើបញ្ជាក់', async () => {
        const original = body(); const snapshot = { ...original };
        const send = vi.fn().mockImplementationOnce(async () => { original.photo = 'changed'; original.barcode = 'changed'; return warning(); }).mockResolvedValue(success);
        await automatic(send, original, () => true);
        expect(send.mock.calls[1][0]).toEqual({ ...snapshot, confirmationToken: 'sealed-warning-a' });
    });

    it.each(['before', 'after-response', 'after-save'])('session ប្រែ %s មិនផ្ញើលើសព្រំដែននោះ', async (when) => {
        let current = when !== 'before';
        const send = vi.fn(async () => { if (when === 'after-response') current = false; return warning(); });
        const persist = vi.fn(async () => { if (when === 'after-save') current = false; });
        await expect(automatic(send, body(), () => current, persist)).rejects.toThrow('palm:session');
        expect(send).toHaveBeenCalledTimes(when === 'before' ? 0 : 1);
    });

    it('រក្សា token ឱ្យបានមុនផ្ញើ ហើយបរាជ័យរក្សាទុកមិនត្រូវ replay', async () => {
        const send = vi.fn(async () => warning());
        const persist = vi.fn(async () => { throw new Error('outbox:changed'); });
        await expect(automatic(send, body(), () => true, persist)).rejects.toThrow('outbox:changed');
        expect(send).toHaveBeenCalledTimes(1);
        expect(persist).toHaveBeenCalledWith({ token: 'sealed-warning-a', message: warning().body.message });
    });

    it('បាត់ចម្លើយក្រោយ replay មិនផ្ញើលើកទីបី និងមិនអះអាងជោគជ័យ', async () => {
        const send = vi.fn().mockResolvedValueOnce(warning()).mockRejectedValue(new Error('lost ack'));
        await expect(automatic(send, body(), () => true)).rejects.toThrow('lost ack'); expect(send).toHaveBeenCalledTimes(2);
    });
});
