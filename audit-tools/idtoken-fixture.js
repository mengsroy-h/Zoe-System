// ឧបករណ៍រួម ៖ **Firebase ID token សាកល្បង** សម្រាប់ checker ដែលរត់
// `zto-order-detail.js` ពិត។
//
// ⛔ ហេតុអ្វីវាជាម៉ូឌុលរួម មិនមែនច្បាប់ចម្លងក្នុង checker នីមួយៗ ៖ វិញ្ញាបនបត្រ
// និងវិធីចុះហត្ថលេខាជា **តក្កវិជ្ជាតែមួយ** — ច្បាប់ចម្លងទី ២ នឹងឃ្លាតនៅជុំក្រោយ
// (ច្បាប់ ១២)។
//
// ⛔ សោនេះជា **សោសាកល្បងដែលបង្កើតសម្រាប់ audit** ៖ វាមិនដែលប្រើលើផលិតកម្ម
// ហើយវាមិនផ្តល់សិទ្ធិអ្វីទាំងអស់ — Google ទេដែលចុះហត្ថលេខា token ពិត។
const crypto = require('crypto');

const TEST_CERT_PEM = "-----BEGIN CERTIFICATE-----\nMIIDCTCCAfGgAwIBAgIUdChpK8vv+oBEBL7wldrlA9Li5/UwDQYJKoZIhvcNAQEL\nBQAwEzERMA8GA1UEAwwIem9lLXRlc3QwIBcNMjYwOTE2MDgzMjM3WhgPMjEyNjA4\nMjMwODMyMzdaMBMxETAPBgNVBAMMCHpvZS10ZXN0MIIBIjANBgkqhkiG9w0BAQEF\nAAOCAQ8AMIIBCgKCAQEAlZ2qHHYoESMeK3BtJ/TjOVvWgL0gjQuo4qDhMYyVzHXQ\nje2fItvUWRy7N+uU+s5IdrBzODVMtLbYUxVS/mfmaKb3fIcK3TBI8VMIsZ0PYzZu\n00oqD7DQEHWnkkt92tNWL64ODXETo+4g9jP/SHVkp2tkRB5HFNHIh9hATNI8SLYT\nAtplIDx9XaAP+WaBIEoyUj2GRxU/4lMDMQirC/UsEWI79YWCAwMvfq+Mp3h3nHKS\n1tsJ+xBbuxQ2jr4bXV7QRj70LPS7/cnYwJJukzlvsSNQwQJdwt+cc8j5GKGU/tAt\nBeuSlRD8Tgv3KTSLsjlkePjJX5s9VSZEtAUf9GcJrwIDAQABo1MwUTAdBgNVHQ4E\nFgQULpmESUnrzrAsGQQRsWeABJ2zByIwHwYDVR0jBBgwFoAULpmESUnrzrAsGQQR\nsWeABJ2zByIwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEALIq1\nQW5W84L9k2Q2GeVzILFQmGn4BW9nfdm5Mbe66UAsJrL+VMQkHm+IZMCb6NQuuvbj\nZo0Oxc8jG0XQGiKb5AI0TLtYBlSoRpmkWXHj/YRpaCFLqnlv/0T9W7ByZZDQW7qi\n1UTvxkQiss1ozreNk3beb5H6vZqTJGMBZVeCD6vWkZ0ldQqTye0ywC1dwW+9wufy\nNRKsW1qVK0Xx/+d6C0F75HoFh2x7xzOoLbwd6ALW3FmRCE5erlh6FdXK46p47m01\n6I7ViA1ns5LzrTM8IjkRPHSUDI9B7q2ah+i2AXJ1ew9V5FQQ0hzr9UHbLNh0ngy4\ng4jut8XcE+U42ulBlg==\n-----END CERTIFICATE-----";

