# Supabase — Project តែមួយសម្រាប់អតិថិជនទាំងអស់

គ្រឹះនៃប្រព័ន្ធថ្មី ៖ **Supabase Project តែមួយ** ជំនួស «Firebase Project មួយក្នុងមួយអតិថិជន»។ ហាងនីមួយៗជា **tenant** មួយ ដែលបែងចែកដោយ
Row Level Security (RLS) ។ ការចុះឈ្មោះប្រើ **លេខទូរស័ព្ទ + កូដ SMS (Firebase Phone Auth សម្រាប់ OTP តែប៉ុណ្ណោះ)** ហើយការ Login ប្រចាំថ្ងៃប្រើ
**Username + Password**។ **កូដអញ្ជើញ** ដែលអ្នកលក់ចេញ ចងលេខសាខា ZTO ទៅនឹងគណនីពេលចុះឈ្មោះជោគជ័យ។

> 📖 ឯកសារនេះសរសេរតែ **កំណែ · មុខងារ · របៀបប្រើប្រាស់ · ប្រព័ន្ធសុវត្ថិភាព · អាជ្ញាប័ណ្ណ**។ ប្រវត្តិ និងលេខដែលវាស់បាន ស្ថិតក្នុង
> **[docs/HISTORY.md](../docs/HISTORY.md)**។

## កំណែ

- ⛔ ថតនេះ **មិន deploy តាម Netlify** ហើយ **មិនប៉ះ `APP_VERSION` ឬ `CACHE_VERSION`** របស់ ZoeW/ZoeKeyGen ទេ ៖ migration និង Edge Function
  deploy ទៅ Supabase ដោយ CLI។
- កំណែ dependency **pin ក្នុង [`package.json`](package.json)** (`@supabase/supabase-js` ដដែលនឹង specifier `npm:` ក្នុង Edge Function) ·
  Postgres major ក្នុង [`config.toml`](config.toml) (`[db] major_version`) — អ្នកយាមធ្លាក់បើវាឃ្លាតគ្នា។
- ZoeW និង ZoeKeyGen **មិនទាន់ប្រើ** ថតនេះទេ ៖ ប្រព័ន្ធដែលអតិថិជនប្រើនៅតែ Firebase។

## មុខងារ

### តារាង (schema `public`)

| តារាង | ខ្លឹមសារ | អ្នកអានបាន |
|---|---|---|
| `tenants` | ហាង ៖ ឈ្មោះ · `branch_code` (លេខសាខា ZTO · មិនស្ទួន) · `expires_at` · `revoked` | សមាជិកនៃហាងនោះ (ពេលសកម្ម) · admin |
| `tenant_members` | គណនី ➜ ហាង ៖ `username` · `phone` · `role` (`owner`/`member`) | ម្ចាស់គណនីខ្លួនឯង · admin |
| `tenant_invites` | កូដអញ្ជើញ (**hash តែប៉ុណ្ណោះ**) · ចំនួនប្រើ · ថ្ងៃផុត | admin |
| `platform_admins` | អ្នកលក់ (ZoeKeyGen) | ម្នាក់ៗឃើញតែខ្លួនឯង |

⛔ គ្មាន role ណាសរសេរតារាងដោយផ្ទាល់ទេ ៖ រាល់ការសរសេរឆ្លងកាត់ RPC ខាងក្រោម។

### RPC

| RPC | អ្នកហៅ | ធ្វើអ្វី |
|---|---|---|
| `my_account()` | authenticated | គណនីខ្លួនឯង ៖ username · role · ហាង · `branch_code` · `status` (`active`/`expired`/`revoked`) |
| `admin_create_tenant(name, branch_code, expires_at)` | admin | បង្កើតហាង |
| `admin_update_tenant(id, name?, branch_code?, expires_at?, revoked?)` | admin | ប្តូរឈ្មោះ · សាខា · ពន្យារ · Revoke/បើកវិញ (មានប្រសិទ្ធភាពភ្លាម) |
| `admin_issue_invite(tenant_id, role, max_uses, valid_hours)` | admin | ចេញកូដ `XXXX-XXXX-XXXX-XXXX-XXXX` (**បង្ហាញតែម្តង**) |
| `admin_revoke_invite(code_hash)` | admin | បិទកូដ |
| `invite_is_usable(code_hash)` · `finish_registration(…)` · `member_for_reset(…)` · `revoke_user_sessions(user_id)` | service_role (Edge Function តែប៉ុណ្ណោះ) | ចុះឈ្មោះ · កំណត់ពាក្យសម្ងាត់ថ្មី |

