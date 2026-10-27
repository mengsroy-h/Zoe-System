# TypeScript ៖ វិន័យ និងផ្លូវតឹងបន្តិចម្តងៗ

## ១. ស្ថានភាពបច្ចុប្បន្ន

`tsconfig.app.json` បើក `strict: true` ជាមួយ **ការលើកលែង ៣** ៖

| ជម្រើស | តម្លៃ | ហេតុអ្វី |
|---|---|---|
| `strictNullChecks` | `false` | កូដមួយចំនួនពឹងលើតម្លៃមានស្រាប់; compiler មិនបង្ខំការពិនិត្យ `null`។ ការបន្ថែម branch ថ្មីត្រូវវាស់ **ឥរិយាបថ** ផង |
| `noImplicitAny` | `false` | Parameter ដែលគ្មាន annotation អាចជា implicit `any`; ការដាក់ `any` ដោយដៃមិនធ្វើឱ្យ type តឹងឡើងទេ |
| `useUnknownInCatchVariables` | `false` | តម្លៃក្នុង `catch` មិនត្រូវបង្ខំជា `unknown`; អ្នកហៅត្រូវផ្ទៀងរូបរាងមុនប្រើ |

**អ្វីដែលនៅតែពិនិត្យ** — ហើយវាចាប់កំហុសពិត ៖

- ឈ្មោះដែលមិនមាន · import ខុស · export ដែលបាត់
- **ចំនួនអាគុយម៉ង់** និងការហៅតាម `bind`/`call`/`apply` (`strictBindCallApply`)
- Property ដែលមិនមានលើ type ដែលស្គាល់
- `strictFunctionTypes` · `noImplicitThis` · `alwaysStrict`

ការពិនិត្យទាំងនេះមិនជំនួសតេស្តឥរិយាបថ ឬការផ្ទៀងទិន្នន័យពីបណ្ដាញទេ។

---

## ២. ផ្លូវតឹងបន្តិចម្តងៗ

⛔ **កុំបើក `strictNullChecks` សកលក្នុងជំហានតែមួយ** — វានឹងបញ្ចេញកំហុស
រាប់រយ ហើយការ «ជួសជុល» ពួកវាទាំងអស់ក្នុងពេលតែមួយ គឺជាការកែឥរិយាបថ
ដោយគ្មានអ្នកវាស់។

វិធីដែលសុវត្ថិភាព ៖ ធ្វើ **តាម module** ។

TypeScript គ្មាន pragma `@ts-strict-check-null` សម្រាប់បើកការត្រួតពិនិត្យនេះតាមឯកសារទេ។
ប្រើ tsconfig ដាច់ដោយឡែកសម្រាប់ពិនិត្យវិសាលភាពដែលជ្រើស ហើយពិនិត្យ dependency របស់វាផង។

១. ជ្រើស module មួយ (ចាប់ផ្តើមពី `src/domain/*` — វាសុទ្ធសាធជាងគេ)
២. ការចូលប្រើ DOM មាន type រួចហើយ ៖ `elementOf<T>()` ក្នុង `src/app/refs.ts` ត្រឡប់ `T | null` ➜ កូដដែលប្រើវា
   ត្រូវពិនិត្យ `null` ពេលប្រើ (មើលផ្នែក ៣); `strictNullChecks: false` មិនធានាថាអ្នកហៅទាំងអស់បានពិនិត្យរួចទេ
៣. បន្ថែម interface ពិតជំនួស `any` — ⛔ **មិនទាន់មាន** interface សម្រាប់កញ្ចប់ ឬ barcode ទេ (វាលឃ្លាំងក្នុង
   `src/core/state.ts` ភាគច្រើនជា `any`) ➜ ចាប់ផ្តើមពីរូបរាងដែល Firebase rules ចាក់សោ (`firebase-database.rules.json`)
៤. រត់ typecheck · lint និងតេស្តតាមសេណារីយ៉ូដែលកែក្នុង session ហើយរង់ចាំ suite ពេញក្នុង CI តាម [Runbook](../../CLAUDE.md#-runbook); បៃតងមិនធានាថាឥរិយាបថទាំងអស់ដូចដើមទេ
៥. ពេល module ទាំងអស់រឹងរួច ➜ បើក `strictNullChecks` សកល រួចលុបផ្នែកនេះចោល

---

## ៣. ការចូលប្រើ DOM ៖ `src/app/refs.ts`

App ជា React ១០០% ➜ ⛔ **គ្មាន `byId()` ទៀតទេ** ៖ កូដមុខងារមិនប៉ះ DOM ដោយផ្ទាល់ (`npm run purity:check`) ហើយ
ការចូលប្រើដែលនៅសល់ឆ្លងកាត់ ref ដែលមានឈ្មោះក្នុង `REF_NAMES` (ចងដោយ `ref={refTo('…')}` ក្នុង JSX) ៖

| helper | ត្រឡប់ | ពេល ref មិនទាន់ចង |
|---|---|---|
| `elementOf<T>(name)` | `T \| null` | `null` ➜ អ្នកហៅត្រូវពិនិត្យ |
| `fieldValue(name)` | `string` | `''` (ឥរិយាបថដូច `value` របស់វាលទទេ) |
| `setFieldValue` · `setFieldChecked` · `focusField` | `void` | មិនធ្វើអ្វី |

⛔ ឈ្មោះ ref ត្រូវមាននៅក្នុង `REF_NAMES` (type `RefName`) ➜ ឈ្មោះខុសជាកំហុស `tsc` មិនមែន `null` ស្ងាត់ៗពេលរត់។

---

## ៤. ការបន្ថែម type លើកូដដែលមានស្រាប់

> **ការបន្ថែម type ត្រូវជាការពិពណ៌នាប៉ុណ្ណោះ** (cast · annotation · `?` · generic)។ បើការកែណាមួយប្តូរ
> *ឥរិយាបថ* វាមិនមែនជាការបន្ថែម type ទេ — វាជាការកែកូដ ហើយត្រូវមានអ្នកវាស់ដាច់ដោយឡែក។