const TEST_KEY_PEM = "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCVnaocdigRIx4r\ncG0n9OM5W9aAvSCNC6jioOExjJXMddCN7Z8i29RZHLs365T6zkh2sHM4NUy0tthT\nFVL+Z+Zopvd8hwrdMEjxUwixnQ9jNm7TSioPsNAQdaeSS33a01Yvrg4NcROj7iD2\nM/9IdWSna2REHkcU0ciH2EBM0jxIthMC2mUgPH1doA/5ZoEgSjJSPYZHFT/iUwMx\nCKsL9SwRYjv1hYIDAy9+r4yneHeccpLW2wn7EFu7FDaOvhtdXtBGPvQs9Lv9ydjA\nkm6TOW+xI1DBAl3C35xzyPkYoZT+0C0F65KVEPxOC/cpNIuyOWR4+Mlfmz1VJkS0\nBR/0ZwmvAgMBAAECggEAFacCIelVphlDefzkxzYRFlF8qxfz2IW59MZcoMucOEFK\no+eiMqzGv/jA/XhKELv+z7J8kkNgbPzTNL7uymOl/DpBsdNnVphwzf/6z52Pxwdv\nJYPjr26ixecJD8p+Fcek/vR9EyPsuDozqf3fcZCPtwz7L0KEffZYQ5SfxZ5dXBZI\n5uXTM7nY6lsf2oH7udS7aWkKmwIHR3yN6sysiSUjZKkHR7qLgORdrS6V/adBgi3I\nq2VkPPwo4XCIeg/Y+Da/sHZXSXAb7n8+XmAS7FNx7oJZC3XBqEYAV8ndcqeGlA4r\nHSAvIu/YVCSqu8G+N/klhijTiLmkYjZUTyWvDOh6wQKBgQDFkFoCQQFeqfX9ul8H\n4p2deepk+j4aYiNKPa8cFfP12SzqpoIKA3sJjANFlq+xsLCDcdi32MJh4VIQ/kzY\nvVv8LpAuDAYoVZIF4evKOkSAxn3kurqbOmM8n8Rd+aIBOn3wOTdbTsh0b3APcNbM\nl8gyOxGfP7lJ1r06t6cMD5Zq7wKBgQDB3qnXoqykWCKpyTBpyxjFGhBFnaK1OsTd\nt4Hmy763qYwcLsACzZ1gCDtlFkiq5AtKuvYoV1T730607TCMKVZiDFGJ9Q9qVJSY\nx/BxIk1/pU+rN3NVmFNUrER8/BJ6eUdJtQLOzRC+7q64tAVuaBmfae4VJpy6jzF2\njzNwf7RNQQKBgEjyIanPYrgXPTKwC8KXk+a/SyJ5m1CWh70zxWIzYN6Xj5QcYstb\nuaQuxE5/cuPC/4mpEYHgUPVfArQvkSQ91qbocmfuHJ/r6HyvjCYhGYYKxBUeNSR3\njIin3RNtxrl5ZWK7XYsjLbSAKPoqicUFDfAuCzWni7yNw1TY1p8HalyVAoGAdXjV\nU0tH7yFUh6rYAhLFhJEhcP1unP/qUCqktNOaUbGTq3QMduZeSNVUIBGboKkjynl1\nNMaOQTxzdaAPfa6CoFC0i7KJT7XGgLkOEY9mhEUH/EhSQ3hUbgcgTNd03u9j6d6b\nv/F0By2bg2HZtKexdu36DKjj6QthPmTRF4baGsECgYA5k0RdcPKluP3m5BuRp7SD\ne5i0k8+d5jlr5NF0tk4COqsLNgfJy0RaEdzdkEwaUmPjvDRm92B9caT4bW4Dwr77\nJ+YF+hQ1GiNjGW0OgQj+E+DhDxs6FDEZ5e/baiWyFIhMb10HP8MAmDsJmeCVpTDq\npg8ReHMz5sT7NyryesyCeQ==\n-----END PRIVATE KEY-----";

const TEST_KID = 'zoe-test-kid';
const TEST_PROJECT = 'zoew-v1';
const CERTS_HOST = 'googleapis.com';

const b64url = (buf) => Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ⛔ token ត្រូវចុះហត្ថលេខា **ពិត** — stub នឹងលុបស្នាមភ្ជាប់ដែលកំពុងវាស់
// (សំណួរទី ៧ ៖ «ការ stub ស្នាមភ្ជាប់ដែលអ្នកវាស់ = វាស់អ្វីផ្សេង»)។
function tokenFor(email, opts) {
    const o = opts || {};
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: o.alg || 'RS256', kid: o.kid === undefined ? TEST_KID : o.kid, typ: 'JWT' };
    const payload = Object.assign({
        iss: 'https://securetoken.google.com/' + (o.aud || TEST_PROJECT),
        aud: o.aud || TEST_PROJECT,
        sub: 'uid', email: email,
        iat: now - 30, exp: now + 3600
    }, o.claims || {});
    const signed = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
    if (o.forge) return signed + '.' + b64url(Buffer.alloc(256, 7));
    return signed + '.' + b64url(crypto.sign('RSA-SHA256', Buffer.from(signed),
        crypto.createPrivateKey(TEST_KEY_PEM)));
}

// ⛔ ចេតនារបស់តេស្ត «សុំសាខា X» ប្រែជា «អ្នកប្រើដែល email ផ្ទុក X» ៖ លេខសាខា
// លែងជា parameter ទៀតហើយ។ លេខដែលរូបរាងខុស ➜ គណនីគ្មានសាខា។
function tokenForSite(site) {
    const code = String(site === undefined || site === null ? '' : site).trim();
    return tokenFor(/^[0-9]{4,12}$/.test(code) ? 'u@zoew' + code + '.com' : 'u@zoew.com');
}

// ⛔ stub ដែលឆ្លើយ **គ្រប់** URL ដូចគ្នា នឹងធ្វើឲ្យការទាញវិញ្ញាបនបត្រធ្លាក់
// ➜ ការផ្ទៀងផ្ទាត់ចេញ `idtoken:certs` ➜ ការអះអាងអំពី **ZTO** វាស់អ្វីផ្សេង។
function withCerts(fn) {
    return async (href, init) => {
        if (String(href).indexOf(CERTS_HOST) !== -1) {
            return { ok: true, status: 200, headers: { get: () => 'application/json' },
                json: async () => ({ [TEST_KID]: TEST_CERT_PEM }) };
        }
        return fn(href, init);
    };
}

module.exports = { TEST_CERT_PEM, TEST_KEY_PEM, TEST_KID, TEST_PROJECT, CERTS_HOST,
    tokenFor, tokenForSite, withCerts };
