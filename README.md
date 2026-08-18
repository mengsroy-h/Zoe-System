# Zoe-System — ប្រព័ន្ធគ្រប់គ្រងកញ្ចប់ទំនិញ

**Zoe-System** ជាសំណុំ App ចំនួន **៤** (4 independent PWAs) សម្រាប់គ្រប់គ្រងកញ្ចប់ទំនិញ
(Parcel/Package) របស់អតិថិជន ចាប់ពីការស្កេន Barcode បញ្ចូលកញ្ចប់ថ្មី, កំណត់ទីតាំង Locker,
ការទទួល/បិទបញ្ជី, រហូតដល់ការគណនាប្រាក់ត្រូវទារ (COD/DOD) និងស្ថិតិចំណូល។ App នីមួយៗសរសេរដោយ
**Vanilla JavaScript សុទ្ធ** (គ្មាន Framework, គ្មាន Build Step) ហើយ Deploy ដាច់ដោយឡែកពីគ្នា
ជា Netlify Site របស់ខ្លួន។

## App ទាំង ៤

| App | តួនាទីអនុញ្ញាត | មុខងារសំខាន់ | README |
|---|---|---|---|
| **ZoeAdmin** | `admin` | App គ្រប់គ្រងសំខាន់ — បញ្ចូល/លុប/កែប្រែកញ្ចប់ទាំងអស់, Export PDF/Excel, ស្ថិតិពេញលេញ | [ZoeAdmin/README.md](ZoeAdmin/README.md) |
| **ZoeW** | `admin`, `worker` | ទទួល/តាមដានកញ្ចប់ — ស្កេន, បិទ/បើកបញ្ជី, កែលេខទូរស័ព្ទ, មើលស្ថិតិ (មិនអាចបញ្ចូលកញ្ចប់ថ្មី) | [ZoeW/README.md](ZoeW/README.md) |
| **Zoescan** | `admin`, `worker`, `scanner` | កំណត់ទីតាំង Locker ប៉ុណ្ណោះ (មិនអាចបញ្ចូល/លុបកញ្ចប់) | [Zoescan/README.md](Zoescan/README.md) |
| **ZoeKeyGen** | `admin` (Firebase Project ដាច់ដោយឡែក) | បង្កើត/Revoke/Extend Activation Key សម្រាប់ App ទាំង ៣ខាងលើ | [ZoeKeyGen/README.md](ZoeKeyGen/README.md) |

## ស្ថាបត្យកម្ម (Architecture)

- **Vanilla JS, គ្មាន Framework, គ្មាន Build Step** — គ្រាន់តែ Static files (HTML/CSS/JS)
  Deploy ត្រង់ៗ។ App នីមួយៗមាន `netlify.toml` ផ្ទាល់ខ្លួន ហើយ Deploy ជា Netlify Site ដាច់ដោយឡែក។
- **ZoeAdmin, ZoeW, Zoescan** ចែករំលែក Firebase Realtime Database តែមួយ (ទិន្នន័យអាជីវកម្ម —
  Parcel/COD/DOD)។ Rules នៅ [firebase-database.rules.json](firebase-database.rules.json)
  (Root) ត្រូវ Paste ដោយដៃទៅ Firebase Console → Realtime Database → Rules → Publish —
  **មិន Deploy ស្វ័យប្រវត្តិទេ** ព្រោះ Netlify Serve តែ Static files ប៉ុណ្ណោះ។
- **ZoeKeyGen** ប្រើ Firebase Project **ដាច់ដោយឡែកទាំងស្រុង** ពី ៣ App ខាងលើ (មិនប៉ះពាល់
  ទិន្នន័យអាជីវកម្ម ទោះ Project នេះមានបញ្ហាក៏ដោយ) — Rules ផ្ទាល់ខ្លួននៅ
  `ZoeKeyGen/firebase-database.rules.json`។
- **សំខាន់**៖ ទោះ ZoeAdmin និង ZoeW មានមុខងារស្រដៀងគ្នាច្រើន (delete/restore/pickup-stat/
  revenue) `app.js` របស់ App នីមួយៗគឺ **ជា File ដាច់ដោយឡែក ស្ទួនគ្នា** — ការជួសជុល Bug
  ក្នុង App មួយ **មិន Auto-apply** ទៅ App ដទៃទេ ត្រូវពិនិត្យ Mirror ដោយដៃរាល់ពេល។
- `license-verify.js` ត្រូវតែ **Byte-identical** គ្រប់ទាំង ៤ App (Shared Public Key +
  Verification Logic សម្រាប់ផ្ទៀងផ្ទាត់ Activation Key ពី ZoeKeyGen)។
- **១ Sentry Project រួម** សម្រាប់ App ទាំង ៤ ញែកគ្នាដោយ Tag `app`
  (`zoeadmin`/`zoew`/`zoescan`/`zoekeygen`)។

## គោលការណ៍អាជីវកម្មសំខាន់

"**លុប**" (Delete កញ្ចប់ទាំងមូល) និង "**ដក**" (Remove Barcode តែមួយ) ជាគោលការណ៍អាជីវកម្ម
ដាច់ដោយឡែកពីគ្នា ប៉ះពាល់ស្ថិតិចំណូលខុសគ្នា — សូមមើលព័ត៌មានលម្អិតក្នុង
[ZoeAdmin/README.md](ZoeAdmin/README.md#គោលការណ៍-លុប-vs-ដក-delete-vs-remove-policy)។

## សម្រាប់អ្នកអភិវឌ្ឍន៍ (Developers / AI Assistants)

[CLAUDE.md](CLAUDE.md) ក្នុង Repo នេះមានព័ត៌មានលម្អិតបច្ចេកទេសពេញលេញសម្រាប់ការធ្វើការបន្ត —
Known bug classes ដែលធ្លាប់ជួសជុលរួច, Business rule ពិសេស (Delete vs Remove, Timestamp/clock
rule), Style convention (Code គ្មាន Comment ដោយចេតនា), និងរបៀប Triage Sentry report។ **សូម
អាន CLAUDE.md មុននឹងកែប្រែកូដណាមួយ** — ជាពិសេសកូដទាក់ទងនឹងចំណូល (Revenue) ឬស្ថិតិ Pickup។

Guide ពេញលេញ (PDF, មិន Track ក្នុង Git — មើល `.gitignore`) មាននៅ `Zoe-System-Guide.pdf`
សម្រាប់អ្នកមាន Local copy។

## អាជ្ញាប័ណ្ណ (License)

គម្រោងនេះជាកម្មសិទ្ធិឯកជន (Private/Proprietary) — Powered By ZoeW
