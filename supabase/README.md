# Supabase — Project តែមួយសម្រាប់ហាងទាំងអស់

**Supabase Project តែមួយ** ជំនួស «Firebase Project · Rules · គណនី Login ដោយដៃ មួយក្នុងមួយអតិថិជន»។ ហាងនីមួយៗជា **tenant** មួយ ដែលបែងចែក
ដោយ `tenant_id` + Row Level Security (RLS) ➜ ហាងមិនឃើញទិន្នន័យគ្នា។ អតិថិជន **ចុះឈ្មោះដោយខ្លួនឯង** ក្នុង ZoeW ដោយ **កូដអញ្ជើញ** ដែលអ្នកលក់ចេញពី
ZoeKeyGen (គ្មាន SMS · គ្មានការបង់ប្រាក់សម្រាប់ OTP) ហើយកូដនោះ **ចងលេខសាខា ZTO** របស់ហាងទៅនឹងគណនី។ Login ប្រចាំថ្ងៃប្រើ **ឈ្មោះគណនី + ពាក្យសម្ងាត់**។

> 📖 ឯកសារនេះសរសេរតែ **កំណែ · មុខងារ · របៀបប្រើប្រាស់ · ប្រព័ន្ធសុវត្ថិភាព · អាជ្ញាប័ណ្ណ**។ ប្រវត្តិ និងលេខដែលវាស់បាន ស្ថិតក្នុង
> **[docs/HISTORY.md](../docs/HISTORY.md)**។

## កំណែ

- ⛔ ថតនេះ **មិន deploy តាម Netlify** ៖ migration និង Edge Function deploy ទៅ Supabase ដោយ CLI (ឬ SQL Editor)។ ការកែតែក្នុងថតនេះ **មិនប៉ះ
  `APP_VERSION`/`CACHE_VERSION`** របស់ ZoeW/ZoeKeyGen ទេ។
- កំណែ dependency **pin ក្នុង [`package.json`](package.json)** (`@supabase/supabase-js` ដដែលនឹង specifier `npm:` ក្នុង Edge Function) · Postgres major
  ក្នុង [`config.toml`](config.toml) (`[db] major_version`) — អ្នកយាមធ្លាក់បើវាឃ្លាតគ្នា។
- ZoeW ជ្រើស backend **តាម Config នៃឧបករណ៍នីមួយៗ** ៖ Config មាន `supabaseUrl` ➜ Supabase · Config Firebase (`databaseURL`) ➜ Firebase ដដែល
  ➜ អតិថិជនចាស់លើ Firebase **មិនប្រែអ្វីសោះ**។

## មុខងារ

### តារាង (schema `public`)

| តារាង | ខ្លឹមសារ | អ្នកអានបាន |
|---|---|---|
| `tenants` | ហាង ៖ ឈ្មោះ · `branch_code` (លេខសាខា ZTO · មិនស្ទួន) · `expires_at` · `revoked` | សមាជិកនៃហាងនោះ · admin |
| `tenant_members` | គណនី ➜ ហាង ៖ `username` · `role` (`owner`/`member`) | ម្ចាស់គណនីខ្លួនឯង · admin |
| `tenant_invites` | កូដអញ្ជើញ (**hash តែប៉ុណ្ណោះ**) · ចំនួនប្រើ · ថ្ងៃផុត | admin |
| `member_reset_codes` | កូដប្តូរពាក្យសម្ងាត់ (**hash តែប៉ុណ្ណោះ**) · ប្រើ ១ ដង · ថ្ងៃផុត | admin |
| `platform_admins` | អ្នកលក់ (ZoeKeyGen) | ម្នាក់ៗឃើញតែខ្លួនឯង |
| `zoe_docs` · `zoe_tenant_state` | ទិន្នន័យកញ្ចប់របស់ហាង តាមរូបរាង RTDB (`root`/`key` ➜ JSON) · លេខលំដាប់ `seq` សម្រាប់ទាញតែអ្វីដែលប្រែ | សមាជិកនៃហាងនោះ |

⛔ គ្មាន role ណាសរសេរតារាងដោយផ្ទាល់ទេ ៖ រាល់ការសរសេរឆ្លងកាត់ RPC ខាងក្រោម។

### RPC

