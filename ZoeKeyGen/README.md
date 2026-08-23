# ZoeKeyGen — កម្មវិធីបង្កើត និងគ្រប់គ្រង Activation Key

ZoeKeyGen គឺជា PWA សម្រាប់ Admin បង្កើត, revoke និងបន្ថែមសុពលភាព Activation Key របស់ ZoeW។ វាត្រូវប្រើ Firebase Project **ដាច់ដោយឡែកពី Business Firebase Project** ដើម្បីបំបែកគណនី License និង private signing key ចេញពីទិន្នន័យ Parcel/COD/DOD។

កំណែបច្ចុប្បន្ន៖ **2.6.1** (កំណែតែមួយប្រើរួមគ្នាទាំង ZoeW និង ZoeKeyGen — មើល [CHANGELOG.md](../CHANGELOG.md))។

## រចនាសម្ព័ន្ធ License

- Key ប្រើហត្ថលេខា ECDSA P-256។ Private key ចុះហត្ថលេខា; public key ផ្ទៀងផ្ទាត់។
- Private key មិនត្រូវដាក់ក្នុង source code, Firebase, ticket ឬ chat ទេ។ រក្សាវានៅ password manager ឬឧបករណ៍សុវត្ថិភាព។
- `PUBLIC_KEYS_JWK` ក្នុង `license-verify.js` ត្រូវដូចគ្នាបេះបិទនៅ ZoeW និង ZoeKeyGen។ មុនចេញ Key ពី keypair ថ្មី ត្រូវ deploy public key ថ្មីទៅ App ទាំង ២ ជាមុន។
- `license_keys/{app}/{id}` មានតែព័ត៌មានសាធារណៈដែល App ត្រូវការផ្ទៀងផ្ទាត់ (`expiresAt`, `revoked`)។ ព័ត៌មានគ្រប់គ្រងដូចជា note, issuer និង scope ស្ថិតក្នុង `license_keys_meta` ដែល Admin-only។

## ការចូល និងការរក្សាសម្ងាត់

- ចូលបានតែ Firebase user ដែលមាន `user_roles/{uid} = "admin"` ក្នុង License Firebase Project។
- Firebase Auth ប្រើ **browser session persistence** ជានិច្ច។ បិទ browser ហើយត្រូវចូលឡើងវិញ។
- Checkbox «ចងចាំអ៊ីមែល» រក្សាទុកតែអ៊ីមែលសម្រាប់បំពេញ form ប៉ុណ្ណោះ; វាមិនរក្សា session ចូលប្រព័ន្ធទេ។
- បើជ្រើសចងចាំ Signing Key សម្រាប់ session នោះ ciphertext ត្រូវ encrypt ដោយ PIN។ ការស្ដារវិញត្រូវការទាំង Admin session ដែលបានផ្ទៀងផ្ទាត់, PIN និងការត្រួតពិនិត្យថា private key ផ្គូផ្គងនឹង public key ដែលបាន deploy។ បរាជ័យម្តងណា ciphertext នោះត្រូវបោះចោល។
- Logout, បោះបង់ PIN ឬបិទ modal សម្អាត PIN/private key/result ដែលរសើប និងរារាំង async operation ចាស់មិនឱ្យបញ្ចូលវាត្រឡប់ក្នុង DOM។

## Setup លើកដំបូង

1. បង្កើត Firebase Project សម្រាប់ License ដាច់ពី Project អាជីវកម្ម។ បើក Realtime Database និង Email/Password Authentication។
2. បង្កើត Firebase Admin user ហើយកំណត់ `user_roles/<UID> = "admin"` តាម Firebase Console។
3. Paste `ZoeKeyGen/firebase-database.rules.json` ទៅ License Project ហើយ **Publish ដោយដៃ**។
4. Deploy ថត `ZoeKeyGen` ទៅ static hosting ហើយកំណត់ Firebase Config ក្រោម Security PIN។
5. កំណត់ `LICENSE_DB_URL` តែមួយក្នុង `license-verify.js` ទាំង ២ ឱ្យទៅ License Project នេះ។ ផ្ទៀងផ្ទាត់ byte-identical មុន deploy។
6. បង្កើត keypair ម្តង ហើយរក្សា Private Key ឱ្យសុវត្ថិភាព។ ដាក់ Public Key ទៅ `PUBLIC_KEYS_JWK` ទាំង ២ រួច deploy ទាំងអស់។

## ការប្រើប្រាស់ប្រចាំថ្ងៃ

1. Load Private Signing Key ដែលផ្គូផ្គងនឹង public key ក្នុង App។
2. ជ្រើស App គោលដៅ (`ADM`, `ZOW`, `SCN` ឬ `ALL`), ចំនួនថ្ងៃ និងចំណាំដែលមិនមានព័ត៌មានរសើប។
3. Generate Key ហើយចម្លង Key ផ្ញើតាម channel សុវត្ថិភាព។ Result មិនគួរទុកនៅលើឧបករណ៍ចែករំលែក។
4. ប្រើ Revoke ដើម្បីបិទសិទ្ធិ ឬ Extend ដើម្បីបន្ថែមថ្ងៃ។ សម្រាប់ Key `ALL` ដែលការសរសេរបរាជ័យមួយផ្នែក សូមពិនិត្យ badge ព្រមាន និងកែសម្រួល path ដែលបរាជ័យ មុនសន្មតថាវាដំណើរការគ្រប់ App។

ការផ្ទៀងផ្ទាត់ online នៅ App គោលដៅធ្វើឡើងពេល login/refresh និងជាប្រចាំ; ពេលអ៊ីនធឺណិតមិនមាន វាអាចប្រើ offline grace បានរហូតដល់ ៣ ថ្ងៃបន្ទាប់ពីការផ្ទៀងផ្ទាត់ជោគជ័យចុងក្រោយ។

## ការប្ដូរ/rotate Key

ការបង្កើត keypair ថ្មីធ្វើឱ្យ private key ចាស់មិនផ្គូផ្គងនឹង public key ថ្មី។ មុនចែក Key ដែលចុះហត្ថលេខាថ្មី៖

1. backup Private Key ចាស់ និងកត់ត្រាថាតើ Key ចាស់ណានៅមានសុពលភាព;
2. បន្ថែម public key ថ្មីទៅ `PUBLIC_KEYS_JWK` នៅ App ទាំង ២ (អាចរក្សា public key ចាស់សម្រាប់ transition);
3. deploy App ទាំង ២ និងផ្ទៀងផ្ទាត់ `license-verify.js` byte-identical;
4. ទើប Load private key ថ្មី និងចេញ Activation Key ថ្មី។

កុំលុប public key ចាស់រហូតដល់គ្មាន Key ដែលចុះហត្ថលេខាដោយវានៅត្រូវ verify។

## Deploy និងតេស្ត

Deploy ជា static site និងប្តូរ Service Worker cache ពេលមាន asset ផ្លាស់ប្តូរ។ `APP_VERSION` និង `manifest.json` របស់ App ទាំង ២ ត្រូវដូចគ្នា។

```bash
node --check ZoeKeyGen/app.js
node audit-tools/keygen-pin-flow-test.js
node audit-tools/keygen-session-security-test.js
node audit-tools/version-check.js
bash audit-tools/run-all.sh
```

## អាជ្ញាប័ណ្ណ

គម្រោងនេះជាកម្មសិទ្ធិឯកជន — Powered by ZoeW.
