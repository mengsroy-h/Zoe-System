'use strict';

// Chrome can withhold a declared host permission, and chrome.cookies then
// returns an empty list instead of an error. Ask for it here, where a user
// gesture exists, so the failure cannot be silent.
const COOKIE_ORIGINS = [
    'https://aargus-api.ztoglobal.com/*',
    'https://argus.ztoglobal.com/*'
];

const endpointEl = document.getElementById('endpoint');
const keyEl = document.getElementById('updateKey');
const msgEl = document.getElementById('msg');

function say(text, cls) {
    msgEl.textContent = text;
    msgEl.className = cls || '';
}

chrome.storage.local.get(['endpoint', 'updateKey']).then((stored) => {
    endpointEl.value = stored.endpoint || '';
    keyEl.value = stored.updateKey || '';
});

document.getElementById('save').addEventListener('click', async () => {
    const endpoint = endpointEl.value.trim();
    const updateKey = keyEl.value.trim();

    let origin;
    try {
        const url = new URL(endpoint);
        if (url.protocol !== 'https:') throw new Error('https required');
        origin = url.origin + '/*';
    } catch (_) {
        say('❌ Endpoint ត្រូវជា URL https ត្រឹមត្រូវ', 'err');
        return;
    }
    if (!updateKey) {
        say('❌ ត្រូវបំពេញ update key', 'err');
        return;
    }

    // Least privilege: the ZoeW site plus the two ZTO hosts we read cookies from.
    const wanted = [origin].concat(COOKIE_ORIGINS);
    const granted = await chrome.permissions.request({ origins: wanted }).catch(() => false);
    if (!granted) {
        say('❌ ត្រូវអនុញ្ញាតសិទ្ធិចូល ' + wanted.join(' · ') + ' ដើម្បីអាន និងផ្ញើ cookie', 'err');
        return;
    }

    await chrome.storage.local.set({ endpoint, updateKey });
    say('✅ រក្សាទុករួចរាល់ — ចុចរូប extension ពេលនៅលើ Argus', 'ok');
});
