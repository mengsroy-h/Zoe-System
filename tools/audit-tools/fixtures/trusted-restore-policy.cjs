'use strict';

const assert = require('node:assert/strict');

function localRestorePolicy(scope) {
    assert.equal(typeof scope, 'string');
    assert.ok(scope.trim() && scope === scope.trim(), 'fixture ត្រូវកំណត់ scope ពិតដោយផ្ទាល់');
    return { v: 1, mode: 'local', scope, branch: '', epoch: 1 };
}

module.exports = { localRestorePolicy };