### Edge Function

| Function | Body (JSON) | លទ្ធផលជោគជ័យ |
|---|---|---|
| `register` | `idToken` (Firebase OTP) · `username` · `password` · `invite` | `200 {ok:true, code:"registered", tenantId, role}` |
| `reset-password` | `idToken` (Firebase OTP) · `username` · `password` | `200 {ok:true, code:"password-reset"}` |

`code` ពេលបរាជ័យ (App បកប្រែជាអក្សរខ្មែរ) ៖ `bad-request` · `invite-invalid` · `username-invalid` · `password-short` · `password-long` (លើស ៧២ byte) ·
`password-weak` · `otp-invalid` · `otp-stale` (OTP ចាស់ជាង ៥ នាទី ➜ ផ្ញើម្តងទៀត) · `otp-unverifiable` · `phone-region` · `username-taken` · `phone-taken` ·
`account-mismatch` · `account-invalid` · `origin-denied` · `body-too-large` · `server-unconfigured` · `db-unavailable` · `auth-unavailable` ·
`registration-unknown` (សូមសាក Login មុនចុះឈ្មោះម្តងទៀត) · `registration-incomplete` · `password-reset-sessions-kept` (ពាក្យសម្ងាត់ប្តូររួច តែឧបករណ៍ផ្សេង
មិនទាន់ត្រូវចាកចេញ ➜ ធ្វើម្តងទៀត) · `internal`។

### លំហូរ

1. **អ្នកលក់** ៖ `admin_create_tenant` ➜ `admin_issue_invite` ➜ ផ្ញើកូដ (ឬ QR) ឲ្យអតិថិជន។
2. **អតិថិជនចុះឈ្មោះ** ៖ វាយលេខទូរស័ព្ទ ➜ Firebase ផ្ញើ SMS ➜ វាយកូដ ➜ App ទទួល `idToken` ➜ ហៅ `register` ជាមួយ username · password · កូដអញ្ជើញ ➜
   គណនីចងនឹងហាង (និង `branch_code`) ដោយ server។
3. **Login ប្រចាំថ្ងៃ** ៖ `supabase.auth.signInWithPassword({ email: username + '@' + ZOE_LOGIN_DOMAIN, password })` ➜ `my_account()`។
4. **ភ្លេចពាក្យសម្ងាត់** ៖ OTP ទៅលេខដែលចុះឈ្មោះ ➜ `reset-password` ➜ session ចាស់ទាំងអស់ត្រូវផ្តាច់។

## របៀបប្រើប្រាស់

### ជំហានទី ១ — Supabase Project

1. បង្កើត Project (តំបន់ **Singapore** ជិតកម្ពុជា)។ ⛔ សម្រាប់លុយពិត ប្រើគម្រោង **Pro** ៖ Free ផ្អាក Project ក្រោយគ្មានសកម្មភាព ១ សប្តាហ៍ ហើយ **គ្មាន backup**។
2. **Authentication ➜ Sign In / Providers** ៖ Email = បើក · **Allow new users to sign up = បិទ** · **Confirm email = បើក** · Anonymous sign-ins = បិទ ·
   Phone = បិទ (SMS មកពី Firebase)។
3. **Authentication ➜ Email** ៖ **Secure email change = បើក** · **Secure password change = បើក** ⛔ កុំកំណត់ SMTP ផ្ទាល់ខ្លួន (គណនីប្រើ domain `.invalid`)។
4. **Project Settings ➜ API Keys** ៖ App ប្រើតែ **publishable key** (`sb_publishable_…`) ⛔ **secret key** (`sb_secret_…`) ដាក់តែក្នុង secret របស់ Edge Function។

### ជំហានទី ២ — Database

```bash
npx supabase@latest login
npx supabase@latest link --project-ref <project-ref>
npx supabase@latest db push
```

ឬ SQL Editor ➜ paste [`migrations/`](migrations) តាមលំដាប់ឈ្មោះ ➜ Run។

