import { getStore } from '@netlify/blobs';
import { SEAT_STAGE_STORE, SEAT_AUDIENCE } from '../lib/license-seat-stage.mjs';
import { createInvitationService, handleInvitationRequest } from '../lib/license-invitations.mjs';
export default async function licenseInvitations(request, context) {
    let service = createInvitationService();
    if (process.env.ZOE_LICENSE_INVITATIONS === 'enabled' && process.env.ZOE_LICENSE_SEAT_STAGE === 'enabled' && context?.deploy?.context === 'production' && new URL(request.url).origin === SEAT_AUDIENCE) {
        try {
            const config = { enabled: true, encryptionKey: process.env.ZOE_LICENSE_INVITE_ENCRYPTION_KEY, receiptPrivateJwk: JSON.parse(process.env.ZOE_LICENSE_SEAT_RECEIPT_PRIVATE_JWK || 'null') };
            service = createInvitationService(config);
            if (service.enabled)
                service = createInvitationService({ ...config, store: getStore({ name: SEAT_STAGE_STORE, consistency: 'strong' }) });
        }
        catch { }
    }
    return handleInvitationRequest(request, service);
}
