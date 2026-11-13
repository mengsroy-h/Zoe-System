// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStore } from '@netlify/blobs';
import { SEAT_STAGE_STORE } from '../../../../ZoeW/netlify/lib/license-seat-stage.mjs';
import licenseSeatStage from '../../../../ZoeW/netlify/functions/license-seat-stage.mjs';

vi.mock('@netlify/blobs', () => ({ getStore: vi.fn() }));

const origin = 'https://zoew.netlify.app';
const production = { deploy: { context: 'production' } };

describe('បរិបទ runtime របស់ License stage', () => {
    beforeEach(() => {
        vi.stubEnv('ZOE_LICENSE_SEAT_STAGE', 'enabled');
        vi.stubEnv('CONTEXT', undefined);
        vi.stubEnv('ZOE_LICENSE_SEAT_RECEIPT_PRIVATE_JWK', undefined);
        vi.mocked(getStore).mockReset();
        vi.mocked(getStore).mockReturnValue({} as ReturnType<typeof getStore>);
    });
    afterEach(() => vi.unstubAllEnvs());

    it('production ចូលដល់ method guard ដោយគ្មាន build CONTEXT', async () => {
        const response = await licenseSeatStage(new Request(origin), production);
        expect(response.status).toBe(405);
        expect(getStore).toHaveBeenCalledOnce();
        expect(getStore).toHaveBeenCalledWith({ name: SEAT_STAGE_STORE, consistency: 'strong' });
    });

    it.each([
        { deploy: { context: 'deploy-preview' } },
        { deploy: { context: 'branch-deploy' } },
        { deploy: { context: 'dev' } },
        { deploy: {} }, {}, undefined, null
    ])('បិទបើគ្មាន production runtime ទោះ build CONTEXT ជា production: %j', async (context) => {
        vi.stubEnv('CONTEXT', 'production');
        const response = await licenseSeatStage(new Request(origin), context);
        expect(response.status).toBe(503);
        expect(getStore).not.toHaveBeenCalled();
    });

    it.each([undefined, '', 'true', 'Enabled'])('បិទបើ stage flag មិនត្រឹមត្រូវ: %s', async (flag) => {
        vi.stubEnv('ZOE_LICENSE_SEAT_STAGE', flag);
        const response = await licenseSeatStage(new Request(origin), production);
        expect(response.status).toBe(503);
        expect(getStore).not.toHaveBeenCalled();
    });

    it.each(['https://deploy-preview-1--zoew.netlify.app', 'https://branch--zoew.netlify.app', 'https://example.com'])('បិទបើ URL origin មិនត្រឹមត្រូវ: %s', async (url) => {
        const response = await licenseSeatStage(new Request(url), production);
        expect(response.status).toBe(503);
        expect(getStore).not.toHaveBeenCalled();
    });
});
