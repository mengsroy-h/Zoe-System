'use strict';

// Cookies that would be sent to the API host win over the UI host, because the
// API host is the one the Netlify function actually talks to.
const COOKIE_URLS = [
    'https://aargus-api.ztoglobal.com/',
    'https://argus.ztoglobal.com/'
];

// Same two hosts as match patterns, for permission checks and requests.
const COOKIE_ORIGINS = COOKIE_URLS.map((url) => url + '*');

const BADGE_RESET_MS = 8000;

async function readCookieHeader() {
    const seen = new Map();
    const problems = [];
    for (const url of COOKIE_URLS) {
        let list = [];
        try {
            list = await chrome.cookies.getAll({ url });
        } catch (error) {
            problems.push(url + ' -> ' + (error && error.message ? error.message : 'read failed'));
            list = [];
        }
        for (const cookie of list) {
            if (!seen.has(cookie.name)) seen.set(cookie.name, cookie.value);
        }
    }
    return {
        header: Array.from(seen, ([name, value]) => name + '=' + value).join('; '),
        problems
    };
}

// An empty jar has three very different causes, and the old message named only
// one of them. Say which one it actually is.
async function emptyJarReason() {
    let granted = false;
    try {
        granted = await chrome.permissions.contains({ origins: COOKIE_ORIGINS });
    } catch (_) {
        granted = false;
    }
    if (!granted) {
        return 'No cookie access for ztoglobal.com - open the extension options and press Save to grant it.';
    }

    let stores = [];
    try {
        stores = await chrome.cookies.getAllCookieStores();
    } catch (_) {
        stores = [];
    }
    if (stores.length > 1) {
        return 'No Argus cookie in this browser profile (' + stores.length
            + ' cookie stores found) - open Argus in the same profile as this extension.';
    }
    return 'No Argus cookie found - open argus.ztoglobal.com and log in first.';
}

async function readSettings() {
    const stored = await chrome.storage.local.get(['endpoint', 'updateKey']);
    return {
        endpoint: String(stored.endpoint || '').trim(),
        updateKey: String(stored.updateKey || '').trim()
    };
}

function setBadge(text, color, title) {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
    chrome.action.setTitle({ title });
    if (text) {
        setTimeout(() => {
            chrome.action.setBadgeText({ text: '' });
            chrome.action.setTitle({ title: 'Send ZTO cookie to ZoeW' });
        }, BADGE_RESET_MS);
    }
}

function fail(message) {
    setBadge('X', '#dc2626', message);
}

chrome.action.onClicked.addListener(async () => {
    const settings = await readSettings();
    if (!settings.endpoint || !settings.updateKey) {
        chrome.runtime.openOptionsPage();
        return;
    }

    setBadge('...', '#2563eb', 'Sending cookie to ZoeW...');

    const jar = await readCookieHeader();
    if (!jar.header || jar.header.length < 8) {
        const reason = await emptyJarReason();
        fail(jar.problems.length ? reason + ' [' + jar.problems.join(' | ') + ']' : reason);
        return;
    }

    let response;
    let payload = {};
    try {
        // text/plain keeps this a CORS "simple request" (no preflight).
        response = await fetch(settings.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ key: settings.updateKey, cookie: jar.header })
        });
        payload = await response.json().catch(() => ({}));
    } catch (error) {
        fail('Could not reach ZoeW: ' + (error && error.message ? error.message : 'network error'));
        return;
    }

    if (response.ok && payload.ok) {
        const names = Array.isArray(payload.cookieNames) ? payload.cookieNames.length : 0;
        setBadge(
            payload.deployTriggered ? 'OK' : '!',
            payload.deployTriggered ? '#16a34a' : '#d97706',
            payload.deployTriggered
                ? 'Cookie updated (' + names + ' pairs) - deploy started.'
                : 'Cookie updated (' + names + ' pairs) - ' + (payload.note || 'deploy NOT started')
        );
        return;
    }

    fail('ZoeW rejected it (HTTP ' + response.status + '): '
        + (payload.error || payload.code || 'unknown error')
        + (payload.reason ? ' [' + payload.reason + ']' : ''));
});