| RPC | អ្នកហៅ | ធ្វើអ្វី |
|---|---|---|
| `my_account()` | authenticated | គណនីខ្លួនឯង ៖ username · role · ហាង · `branch_code` · `status` (`active`/`expired`/`revoked`) |
| `zoe_write(op_id, ops)` · `zoe_read(root, key?)` · `zoe_pull(since, limit)` · `zoe_now()` | authenticated (សមាជិកហាងសកម្ម) | ឃ្លាំងទិន្នន័យដូច RTDB ៖ set · update · increment · transaction (CAS) ក្នុងការសរសេរតែមួយ · `op_id` ដដែលមិនអនុវត្ត ២ ដង · **rules របស់ `firebase-database.rules.json` អនុវត្តក្នុង Postgres** |
| `admin_create_tenant(name, branch_code, expires_at)` | admin | បង្កើតហាង |
| `admin_update_tenant(id, name?, branch_code?, expires_at?, revoked?)` | admin | ប្តូរឈ្មោះ · សាខា · ពន្យារ · បិទ/បើកវិញ (មានប្រសិទ្ធភាពភ្លាម) |
| `admin_issue_invite(tenant_id, role, max_uses, valid_hours)` | admin | ចេញកូដអញ្ជើញ `XXXX-XXXX-XXXX-XXXX-XXXX` (**បង្ហាញតែម្តង**) |
| `admin_revoke_invite(code_hash)` | admin | បិទកូដអញ្ជើញ |
| `admin_issue_reset_code(username, valid_hours)` | admin | ចេញកូដប្តូរពាក្យសម្ងាត់ (កូដចាស់របស់គណនីនោះលែងប្រើបាន) |
| `invite_is_usable` · `finish_registration` · `reset_code_user` · `consume_reset_code` · `revoke_user_sessions` · `zoe_admin_write` | service_role (Edge Function · ការផ្ទេរទិន្នន័យ) | ចុះឈ្មោះ · ប្តូរពាក្យសម្ងាត់ · សរសេរទិន្នន័យជំនួសហាង |

### Edge Function

| Function | Body (JSON) | លទ្ធផលជោគជ័យ |
|---|---|---|
| `register` | `invite` · `username` · `password` | `200 {ok:true, code:"registered", tenantId, role}` |
| `reset-password` | `username` · `resetCode` · `password` | `200 {ok:true, code:"password-reset"}` |

`code` ពេលបរាជ័យ (ZoeW បកប្រែជាអក្សរខ្មែរ) ៖ `bad-request` · `invite-invalid` · `username-invalid` · `password-short` · `password-long` (លើស ៧២ byte) ·
`password-weak` · `username-taken` · `reset-code-invalid` · `account-invalid` · `origin-denied` · `body-too-large` · `server-unconfigured` · `db-unavailable` ·
`auth-unavailable` · `registration-unknown` (សូមសាក Login មុនចុះឈ្មោះម្តងទៀត) · `registration-incomplete` · `password-reset-incomplete` (ពាក្យសម្ងាត់ប្តូររួច
តែឧបករណ៍ចាស់ខ្លះនៅចូលបានរហូតដល់វាចាកចេញ) · `internal`។

### លំហូរ

1. **អ្នកលក់** (ZoeKeyGen ➜ កាត «🏪 ហាង Supabase») ៖ ចូលជា Admin ➜ បង្កើតហាង (ឈ្មោះ · លេខសាខា · សុពលភាព) ➜ ZoeKeyGen ចេញ **កូដអញ្ជើញម្ចាស់ហាង**
   + **Setup Link/QR** (`{supabaseUrl, supabaseKey, invite}`) ➜ ផ្ញើឲ្យម្ចាស់ហាង។
2. **ម្ចាស់ហាងចុះឈ្មោះ** ៖ បើក Setup Link ➜ វាយ PIN ➜ រក្សាទុក Config ➜ ប្រអប់ចូល ➜ **📝 ចុះឈ្មោះដោយកូដអញ្ជើញ** (កូដបំពេញរួច) ➜ ជ្រើសឈ្មោះគណនី
   + ពាក្យសម្ងាត់ ➜ គណនីចងនឹងហាង និងសាខាដោយ server។
3. **បុគ្គលិក** ៖ អ្នកលក់ចុច «🎟️ កូដអញ្ជើញ» លើហាងដែលមានម្ចាស់រួច ➜ កូដ «បុគ្គលិក» (role `member`)។
4. **Login ប្រចាំថ្ងៃ** ៖ ឈ្មោះគណនី + ពាក្យសម្ងាត់ (ZoeW បម្លែងជា `username@<loginDomain>` ខាងក្នុង)។
5. **ភ្លេចពាក្យសម្ងាត់** ៖ អ្នកលក់ចេញ **កូដប្តូរពាក្យសម្ងាត់** (ZoeKeyGen) ➜ អតិថិជនចុច **🔑 ភ្លេចពាក្យសម្ងាត់?** ក្នុងប្រអប់ចូលរបស់ ZoeW ➜ វាយកូដ + ពាក្យសម្ងាត់ថ្មី ➜
   session ចាស់ទាំងអស់ត្រូវផ្តាច់។