**admin ដំបូង** ៖ Authentication ➜ Users ➜ **Add user** (អ៊ីមែលដូច `boss@admin.zoew.invalid` · ពាក្យសម្ងាត់ខ្លាំង · Auto Confirm) រួច SQL Editor ៖

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'boss@admin.zoew.invalid';
```

**ហាង + កូដអញ្ជើញដោយដៃ** (មុន ZoeKeyGen មានផ្ទាំងនេះ) ៖

```sql
with c as (select private.new_invite_code() as code),
t as (
    insert into public.tenants (name, branch_code, expires_at)
    values ('ហាង សាកល្បង', '881859', now() + interval '365 days')
    returning id
),
i as (
    insert into public.tenant_invites (code_hash, tenant_id, role, max_uses, expires_at)
    select private.invite_code_hash(c.code), t.id, 'owner', 1, now() + interval '72 hours' from c, t
    returning code_hash
)
select c.code from c, i;
```

### ជំហានទី ៣ — Firebase សម្រាប់ OTP តែប៉ុណ្ណោះ

1. បង្កើត Firebase Project **ដាច់ដោយឡែក** ➜ Authentication ➜ Sign-in method ➜ **Phone** = បើក។
2. ⛔ Firebase ទាមទារគម្រោង **Blaze** (ភ្ជាប់ Billing) ដើម្បីផ្ញើ SMS ហើយគិតថ្លៃតាម SMS ➜ OTP ផ្ញើតែពេលចុះឈ្មោះ និងភ្លេចពាក្យសម្ងាត់ ➜ ចំនួន SMS ≈ ចំនួនគណនី។
3. Authentication ➜ Settings ➜ **SMS region policy = អនុញ្ញាតតែ Cambodia** · Google Cloud ➜ Billing ➜ **Budget alert** · Authorized domains ៖ domain របស់
   ZoeW និង `localhost` (APK)។ App Check ជាស្រេចចិត្ត (កាត់បន្ថយ SMS pumping)។
4. កត់ **Project ID** (ឧ. `zoe-otp`)។

### ជំហានទី ៤ — Edge Function

⛔ វាយ secret ក្នុង terminal របស់អ្នកផ្ទាល់ — កុំ paste ក្នុង chat ឬ commit ចូល repo។

```bash
npx supabase@latest secrets set \
  ZOE_SECRET_KEY=<sb_secret_…> \
  ZOE_OTP_FIREBASE_PROJECT_ID=<firebase-project-id> \
  ZOE_LOGIN_DOMAIN=users.zoew.invalid \
  ZOE_ALLOWED_ORIGINS=https://<site-zoew>.netlify.app,https://localhost \
  ZOE_PHONE_PREFIXES=+855
npx supabase@latest functions deploy register --no-verify-jwt
npx supabase@latest functions deploy reset-password --no-verify-jwt
```

| Secret | ចាំបាច់ | ច្បាប់ |
|---|---|---|
| `ZOE_SECRET_KEY` | ✅ (បើអត់ ប្រើ `SUPABASE_SERVICE_ROLE_KEY` ដែល Supabase ដាក់ស្រាប់) | ≥ ២០ តួ |
| `ZOE_OTP_FIREBASE_PROJECT_ID` | ✅ | Project ID របស់ Firebase OTP |
| `ZOE_LOGIN_DOMAIN` | ✅ | ⛔ **ត្រូវបញ្ចប់ដោយ `.invalid`** ហើយ App ត្រូវប្រើតម្លៃដដែល |
| `ZOE_ALLOWED_ORIGINS` | ✅ | origin ពេញ (`https://…` គ្មាន path) បំបែកដោយ `,` |
| `ZOE_PHONE_PREFIXES` | លំនាំដើម `+855` | បញ្ជីបុព្វបទលេខ |

Secret ខ្វះ/ខុស ➜ function ឆ្លើយ `503 server-unconfigured` (fail closed)។ `--no-verify-jwt` ចាំបាច់ ៖ key ប្រភេទថ្មី (`sb_publishable_…`) មិនមែន JWT ហើយ
អ្នកចុះឈ្មោះមិនទាន់មានគណនី ➜ function ផ្ទៀង OTP ដោយខ្លួនឯង។

### ជំហានទី ៥ — អ្នកយាម

