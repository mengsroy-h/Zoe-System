# ZoeKeyGen - ប្រព័ន្ធបង្កើត Activation Key

**ZoeKeyGen** គឺជាកម្មវិធីគេហទំព័រ (Web App) **ដាច់ដោយឡែក** សម្រាប់ Admin ប្រើដើម្បី **បង្កើត Activation Key** សម្រាប់ដាក់ Active កម្មវិធី **ZoeAdmin**, **ZoeW** និង **Zoescan**។ កម្មវិធីនេះមិនមែនសម្រាប់បុគ្គលិកទូទៅប្រើទេ — មានតែ Admin ប៉ុណ្ណោះទើបចូលបាន។

**សំខាន់**៖ ZoeKeyGen ប្រើ **Firebase Project ដាច់ដោយឡែក** ខុសពី Project ដែល ZoeAdmin/ZoeW/Zoescan ប្រើសម្រាប់ទិន្នន័យអាជីវកម្ម (Parcel/COD/DOD)។ នេះជាការញែក (Isolation) ដោយចេតនា — ទោះបីជា Project អាជីវកម្មមានបញ្ហាសុវត្ថិភាពណាមួយក៏ដោយ Private Signing Key និងគណនី Admin របស់ប្រព័ន្ធ License នៅតែមិនរងផលប៉ះពាល់ដែរ។

## របៀបដំណើរការ (Architecture)

Key ត្រូវបានផលិតឡើងជាមួយ **ហត្ថលេខាឌីជីថល ECDSA P-256 (Digital Signature)** មិនមែនគ្រាន់តែជាលេខកូដចៃដន្យធម្មតាទេ៖

1. **Private Key** (សម្រាប់ចុះហត្ថលេខាបង្កើត Key) **មិនដែលរក្សាទុកនៅក្នុង Source Code ឬ Firebase ឡើយ** — វានៅតែក្នុងសតិ Browser របស់ Admin ពេលកំពុងប្រើ ZoeKeyGen ប៉ុណ្ណោះ (Session memory) ហើយបាត់ភ្លាមពេលបិទទំព័រ។ Admin ត្រូវរក្សាទុក Private Key ដោយខ្លួនឯង (ឧ. Password Manager) ហើយបិទភ្ជាប់ចូល ZoeKeyGen រាល់ពេលត្រូវការបង្កើត Key។
2. **Public Key** (សម្រាប់ត្រួតពិនិត្យ/Verify ហត្ថលេខា) ត្រូវបាន Embed ដាក់ក្នុងឯកសារ `license-verify.js` របស់ ZoeAdmin, ZoeW, Zoescan និង ZoeKeyGen ខ្លួនឯង។ Public Key អាចផ្សព្វផ្សាយបានដោយសុវត្ថិភាព ព្រោះមិនអាចយកទៅបង្កើត/ក្លែងបន្លំ Key ថ្មីបានឡើយ (លក្ខណៈគណិតវិទ្យារបស់ Asymmetric Cryptography)។
3. Key នីមួយៗត្រូវបានចងភ្ជាប់ជាមួយ **កម្មវិធីគោលដៅ** (ADM/ZOW/SCN/ALL) និង **ថ្ងៃផុតកំណត់** ដោយផ្ទាល់ក្នុងហត្ថលេខា — ការកែប្រែ Key ខាងក្រៅ (ឧ. តាមរយៈ DevTools ឬ localStorage) នឹងធ្វើឲ្យហត្ថលេខាខូច និងត្រូវបដិសេធភ្លាមៗ។
4. គ្រប់ Key ដែលបង្កើតត្រូវបានកត់ត្រាទុកក្នុង **Firebase Realtime Database ដាច់ដោយឡែក** (`license_keys/{app}/{id}`, Project របស់ ZoeKeyGen ខ្លួនឯង — មិនមែន Project របស់ ZoeAdmin ទេ) ដើម្បីឲ្យ Admin អាច **Revoke** (ដកហូតសិទ្ធិភ្លាមៗ) ឬ **Extend** (បន្ថែមសុពលភាព) បានគ្រប់ពេល ដោយមិនចាំបាច់ចេញ Key ថ្មី។
5. កម្មវិធីទាំង ៣ (ZoeAdmin/ZoeW/Zoescan) ផ្ទៀងផ្ទាត់ស្ថានភាព Key ជាមួយ Database នេះឡើងវិញជាទៀងទាត់ (រាល់ពេល Login/Refresh ថ្មី ព្រមទាំងរៀងរាល់ ១៥នាទីក្នុងកំឡុងពេលកំពុងបើកប្រើផងដែរ ដើម្បីកុំឲ្យ Session ដែលកំពុងបើករបងចោល Revoke រហូត) តាមរយៈ **HTTPS REST call ធម្មតា** (មិនចាំបាច់ Login ចូល Project នេះទេ ព្រោះទិន្នន័យ `license_keys` អនុញ្ញាតឲ្យអានជាសាធារណៈ — មិនមានព័ត៌មានសម្ងាត់អ្វីនៅក្នុងនោះទេ គ្រាន់តែជាថ្ងៃផុតកំណត់/ស្ថានភាព Revoke)។ ដូច្នេះ Revoke មានប្រសិទ្ធភាពលឿន បើទោះបីជា Key នៅមិនទាន់ផុតកំណត់ក៏ដោយ។
6. ក្នុងករណីគ្មានអ៊ីនធឺណិត កម្មវិធីអនុញ្ញាតឲ្យប្រើបន្តបានរហូតដល់ ៣ថ្ងៃចាប់ពីការផ្ទៀងផ្ទាត់លើកចុងក្រោយ (Offline Grace) មុននឹងតម្រូវឲ្យភ្ជាប់អ៊ីនធឺណិតម្តងទៀត។

