'use strict';

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

    // Least privilege: ask for access to this one site only, at save time.
    const granted = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
    if (!granted) {
        say('❌ ត្រូវអនុញ្ញាតសិទ្ធិចូល ' + origin + ' ដើម្បីផ្ញើ cookie', 'err');
        return;
    }

    await chrome.storage.local.set({ endpoint, updateKey });
    say('✅ រក្សាទុករួចរាល់ — ចុចរូប extension ពេលនៅលើ Argus', 'ok');
});