```bash
npm ci --prefix supabase
SUPABASE_STRICT=1 bash audit-tools/run-all.sh
```

`supabase-rls` (Postgres ពិត) និង `supabase-functions` ត្រូវបៃតង **ពេញលេញ** (មិនមែន PARTIAL)។

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
- **RLS លើគ្រប់តារាង** · anon ៖ គ្មានសិទ្ធិអ្វីទាំងអស់ · authenticated ៖ អានតែខ្លួនឯង · service_role ៖ តែ RPC ចុះឈ្មោះ · RPC ជា `security definer` +
  `search_path = ''` · Revoke/ផុតកំណត់មានប្រសិទ្ធភាព **ភ្លាម** (មិនរង់ចាំ JWT ផុត)។
- **កូដអញ្ជើញ** ៖ ចៃដន្យ ១០០ bit · DB ផ្ទុកតែ SHA-256 · ប្រើបានតាម `max_uses` · មានថ្ងៃផុត · ចងនឹងហាងពេលចេញ ➜ អតិថិជនមិនអាចជ្រើសលេខសាខាខ្លួនឯង។
- **ការចុះឈ្មោះ** ៖ token OTP ផ្ទៀងដោយសោ RS256 របស់ Google (`aud`/`iss` = Firebase OTP Project · provider `phone` · OTP ≤ ៥ នាទី · លេខ E.164) ➜
  លេខទូរស័ព្ទយកពី **token** មិនមែនពី App · កូដអញ្ជើញត្រូវប្រើបាន **មុន** បង្កើតគណនី · RPC idempotent · លុបគណនីវិញតែលើការបដិសេធច្បាស់ ·
  លទ្ធផលមិនដឹង ➜ **មិនលុប** (ប្រហែលជាបានចុះឈ្មោះរួច)។
- **domain `.invalid`** (RFC 2606 ៖ ផ្ញើមិនដល់ជានិច្ច) ➜ ផ្លូវ «ភ្លេចពាក្យសម្ងាត់តាមអ៊ីមែល» របស់ Supabase យកគណនីមិនបាន · Confirm email + Secure
  email/password change ➜ ការប្តូរតាមអ៊ីមែលធ្វើមិនកើត ➜ ការកំណត់ពាក្យសម្ងាត់ថ្មីមានតែតាម OTP ហើយវាផ្តាច់ session ចាស់ទាំងអស់។
- **HTTP** ៖ CORS តែ origin ក្នុង `ZOE_ALLOWED_ORIGINS` · body ≤ 8 KB · កំហុសខាងក្នុងមិនលេចក្នុងចម្លើយ · function មិនសរសេរ log (token · លេខ · secret)។
- ⚠️ **ព្រំដែនដែលនៅសល់** ៖ access token ដែលចេញរួច នៅប្រើបានរហូតដល់ផុតអាយុ (JWT expiry) សូម្បីក្រោយកំណត់ពាក្យសម្ងាត់ថ្មី · SIM ត្រូវគេយក ➜ អាចកំណត់
  ពាក្យសម្ងាត់ថ្មីបាន (ធម្មជាតិនៃ SMS) · គណនី admin មានអំណាចលើគ្រប់ហាង ➜ ពាក្យសម្ងាត់ខ្លាំង និងកុំចែករំលែក។
- អ្នកយាម ៖ `audit-tools/supabase-rls-test.js` · `audit-tools/supabase-functions-test.js` (រួម mutation ដែលត្រូវធ្វើឲ្យវាក្រហម)។

## អាជ្ញាប័ណ្ណ

**កម្មសិទ្ធិឯកជន** — រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 **ហ៊ុន ម៉េង ស្រូយ (MENGSROY HEN)** — មើល [`LICENSE`](../LICENSE)។

`audit-tools/supabase-shim/` ផ្ទុកច្បាប់ចម្លង SQL ពី Supabase (អ្នកយាមតែប៉ុណ្ណោះ · មិន ship) ក្រោមអាជ្ញាប័ណ្ណរបស់វា ៖
[`LICENSES/PostgreSQL-supabase-postgres.txt`](../LICENSES/PostgreSQL-supabase-postgres.txt) ·
[`LICENSES/MIT-supabase-auth.txt`](../LICENSES/MIT-supabase-auth.txt)។
