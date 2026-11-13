import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createHash, createPublicKey } from 'node:crypto';
const root = resolve(import.meta.dirname, '../..');
const paths = ['ZoeW/public/license-seat-config.js', 'ZoeKeyGen/license-seat-config.js'];
const expectedFingerprint = '0bd7b014f07a026cca2dc34e4e79d6ec06d76ffa3334be46a5707b5599a91524';
for (const path of paths) {
    test(path, () => {
        const window = {} as { ZoeSeatConfig: { audience: string; legacyProtocolEnabled: boolean; receiptPublicKeys: Array<{ kty: string; crv: string; x: string; y: string }> } };
        runInNewContext(readFileSync(resolve(root, path), 'utf8'), { window });
        const config = window.ZoeSeatConfig;
        assert.equal(config.audience, 'https://zoew.netlify.app');
        assert.equal(config.legacyProtocolEnabled, true);
        assert.ok(Object.isFrozen(config));
        assert.ok(Object.isFrozen(config.receiptPublicKeys));
        assert.equal(config.receiptPublicKeys.length, 1);
        const key = config.receiptPublicKeys[0];
        assert.deepEqual(Object.keys(key).sort(), ['crv', 'kty', 'x', 'y']);
        assert.equal(key.kty, 'EC');
        assert.equal(key.crv, 'P-256');
        for (const coordinate of [key.x, key.y]) {
            assert.match(coordinate, /^[A-Za-z0-9_-]{43}$/);
            assert.equal(Buffer.from(coordinate, 'base64url').length, 32);
            assert.equal(Buffer.from(coordinate, 'base64url').toString('base64url'), coordinate);
        }
        assert.equal(createPublicKey({ key, format: 'jwk' }).asymmetricKeyDetails.namedCurve, 'prime256v1');
        const canonical = { kty: key.kty, crv: key.crv, x: key.x, y: key.y };
        assert.equal(createHash('sha256').update(JSON.stringify(canonical)).digest('hex'), expectedFingerprint);
    });
}
test('កម្មវិធីទាំងពីរប្រើការកំណត់ដូចគ្នា', () => {
    assert.equal(readFileSync(resolve(root, paths[0]), 'utf8'), readFileSync(resolve(root, paths[1]), 'utf8'));
});
