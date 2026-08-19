# audit-tools

ឧបករណ៍ static-check + test សម្រាប់ការធ្វើ audit លើ Zoe-System។ រត់ពី **root** នៃ repo។
មិនមែនជាផ្នែកនៃ App ណាមួយទេ — មិន deploy ទេ។

| File | អ្វី |
|---|---|
| `extract.js <outdir>` | ដក function ទាំងអស់ពី ZoeAdmin/ZoeW `app.js` រួច diff គូឈ្មោះដូចគ្នា — **រត់នេះមុនគេ** រាល់ជុំ audit |
| `policy-test.js` | ដក block ពិតរបស់ `claimAndCleanupItem` + `executeRestoreItem` ចេញពី `app.js` ទាំងពីរ រួចផ្ទៀងផ្ទាត់គោលការណ៍ **លុប/ដក** (27 assertion/App) |
| `idcheck.js` | `getElementById(...)` ទាំងអស់ត្រូវមាន `id=` ក្នុង HTML |
| `fncheck.js` | function ក្នុង inline `on*=` ទាំងអស់ត្រូវមានក្នុង `app.js` |
| `comments.js` | រាប់ comment (ត្រូវតែ 0) + trailing whitespace — ត្រូវការ `acorn` |
| `trimws.js <files>` | លុប trailing whitespace ដោយបញ្ជាក់ថា token stream មិនប្រែ |
| `emu/real.sh` | តេស្ត `firebase-database.rules.json` ពិត លើ RTDB emulator |

## Firebase RTDB emulator

```
npm i firebase-tools                 # ដើម្បីទាញយក jar
java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
cp firebase-database.rules.json audit-tools/emu/real.rules.json
bash audit-tools/emu/real.sh
```

**អន្ទាក់ ៣ ដែលខាតពេលច្រើន៖**
1. `firebase emulators:start` **upload rules មិនចេញ** កាត់ proxy — រត់ jar ផ្ទាល់។
2. `.settings/rules.json` និង `auth_variable_override` **ទាំងពីរត្រូវការ** `-H "Authorization: Bearer owner"` —
   បើគ្មាន rules មិន load ទេ ហើយ **តេស្តទាំងអស់ជោគជ័យក្លែងក្លាយ**។
3. កុំប្រើ `pkill -f firebase-database-emulator` — វាផ្គូផ្គងនឹង shell របស់ខ្លួនឯង។

**តែងតែពិនិត្យថា write ដែលគួរ DENIED ពិតជា DENIED** មុននឹងជឿលទ្ធផល។
