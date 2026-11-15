'use strict';

const REPOSITORY = 'mengsroy-h/Zoe-System';
const REVIEWER_ID = 313065015;
const SECRET_NAMES = Object.freeze(['ZOEW_KEYSTORE_BASE64', 'ZOEW_KEYSTORE_PASSWORD', 'ZOEW_KEY_ALIAS', 'ZOEW_KEY_PASSWORD', 'ZOE_RELEASES_TOKEN']);

function signingTarget(repository, ref, eventName) {
    if (repository !== REPOSITORY) throw new Error('repository-untrusted');
    if (typeof ref !== 'string' || !/^refs\/heads\/[^\x00-\x20~^:?*[\\]+$/.test(ref)) throw new Error('branch-required');
    const branch = ref.slice('refs/heads/'.length);
    if (eventName !== 'workflow_dispatch' && !(eventName === 'push' && branch === 'main')) throw new Error('event-untrusted');
    return { branch, environment: branch === 'main' ? 'android-signing' : 'android-signing-preview' };
}

function verifyProtection(target, environment, policies) {
    if (!environment || environment.name !== target.environment || !Number.isSafeInteger(environment.id) || environment.id <= 0) throw new Error('environment-missing');
    if (environment.can_admins_bypass !== false) throw new Error('admin-bypass-enabled');
    if (environment.deployment_branch_policy?.protected_branches !== false || environment.deployment_branch_policy?.custom_branch_policies !== true) throw new Error('branch-policy-unprotected');
    const rules = environment.protection_rules;
    if (!Array.isArray(rules)) throw new Error('protection-unverified');
    if (!policies || !Number.isSafeInteger(policies.total_count) || !Array.isArray(policies.branch_policies)
        || policies.total_count !== policies.branch_policies.length || policies.total_count < 1 || policies.total_count > 100) throw new Error('branch-policy-incomplete');
    const branchPolicies = policies.branch_policies;
    if (branchPolicies.some(policy => !policy || policy.type !== 'branch' || typeof policy.name !== 'string'
        || !policy.name || /[*?\[\]{}\\\x00-\x20]/.test(policy.name))) throw new Error('branch-policy-not-exact');
    if (!branchPolicies.some(policy => policy.name === target.branch)) throw new Error('branch-not-approved');
    if (target.branch === 'main') {
        if (branchPolicies.length !== 1 || branchPolicies[0].name !== 'main') throw new Error('main-environment-not-exclusive');
    } else {
        if (branchPolicies.some(policy => policy.name === 'main')) throw new Error('preview-environment-allows-main');
        const review = rules.filter(rule => rule?.type === 'required_reviewers');
        if (review.length !== 1 || !Array.isArray(review[0].reviewers) || review[0].reviewers.length !== 1
            || review[0].reviewers[0]?.type !== 'User' || review[0].reviewers[0]?.reviewer?.id !== REVIEWER_ID
            || review[0].reviewers[0]?.reviewer?.login !== 'mengsroy-h') throw new Error('owner-review-required');
    }
    return target;
}

async function readJson(url, token, fetcher) {
    let response;
    try {
        response = await fetcher(url, { headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token,
            'X-GitHub-Api-Version': '2022-11-28' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
    } catch { throw new Error('github-read-failed'); }
    if (!response || !response.ok) throw new Error('github-read-refused');
    let body;
    try {
        body = await response.text();
        if (Buffer.byteLength(body, 'utf8') > 262144) throw new Error('oversized');
        return JSON.parse(body);
    } catch { throw new Error('github-response-invalid'); }
}

async function preflight(env = process.env, fetcher = globalThis.fetch) {
    const target = signingTarget(env.GITHUB_REPOSITORY, env.GITHUB_REF, env.GITHUB_EVENT_NAME);
    if (typeof env.GH_TOKEN !== 'string' || !env.GH_TOKEN.trim()) throw new Error('github-token-missing');
    if (env.GITHUB_API_URL && env.GITHUB_API_URL !== 'https://api.github.com') throw new Error('github-origin-untrusted');
    const base = 'https://api.github.com/repos/' + REPOSITORY + '/environments/' + encodeURIComponent(target.environment);
    const environment = await readJson(base, env.GH_TOKEN, fetcher);
    const policies = await readJson(base + '/deployment-branch-policies?per_page=100', env.GH_TOKEN, fetcher);
    return verifyProtection(target, environment, policies);
}

module.exports = { signingTarget, verifyProtection, preflight, SECRET_NAMES };

if (require.main === module) {
    preflight().then(target => {
        console.log('បានផ្ទៀងការការពារ APK៖ ' + target.environment + ' / ' + target.branch);
    }).catch(error => {
        console.error('មិនអនុញ្ញាតចុះហត្ថលេខា APK៖ ' + error.message);
        console.error('កំណត់ GitHub Environment និង branch/reviewer protection តាម android-signing-environments.json ហើយផ្ទេរ signing secrets ចេញពី repository scope មុនរត់ឡើងវិញ។');
        process.exitCode = 1;
    });
}
