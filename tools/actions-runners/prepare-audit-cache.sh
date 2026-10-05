#!/usr/bin/env bash
set -euo pipefail

CACHE=${ZOE_AUDIT_CACHE:-"$HOME/.cache/zoe-audit"}
mkdir -p "$CACHE"

case "${1:-}" in
  init)
    if [ -z "${ZOE_AUDIT_CACHE:-}" ]; then
      echo '::error::ត្រូវ update Linux image និង compose ដើម្បីបើក audit-binaries cache រួម។ មើល docs/SELF-HOSTED-RUNNERS.md ជំហានទី ១៧។' >&2
      exit 1
    fi
    mkdir -p "$CACHE/ms-playwright" "$CACHE/firebase-legacy"
    (
      flock 9
      # បញ្ចូលតែ browser ដែល Playwright បានទាញចប់; មិនចម្លង workspace ឬ registration។
      for source in "$HOME"/.cache/ms-playwright/*; do
        [ -d "$source" ] && [ -f "$source/INSTALLATION_COMPLETE" ] || continue
        target="$CACHE/ms-playwright/$(basename "$source")"
        [ ! -e "$target" ] || continue
        staging=$(mktemp -d "$CACHE/.browser-seed.XXXXXX")
        cp -a "$source/." "$staging/"
        mv "$staging" "$target"
      done
    ) 9> "$CACHE/.chromium.lock"
    (
      flock 9
      name=${RUNNER_NAME:-local}
      name=${name//[^a-zA-Z0-9_-]/_}
      mkdir -p "$CACHE/firebase-legacy/$name"
      # JAR ចាស់នៅជាបេក្ខជន; database mode ផ្ទៀង size/checksum មុនប្រើ។
      for source in "$HOME"/.cache/firebase/emulators/firebase-database-emulator-*.jar; do
        [ -f "$source" ] || continue
        target="$CACHE/firebase-legacy/$name/$(basename "$source")"
        staging=$(mktemp "$CACHE/.database-seed.XXXXXX")
        cp "$source" "$staging"
        mv "$staging" "$target"
      done
    ) 9> "$CACHE/.database.lock"
    FB_VERSION=$(node -p "require('./tools/firebase-provision/package-lock.json').packages['node_modules/firebase-tools'].version")
    printf '%s\n' "PLAYWRIGHT_BROWSERS_PATH=$CACHE/ms-playwright" \
      'PLAYWRIGHT_SKIP_BROWSER_GC=1' "FIREBASE_EMULATORS_PATH=$CACHE/firebase/$FB_VERSION" >> "${GITHUB_ENV:?}"
    ;;
  chromium)
    export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-"$CACHE/ms-playwright"}
    export PLAYWRIGHT_SKIP_BROWSER_GC=1
    # Lock គ្របតែការដំឡើង; run-all របស់ runner ទាំង៤នៅរត់ស្របគ្នា។
    flock "$CACHE/.chromium.lock" npx --no-install playwright install chromium
    ;;
  database)
    export FIREBASE_EMULATORS_PATH=${FIREBASE_EMULATORS_PATH:-"$HOME/.cache/firebase/emulators"}
    mkdir -p "$FIREBASE_EMULATORS_PATH"
    (
      flock 9
      node <<'NODE'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const info = require(path.resolve('tools/firebase-provision/node_modules/firebase-tools/lib/emulator/downloadableEmulatorInfo.json')).database;
const filename = info.downloadPathRelativeToCacheDir;
if (!filename || path.basename(filename) !== filename || !Number.isSafeInteger(info.expectedSize) || info.expectedSize <= 0) {
    throw new Error('Firebase emulator metadata មិនត្រឹមត្រូវ');
}
const algorithm = info.expectedChecksumSHA256 ? 'sha256' : 'md5';
const expected = info.expectedChecksumSHA256 || info.expectedChecksum;
if (typeof expected !== 'string' || !new RegExp('^[a-f0-9]{' + (algorithm === 'sha256' ? 64 : 32) + '}$').test(expected)) {
    throw new Error('Firebase emulator checksum មិនត្រឹមត្រូវ');
}
const jar = path.join(process.env.FIREBASE_EMULATORS_PATH, filename);
function valid(file) {
    try {
        return fs.statSync(file).size === info.expectedSize
            && crypto.createHash(algorithm).update(fs.readFileSync(file)).digest('hex') === expected;
    } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
if (!valid(jar)) {
    const candidates = [path.join(process.env.HOME, '.cache/firebase/emulators', filename)];
    const cache = process.env.ZOE_AUDIT_CACHE || path.join(process.env.HOME, '.cache/zoe-audit');
    const legacy = path.join(cache, 'firebase-legacy');
    if (fs.existsSync(legacy)) {
        for (const entry of fs.readdirSync(legacy, { withFileTypes: true })) {
            if (entry.isDirectory()) candidates.push(path.join(legacy, entry.name, filename));
        }
    }
    const source = candidates.find(valid);
    if (source && source !== jar) {
        const temporary = jar + '.seed-' + process.pid;
        fs.copyFileSync(source, temporary);
        fs.renameSync(temporary, jar);
        console.log('RTDB cache reuse: ' + source);
    }
}
if (!valid(jar)) {
    console.log('RTDB cache miss: ' + filename);
    const result = cp.spawnSync(path.resolve('tools/firebase-provision/node_modules/.bin/firebase'),
        ['setup:emulators:database'], { stdio: 'inherit', env: process.env });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}
if (!valid(jar)) throw new Error('RTDB JAR មិនត្រូវ size/checksum ក្រោយ download');
console.log('RTDB cache ready: ' + jar);
fs.appendFileSync(process.env.GITHUB_ENV, 'ZOE_RTDB_JAR=' + jar + '\n');
NODE
    ) 9> "$CACHE/.database.lock"
    ;;
  *)
    echo 'ប្រើ: prepare-audit-cache.sh init|chromium|database' >&2
    exit 2
    ;;
esac
