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

`npm --prefix ZoeW run typecheck` ពិនិត្យ project ដាច់ដោយឡែក
`tools/audit-tools/zoew/tsconfig.domain-strict.json` ផងដែរ។ វាបើក `strictNullChecks`,
`noImplicitAny` និង `useUnknownInCatchVariables` សម្រាប់ `src/domain/parcel.ts`,
`parcel-number.ts` និង `barcode-key.ts` ព្រមទាំងកិច្ចសន្យា type របស់វា។ វិសាលភាពនេះមិនបើក
ការពិនិត្យ `null` សកលសម្រាប់ App ឬការចូលប្រើ DOM ទេ។

`ParcelRow`, `DeletedParcelRow` និង `ParcelBarcode` ក្នុង `src/domain/parcel.ts` ជា interface
របស់ `scanHistory` និង `deletedItems` ក្នុង `src/core/state.ts`។ Field ដែលទិន្នន័យចាស់អាចខ្វះ
រក្សាជា optional; ចំនួនប្រាក់ និងត្រាពេលមាន type `number`។ Recovery marker ក្នុង view អាចនៅមិនពេញលេញ;
interface របស់វាមិនជំនួសការផ្ទៀង Server ឬ validated marker មុនអនុវត្តការងារទេ។

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
៣. បន្ថែម interface ពិតជំនួស `any` សម្រាប់ SDK/backend handles, ឃ្លាំង daily/monthly revenue,
   pickup/collected និង UI view models ដែលនៅសល់។ ប្រើ interface កញ្ចប់/Barcode ដែលមានស្រាប់
   ហើយផ្ទៀងរូបរាងជាមួយ Firebase rules (`firebase-database.rules.json`); ការដាក់ type លើ state
   មិនធ្វើឱ្យ parameter ដែលនៅជា `any` ក្នុង domain/service functions តឹងដោយស្វ័យប្រវត្តិទេ
៤. រត់ typecheck · lint និងតេស្តតាមសេណារីយ៉ូដែលកែក្នុង session ហើយរង់ចាំ suite ពេញក្នុង CI តាម [Runbook](../../CLAUDE.md#-runbook); បៃតងមិនធានាថាឥរិយាបថទាំងអស់ដូចដើមទេ
៥. ពេល module ទាំងអស់រឹងរួច ➜ បើក `strictNullChecks` សកល រួចលុបផ្នែកនេះចោល

---

## ៣. ការចូលប្រើ DOM ៖ `src/app/refs.ts`

App ជា React ១០០% ➜ ⛔ **គ្មាន `byId()`** ៖ កូដមុខងារមិនប៉ះ DOM ដោយផ្ទាល់ (`npm run purity:check`) ហើយ
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
