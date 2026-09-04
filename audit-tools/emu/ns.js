'use strict';

const crypto = require('crypto');

function emuNamespace(base) {
    if (typeof base !== 'string' || !/^[a-z0-9-]+$/.test(base)) {
        throw new Error('emuNamespace() expects a lowercase slug, got: ' + String(base));
    }
    return base + '-' + process.pid + '-' + crypto.randomBytes(4).toString('hex');
}

module.exports = { emuNamespace };