6. **ផុតកំណត់ / បិទហាង** ៖ គណនីទាំងអស់របស់ហាងនោះចាកចេញ ហើយចូលមិនបាន រហូតដល់អ្នកលក់ពន្យារ ឬបើកវិញ។

## របៀបប្រើប្រាស់

### ជំហានទី ១ — Supabase Project

1. បង្កើត Project (តំបន់ **Singapore** ជិតកម្ពុជា)។ ⚠️ គម្រោង **Free** ៖ 500 MB · 5 GB egress/ខែ · **ផ្អាក Project ក្រោយគ្មានសកម្មភាព ១ សប្តាហ៍** ·
   **គ្មាន backup ស្វ័យប្រវត្តិ** ➜ ពេលអតិថិជនច្រើន Upgrade ទៅ **Pro លើ Project ដដែល** (គ្មាន migration)។
2. **Authentication ➜ Sign In / Providers** ៖ Email = បើក · **Allow new users to sign up = បិទ** · **Confirm email = បើក** · Anonymous sign-ins = បិទ ·
   Phone = បិទ។
3. **Authentication ➜ Email** ៖ **Secure email change = បើក** · **Secure password change = បើក** ⛔ កុំកំណត់ SMTP ផ្ទាល់ខ្លួន (គណនីប្រើ domain `.invalid`)។
4. **Project Settings ➜ API Keys** ៖ App ប្រើតែ **publishable key** (`sb_publishable_…`) ⛔ **secret key** (`sb_secret_…`) ដាក់តែក្នុង secret របស់ Edge Function។

### ជំហានទី ២ — Database

```bash
npx supabase@latest login
npx supabase@latest link --project-ref <project-ref>
npx supabase@latest db push
```

ឬ SQL Editor ➜ paste [`migrations/`](migrations) **តាមលំដាប់ឈ្មោះ** ➜ Run ម្តងមួយឯកសារ។

⛔ `migrations/20261001000100_zoe_rules.sql` **ដេរីវេពី `firebase-database.rules.json`** ៖ កែ rules ➜ `node supabase/scripts/generate-rules-sql.mjs` ➜ commit ឯកសារ
ទាំង ២ ➜ paste ឯកសារនោះម្តងទៀតក្នុង SQL Editor (វាជា `create or replace` ➜ Run ម្តងទៀតបាន)។ អ្នកយាមធ្លាក់បើវាចាស់។

**admin ដំបូង** ៖ Authentication ➜ Users ➜ **Add user** (អ៊ីមែលដូច `boss@admin.zoew.invalid` · ពាក្យសម្ងាត់ខ្លាំង · Auto Confirm) រួច SQL Editor ៖

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'boss@admin.zoew.invalid';
```

### ជំហានទី ៣ — Edge Function

⛔ វាយ secret ក្នុង terminal របស់អ្នកផ្ទាល់ — កុំ paste ក្នុង chat ឬ commit ចូល repo។

```bash
npx supabase@latest secrets set \
  ZOE_SECRET_KEY=<sb_secret_…> \
  ZOE_LOGIN_DOMAIN=users.zoew.invalid \
  ZOE_ALLOWED_ORIGINS=https://<site-zoew>.netlify.app,https://localhost
npx supabase@latest functions deploy register --no-verify-jwt
npx supabase@latest functions deploy reset-password --no-verify-jwt
```

| Secret | ចាំបាច់ | ច្បាប់ |
|---|---|---|
| `ZOE_SECRET_KEY` | ✅ (បើអត់ ប្រើ `SUPABASE_SERVICE_ROLE_KEY` ដែល Supabase ដាក់ស្រាប់) | ≥ ២០ តួ |
| `ZOE_LOGIN_DOMAIN` | ✅ | ⛔ **ត្រូវបញ្ចប់ដោយ `.invalid`** ហើយស្មើ `loginDomain` ក្នុង Config ZoeW (លំនាំដើម `users.zoew.invalid`) |
| `ZOE_ALLOWED_ORIGINS` | ✅ | origin ពេញ (`https://…` គ្មាន path) បំបែកដោយ `,` · `https://localhost` សម្រាប់ App Android |