## របៀបប្រើប្រាស់ (Setup)

### ជំហានទី ១ — បង្កើត Firebase Project ថ្មីសម្រាប់ License

1. ចូល [Firebase Console](https://console.firebase.google.com) → **Add project** → ដាក់ឈ្មោះ ឧ. `zoe-license` (ដាច់ដោយឡែកទាំងស្រុងពី Project របស់ ZoeAdmin)។
2. **Build → Realtime Database → Create Database** (ជ្រើស Region ណាមួយ) → ចាប់ផ្តើមក្នុងរបៀប Locked mode។
3. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**។
4. ក្នុង Authentication → **Users → Add user** បង្កើតគណនី Admin មួយ (Email/Password) សម្រាប់ចូល ZoeKeyGen ខ្លួនអ្នក ហើយចម្លងយក **User UID** របស់គណនីនោះទុក។
5. ក្នុង Realtime Database → **Rules** → បិទភ្ជាប់ខ្លឹមសារពេញលេញនៃឯកសារ `ZoeKeyGen/firebase-database.rules.json` (មានក្នុង Repo នេះ) → **Publish**។
6. ក្នុង Realtime Database → **Data** → បង្កើត Path `user_roles/<UID ដែលចម្លងពីជំហានទី ៤>` ដាក់តម្លៃជា String `"admin"` ដោយផ្ទាល់ (Rules រារាំង App មិនឲ្យសរសេរ Path នេះបានទេ ដូច្នេះត្រូវធ្វើដោយដៃម្តងគត់ តាមរយៈ Console)។
7. ក្នុង Project Settings (រូប ⚙️) → **General → Your apps → Add app (Web `</>`)** → ចម្លងយក Firebase Config JSON (`apiKey`, `authDomain`, `databaseURL`, `projectId`...) និង **Database URL** ដាច់ដោយឡែក (ចាំបាច់ត្រូវប្រើនៅជំហានទី ៣)។

### ជំហានទី ២ — Deploy ZoeKeyGen

1. Deploy ZoeKeyGen ទៅ Netlify ជា Site ថ្មី (Base directory = `ZoeKeyGen`, ដូចជា App ដទៃទៀត)។
2. បើកចូល ZoeKeyGen ជាលើកដំបូង → កំណត់ Security PIN → បិទភ្ជាប់ **Firebase Config របស់ Project `zoe-license`** (ជំហានទី ១.៧ ខាងលើ — មិនមែន Config របស់ ZoeAdmin ទេ!)។
3. ចូលគណនី Admin ដែលបានបង្កើតនៅជំហានទី ១.៤។

### ជំហានទី ៣ — ភ្ជាប់ Database URL ចូល App ទាំង ៤ (ធ្វើម្តងគត់)

ឯកសារ `license-verify.js` (ដូចគ្នាបេះបិទក្នុង ZoeAdmin, ZoeW, Zoescan, ZoeKeyGen) មាន Constant មួយឈ្មោះ `LICENSE_DB_URL` ដែលត្រូវតែជា **Database URL** ពិតប្រាកដនៃ Project `zoe-license` ដាច់ដោយឡែក ពីជំហានទី ១.៧ (ឧ. `https://zoe-license-default-rtdb.firebasedatabase.app`) — **មិនមែន** Database URL របស់ ZoeW (ទិន្នន័យអាជីវកម្ម) ទេ។ តម្លៃបច្ចុប្បន្នដែលកត់ត្រាទុកក្នុងឯកសារទាំង ៤ ច្បាប់គឺ `https://zoew-z1-default-rtdb.firebaseio.com` — សូមផ្ទៀងផ្ទាត់ម្តងទៀតថានេះពិតជា URL របស់ Project `zoe-license` មែន (ឈ្មោះ `zoew-z1` អាចជា Project ID ចាស់/ខាងក្នុងតែប៉ុណ្ណោះ) មិនមែនជា URL របស់ App ZoeW ខុសដោយចៃដន្យទេ មុននឹង Deploy។ បើ URL ខុស App ទាំង ៣ (ZoeAdmin/ZoeW/Zoescan) នៅតែដំណើរការជាមួយ Key ដែលមានហត្ថលេខាត្រឹមត្រូវបាន (ការត្រួតពិនិត្យ Offline តាមហត្ថលេខានៅតែដំណើរការធម្មតា) ប៉ុន្តែមុខងារ Revoke ភ្លាមៗ/ផ្ទៀងផ្ទាត់ Online នឹងមិនដំណើរការទេ។ បើត្រូវការផ្លាស់ប្តូរ សូមកែក្នុងឯកសារទាំង ៤ ច្បាប់ឲ្យដូចគ្នាបេះបិទ (`cp` + `md5sum`) រួច Deploy ឡើងវិញ។

### ជំហានទី ៤ — បង្កើត Signing Keypair (ធ្វើម្តងគត់)

នៅក្នុង ZoeKeyGen ផ្នែក **"Signing Key"** ចុច "បង្កើត Keypair ថ្មី" (Generate New Keypair) — Popup នឹងបង្ហាញ Private Key និង Public Key។

- **ចម្លង Private Key ទៅរក្សាទុកកន្លែងសុវត្ថិភាព** (Password Manager) — នេះជា "Master Secret" របស់ប្រព័ន្ធ License ទាំងមូល។
- **ចម្លង Public Key** ទៅដាក់ក្នុង Array `PUBLIC_KEYS_JWK` ក្នុងឯកសារ `license-verify.js` របស់ **ទាំង ៤ App** (ZoeAdmin, ZoeW, Zoescan, ZoeKeyGen) រួច Deploy ឡើងវិញ។

ចាប់ពីពេលនេះ រាល់ពេលចង់បង្កើត Key អ្នកគ្រាន់តែបិទភ្ជាប់ Private Key ដែលបានរក្សាទុកចូល "Signing Key" រួចចុច Load Key។

### បង្កើត Key សម្រាប់បុគ្គលិក/ឧបករណ៍ (ប្រើប្រាស់ប្រចាំថ្ងៃ)

1. ជ្រើសរើសកម្មវិធីគោលដៅ (ZoeAdmin / ZoeW / Zoescan / ទាំង ៣)
2. កំណត់ចំនួនថ្ងៃសុពលភាព (លំនាំដើម ៣០ថ្ងៃ អាចផ្លាស់ប្តូរបាន)
3. ដាក់ចំណាំ (ជម្រើស — ឧ. ឈ្មោះបុគ្គលិក/ទីតាំង)
4. ចុច "Generate Key" → Key នឹងបង្ហាញនៅផ្នែកខាងក្រោម → ចម្លងផ្ញើឲ្យអ្នកប្រើប្រាស់ (Key មិនអាចមើលឡើងវិញបានទេបន្ទាប់ពី Refresh ទំព័រ — ប៉ុន្តែអាច Revoke ឬបង្កើត Key ថ្មីជំនួសបានគ្រប់ពេល)។
5. អ្នកប្រើប្រាស់នាំយក Key នេះទៅដាក់ក្នុងអេក្រង់ "Activation Required" របស់ App គោលដៅ ពេលចូលប្រើដំបូង។

### គ្រប់គ្រង Key ដែលមានស្រាប់

តារាង "បញ្ជី Key ទាំងអស់" បង្ហាញ Key គ្រប់កម្មវិធី ជាមួយស្ថានភាព (Active/ផុតកំណត់/Revoked)៖

- **⛔ Revoke** — ដកហូតសិទ្ធិភ្លាមៗ (App គោលដៅផ្ទៀងផ្ទាត់ម្តងទៀតរៀងរាល់ ១៥នាទីពេលកំពុងបើកប្រើ ព្រមទាំងរាល់ពេល Login/Refresh ថ្មី — ដូច្នេះ App នឹងចាក់សោវិញក្នុងរយៈពេលមិនលើសពី ១៥នាទី ពេលមានអ៊ីនធឺណិត សូម្បីតែឧបករណ៍កំពុងបើកសន្ធឹកក៏ដោយ)
- **⏳ បន្ថែម** — ពន្យារពេលសុពលភាព ដោយមិនចាំបាច់ចេញ Key ថ្មី

ប្រសិនបើ Key ប្រភេទ "ទាំង ៣" (ALL) ត្រូវបានបង្កើតដោយជោគជ័យតែមួយផ្នែក (ឧ. Internet ដាច់ពាក់កណ្តាល
ដំណើរការ ធ្វើឲ្យ Active បានតែលើ App ខ្លះ) បញ្ជី Key នឹងបង្ហាញសញ្ញា **⚠️ នៅជាប់ Badge "ទាំង ៣"**
ជាអចិន្ត្រៃយ៍ (មិនត្រឹមតែពេលបង្កើតរួចថ្មីៗប៉ុណ្ណោះទេ) — សូម Hover លើ Badge នេះ ដើម្បីមើលថា Key
នោះ Active ជាក់ស្តែងលើ App ណាខ្លះ។ ប្រសិនបើឃើញសញ្ញានេះ គួរបង្កើត Key ថ្មីដាច់ដោយឡែកសម្រាប់ App
ដែលនៅខ្វះ ជាជាងទុកទីតែម្តងទៀត។

## សុវត្ថិភាព

- **Key មិនអាចក្លែងបន្លំបាន** បើគ្មាន Private Key — នេះជាគណិតវិទ្យា Cryptography ពិត មិនមែនគ្រាន់តែជា Obfuscation ទេ។
- **Key មិនអាចពន្យារពេលដោយកែ localStorage** ព្រោះថ្ងៃផុតកំណត់ស្ថិតនៅក្នុងហត្ថលេខាផ្ទាល់។
- **License Database ដាច់ដោយឡែកពី Business Database** — សូម្បីតែ Project របស់ ZoeAdmin មានបញ្ហា Rules/Leak Config ក៏ដោយ Private Signing Key និងគណនី Admin របស់ License មិនរងផលប៉ះពាល់ដែរ។
- **`license_keys` (សាធារណៈ) vs `license_keys_meta` (Admin-only)**: `license_keys/{app}/{id}` អនុញ្ញាតឲ្យអានជាសាធារណៈដោយចេតនា ព្រោះ App ទាំង ៣ (ZoeAdmin/ZoeW/Zoescan) ត្រូវការត្រួតពិនិត្យ Key នេះមុនពេលមាន Auth — ប៉ុន្តែឥឡូវនេះមានតែ `expiresAt`/`revoked` ប៉ុណ្ណោះនៅទីនោះ។ `note`/`createdBy` (អ៊ីមែល Admin)/`issuedAt`/`scope`/`appPaths` ត្រូវផ្លាស់ទីទៅ `license_keys_meta` ដែលអាន/សរសេរបានតែ Admin ប៉ុណ្ណោះ។ **បើ Publish Rules ថ្មីនេះលើ Project ដែលធ្លាប់មាន Key រួចហើយ សូមចុចប៊ូតុង "🔒 Migrate PII ចាស់" ក្នុងផ្នែក "បញ្ជី Key ទាំងអស់" ម្តងគត់** ដើម្បីផ្លាស់ទីទិន្នន័យចាស់ចេញពី Path សាធារណៈ — Key ដែលបង្កើតថ្មីៗនឹងបំបែកដោយស្វ័យប្រវត្តិស្រាប់។
- Logout លុបបញ្ជី Key និង Private Key ដែលទើបបង្កើត (បើមាន) ចេញពីអេក្រង់ភ្លាមៗ (មិនទុកសល់ឲ្យអ្នកប្រើបន្ទាប់ឃើញ ក្នុងករណីប្រើ Device រួម)

## អាជ្ញាប័ណ្ណ (License)

គម្រោងនេះជាកម្មសិទ្ធិឯកជន (Private/Proprietary) — Powered By ZoeW
