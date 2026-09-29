import crypto from 'node:crypto';

const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();
const enc = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
console.log('VAPID_PUBLIC_KEY=' + enc(ecdh.getPublicKey()));
const priv = ecdh.getPrivateKey();
console.log('VAPID_PRIVATE_KEY=' + enc(Buffer.concat([Buffer.alloc(32 - priv.length), priv])));