Secret ខ្វះ/ខុស ➜ function ឆ្លើយ `503 server-unconfigured` (fail closed)។ `--no-verify-jwt` ចាំបាច់ ៖ key ប្រភេទថ្មី (`sb_publishable_…`) មិនមែន JWT ហើយ
អ្នកចុះឈ្មោះមិនទាន់មានគណនី ➜ function ផ្ទៀងកូដអញ្ជើញដោយខ្លួនឯង។

### ជំហានទី ៤ — Netlify (site ZoeW)

Environment variables ៖ `SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY` ➜ «ទាញបញ្ជីកញ្ចប់ពី ZTO» ស្គាល់សាខារបស់ហាងពី token Supabase (`my_account()`)។
⛔ កុំដាក់ Secret key ក្នុង Netlify។ ការស្កេនធម្មតាមិនត្រូវការ env ទាំងនេះទេ។

### ជំហានទី ៥ — ហាងដំបូង (ZoeKeyGen)

1. ZoeKeyGen ➜ កាត «🔗 បង្កើត Setup Link» ➜ បំពេញ **Base URL របស់ ZoeW** (Link កូដអញ្ជើញប្រើវា)។
2. កាត «🏪 ហាង Supabase» ➜ Supabase URL · Publishable key · អ៊ីមែល/ពាក្យសម្ងាត់ Admin ➜ **🔐 ចូល Supabase ជា Admin**។
3. ឈ្មោះហាង · លេខសាខា ZTO · សុពលភាព (ថ្ងៃ) ➜ **➕ បង្កើតហាង + កូដអញ្ជើញម្ចាស់ហាង** ➜ ចម្លង Setup Link (ឬ QR) ផ្ញើឲ្យម្ចាស់ហាង។
   ⛔ កូដ និង Link **បង្ហាញតែម្តង** (DB ផ្ទុកតែ hash) · ប្រើបាន ១ ដង · ផុតក្នុង ៧ ថ្ងៃ ➜ បាត់ ➜ ចុច «🎟️ កូដអញ្ជើញ» ចេញថ្មី។
4. បញ្ជីហាង ៖ **⏳ ពន្យារ** (បូកលើថ្ងៃផុតចាស់ ឬលើថ្ងៃនេះបើផុតរួច) · **⛔ បិទ / ✅ បើកវិញ** · **🔑 ចេញកូដប្តូរពាក្យសម្ងាត់** តាមឈ្មោះគណនី។

### ជំហានទី ៦ — អ្នកយាម

```bash
npm ci --prefix ZoeW && npm ci --prefix supabase
SUPABASE_STRICT=1 bash audit-tools/run-all.sh
```

`supabase-rls` · `supabase-datastore` · `supabase-functions` · `keygen-supabase-admin` (Postgres ពិត) និង `emu/supabase-rules-parity` ·
`emu/supabase-adapter-parity` (RTDB emulator ពិតជា oracle) ត្រូវបៃតង **ពេញលេញ** (មិនមែន PARTIAL)។

### គណនីកំព្រា

ករណីកម្រ (បណ្តាញដាច់ចំពេលចុះឈ្មោះ) អាចបន្សល់គណនី auth គ្មានហាង — វា **មើលអ្វីមិនឃើញ** (RLS) តែ username នោះជាប់។ រាយវា ៖

```sql
select u.id, u.email, u.created_at
from auth.users u
left join public.tenant_members m on m.user_id = u.id
left join public.platform_admins a on a.user_id = u.id
where m.user_id is null and a.user_id is null;
```

ពិនិត្យដោយភ្នែក រួចលុបតាម Authentication ➜ Users។

## ប្រព័ន្ធសុវត្ថិភាព

- **អត្តសញ្ញាណ = `auth.uid()` + `tenant_members`** ដែលមានតែ server សរសេរ ⛔ មិនដែលអាន `user_metadata` (អ្នកប្រើកែបានដោយ `auth.updateUser`) ឬ claim
  ក្នុង JWT ➜ claim ក្លែង (tenant/branch របស់ហាងផ្សេង) គ្មានឥទ្ធិពល។
- **RLS លើគ្រប់តារាង** · anon ៖ គ្មានសិទ្ធិអ្វីទាំងអស់ · authenticated ៖ អានតែហាងខ្លួនឯង · RPC ជា `security definer` + `search_path = ''` ·
  ហាងផុតកំណត់/បិទ មានប្រសិទ្ធភាព **ភ្លាម** (មិនរង់ចាំ JWT ផុត)។
- **ទិន្នន័យកញ្ចប់** ៖ rules ដដែលនឹង Firebase (ប្រភពតែមួយ `firebase-database.rules.json`) អនុវត្តក្នុង Postgres លើរាល់ `zoe_write` ➜ schema · fence ស្តារ/
  លុបទាំងអស់ · លុយមិនអវិជ្ជមាន ដូច Firebase បេះបិទ (វាស់ធៀប RTDB emulator)។
- **កូដអញ្ជើញ/កូដប្តូរពាក្យសម្ងាត់** ៖ ចៃដន្យ ១០០ bit · DB ផ្ទុកតែ SHA-256 · ប្រើបានតាម `max_uses` · មានថ្ងៃផុត · ចងនឹងហាងពេលចេញ ➜ អតិថិជនមិនអាច
  ជ្រើសលេខសាខាខ្លួនឯង។
- **ការចុះឈ្មោះ** ៖ កូដអញ្ជើញត្រូវប្រើបាន **មុន** បង្កើតគណនី · RPC idempotent · លុបគណនីវិញតែលើការបដិសេធច្បាស់ · លទ្ធផលមិនដឹង ➜ **មិនលុប**
  (ប្រហែលជាបានចុះឈ្មោះរួច)។
- **domain `.invalid`** (RFC 2606 ៖ ផ្ញើមិនដល់ជានិច្ច) ➜ ផ្លូវ «ភ្លេចពាក្យសម្ងាត់តាមអ៊ីមែល» របស់ Supabase យកគណនីមិនបាន · Confirm email + Secure
  email/password change ➜ ការកំណត់ពាក្យសម្ងាត់ថ្មីមានតែតាមកូដពីអ្នកលក់ ហើយវាផ្តាច់ session ចាស់ទាំងអស់។
- **ZoeKeyGen** ៖ ចូលដោយគណនី Admin (`platform_admins`) · បដិសេធ Secret key/`service_role` មុនផ្ញើអ្វីសោះ · Setup Link ផ្ទុកតែ URL · Publishable key ·
  កូដអញ្ជើញ (⛔ គ្មាន token ឬពាក្យសម្ងាត់ Admin) · ចាកចេញ ➜ កូដ · Link · ឈ្មោះហាង លុបចេញពីអេក្រង់។
- **HTTP** ៖ CORS តែ origin ក្នុង `ZOE_ALLOWED_ORIGINS` · body ≤ 8 KB · កំហុសខាងក្នុងមិនលេចក្នុងចម្លើយ · function មិនសរសេរ log (ពាក្យសម្ងាត់ · កូដ · secret)។
- ⚠️ **ព្រំដែនដែលនៅសល់** ៖ access token ដែលចេញរួច នៅប្រើបានរហូតដល់ផុតអាយុ (JWT expiry) សូម្បីក្រោយកំណត់ពាក្យសម្ងាត់ថ្មី · គណនី admin មានអំណាចលើ
  គ្រប់ហាង ➜ ពាក្យសម្ងាត់ខ្លាំង និងកុំចែករំលែក · Free tier គ្មាន backup ➜ ការសម្រេចរបស់ម្ចាស់គម្រោង។
- អ្នកយាម ៖ `audit-tools/supabase-rls-test.js` · `supabase-datastore-test.js` · `supabase-functions-test.js` · `keygen-supabase-admin-test.js` ·
  `emu/supabase-rules-parity-test.js` · `emu/supabase-adapter-parity-test.js` (រួម mutation ដែលត្រូវធ្វើឲ្យវាក្រហម)។

## អាជ្ញាប័ណ្ណ

**កម្មសិទ្ធិឯកជន** — រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 **ហ៊ុន ម៉េង ស្រូយ (MENGSROY HEN)** — មើល [`LICENSE`](../LICENSE)។

`audit-tools/supabase-shim/` ផ្ទុកច្បាប់ចម្លង SQL ពី Supabase (អ្នកយាមតែប៉ុណ្ណោះ · មិន ship) ក្រោមអាជ្ញាប័ណ្ណរបស់វា ៖
[`LICENSES/PostgreSQL-supabase-postgres.txt`](../LICENSES/PostgreSQL-supabase-postgres.txt) ·
[`LICENSES/MIT-supabase-auth.txt`](../LICENSES/MIT-supabase-auth.txt)។
