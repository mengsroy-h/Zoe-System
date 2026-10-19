# កាតាឡុក API ZTO Palm

ឯកសារយោងសម្រាប់អភិវឌ្ឍ ZoeW ៖ endpoint ទាំងអស់ដែល App **ZTO Palm** ផ្លូវការហៅ (ដកពី APK ដែលម្ចាស់គម្រោងផ្តល់) —
method · path · field request · ប្រភេទ `result` · field response · screen ក្នុង App ដែលហៅវា។ របៀបកំណត់ និងប្រើ Login Palm ៖
[ZTO-PALM.md](ZTO-PALM.md)។

## ⛔ ច្បាប់មុនប្រើ endpoint ណាមួយ

- ZoeW ហៅតែ endpoint ដែល `netlify/functions/_shared/zto-palm.js` (`doLogin` · `billInfoQuery` · `queryDispatchList` · `queryTrackInfo`) និង `netlify/functions/_shared/zto-palm-sign.js` (`queryTrackInfo` · `newBusinessCheck` · `queryPreOrderByBillCode` · `saveBillPic` · `saveScanInfo` · `sign/log/v1/add` · `sign/log/v1/deleteByBillCode`) សរសេរច្បាស់។ endpoint ថ្មីចូលតែតាម
  PR ដែលមានអ្នកយាមធ្លាក់លើកូដមុនកែ ហើយផ្លូវលុយ (auto-close · ការរង់ចាំ ៨ ថ្ងៃ · ចំណូល) ត្រូវវាស់ជាមួយគណនីពិតជាមុន។
- ⛔ endpoint **សរសេរ** (save · upload · add · update · cancel · pay · scan · move · leave · bind …) បង្កើតការស្កេន ការចុះហត្ថលេខា
  ឬការបង់ប្រាក់ពិតក្នុង ZTO ➜ ផ្លូវ Sign ដែលអ្នកប្រើចុចផ្ទាល់ហៅតែ `saveBillPic` · `saveScanInfo` · `sign/log/v1/add` និង `sign/log/v1/deleteByBillCode`។ Endpoint បង់ប្រាក់មិនត្រូវបានហៅ។ ប្រភេទ «អាន/សរសេរ» ក្នុងតារាងកំណត់តាមឈ្មោះ endpoint ➜ ផ្ទៀងកូដ App មុនប្រើ។
- ⛔ សោ protocol (`x-sign` · AES) មិនសរសេរក្នុងឯកសារ ឬ repo ឡើយ — env Netlify តែប៉ុណ្ណោះ ([ZTO-PALM.md](ZTO-PALM.md))។
- ឯកសារនេះកត់តែ **ឈ្មោះ** field ពី class របស់ App ៖ ZTO អាចផ្ញើ field បន្ថែម ឬទុកទទេ ➜ ទម្រង់ និងតម្លៃពិតត្រូវវាស់ជាមួយគណនីពិត។

## Protocol

- Host ៖ production `https://aargus-api.ztoglobal.net` (App ក៏មាន host សាកល្បង `bos-manjc-api-test.zt-express.com` ·
  `pdaint.test.ztosys.com` តាម build)។ ខ្សែ sorting KH ប្រើ URL ផ្ទាល់ (`@Url`) មិនមែន host នេះ។
- Request ៖ `POST` JSON (ខ្លះ `GET` + query) · header `x-token` (token ពី `doLogin`) · `x-sign` = Base64(MD5(body JSON + sign key)) ·
  `x-language` (ឧ. `km_KH`) · `User-Agent: PDA`។ endpoint ដែលមិនផ្ញើ `x-language` ៖ `/zto/basic/v1/queryDestination` · `/zto/basic/v1/querySiteBalance` · `/zto/basic/v1/querySiteVehicleInfo` · `/zto/basic/v1/queryVehicleInfo` · `/zto/basic/v1/saveBillPic` · `/zto/basic/v1/saveScanInfo` · `/zto/basic/v1/saveVehiclePackageScanInfo` · `/zto/basic/v1/uploadKhSignScan` · `/zto/basic/v1/uploadPackage` · `/zto/basic/v2/getMaterialRule` · `/zto/basic/v2/queryDictionary` · `/zto/basic/v2/queryEmployee` · `/zto/basic/v2/querySitesByDestination` · `/zto/collect/v1/printedReturn` · `/zto/collect/v1/queryCollectExpressCount` · `/zto/collect/v1/queryCollectExpressDetail` · `/zto/collect/v1/queryDispExpressCount` · `/zto/collect/v1/queryExpressCount` · `/zto/collect/v1/queryPreOrderByBagCode` · `/zto/collect/v1/queryPreOrderByBillCode` · `/zto/collect/v1/querySignListExpressCount` · `/zto/dispatch/v1/queryDispatchList` · `/zto/dispatch/v1/queryDispatchListVN` · `/zto/picture/v1/querySignPic` · `/zto/scan/v1/queryVehicleNumber` · `/zto/shopee/scan/v1/queryCount` · `/zto/system/v1/uploadDeviceInfo`។
- Response ៖ `{ status: boolean, statusCode: string, message: string, result: T }` — `status !== true` = បដិសេធ (`statusCode` ប្រាប់មូលហេតុ)។
- Login (`/zto/system/v1/doLogin`) ៖ body `userName` · `password` · `deviceSn` · `equipment` · `version` · `timeZone` · `verifyId` (`password` = Base64 នៃ AES/ECB/PKCS5) ➜ `result` `accessToken` · `countryCode` · `currentTime` · `location` · `nickName` · `permissions` · `siteCode` · `siteName` · `token` · `userName`។
- `consigneeMobile` អាចជា AES (សោដូច password) ➜ ស្រាយនៅ server មុនបង្ហាញ។

## កូដស្ថានភាពដែលឃើញក្នុង App

| វាល | តម្លៃ | អត្ថន័យក្នុង App |
|---|---|---|
| `billStatus` (`queryDispatchList`) | `1` | tab «បញ្ហា» (`ProblemTabFragment`) |
| `billStatus` (`queryDispatchList`) | `4` | tab «បញ្ជូន» (`DispatchTabFragment`) · ជួរថ្ងៃ `dispEmpDateFrom` ➜ `dispEmpDateTo` · កញ្ចប់ដែល ZTO ចាត់ឲ្យសាខាចែក រួមទាំងកញ្ចប់ដែលនៅតាមផ្លូវ ⛔ មិនមែនស្កេនមកដល់ (`03`) ទេ (ម្ចាស់គម្រោងវាស់ធៀបនឹងបញ្ជី Cookie) · `billStatus` របស់ជួរ = ស្ថានភាពបច្ចុប្បន្នរបស់កញ្ចប់ |
| `billStatus` (`queryDispatchList`) | `5` | tab «ចុះហត្ថលេខា» (`SignTabFragment`) · ជួរថ្ងៃ `signSiteDateFrom` = `YYYY-MM-DD 00:00:00` ➜ `signSiteDateTo` = `YYYY-MM-DD 23:59:59` |
| endpoint ចំនួនសង្ខេប (`queryExpressCount` …) | `isSign` `1` · `billCollectionStatus` `3` · `dispatchBillStatus` `4` · `signBillStatus` `5` | ចំនួន/ទឹកប្រាក់ (`codCount` · `codTotalMoney` · `dodTotalMoney` · `signFor` …) តាមជួរថ្ងៃ `dateFrom` ➜ `dateTo` |
| `mailType` (`queryTrackInfo` · `checkTrackInfo`) | `1` (លេខ) · `"1"` (String) | `mailNos` = String លេខ Barcode · ZoeW សាក «A,B,C» (≤ ១០) ហើយទទួលតែ track ដែល `mailNo` ត្រូវ Barcode នីមួយៗ · មិនគាំទ្រ ➜ ម្តងមួយលេខ |
| `status` (`ProblemTabFragment`) | `WorkOrderStatus` `ALL` · `NOT` · `ING` · `DONE` (ordinal ០–៣) | ស្ថានភាពការងារបញ្ហា |
| `pageSize` (`DispatchQueryInfoQTO`) | លំនាំដើម QTO `20`; `DispatchTabFragment` កំណត់ `1000` | ចម្លើយមាន `pageNum` · `pages` · `total` · `isFirstPage` · `isLastPage` |

ក្នុង `ScanType` របស់ APK ៖ `ARRIVE_SCAN` = `3` · `DISPATCH_SCAN` = `4` · `SIGN_SCAN` = `5`។
លេខប្រភេទស្កេននេះ និង `billStatus` ជាវាលពីរផ្សេងគ្នា។ ផ្ទាំងប្រវត្តិស្កេន Palm
(`ScanQueryDetailPresenter.queryScanRecord`) អាន `UploadPoolTable` ក្នុងឧបករណ៍។

`billStatus` `5` = ចុះហត្ថលេខា ក៏ស្របនឹង Argus (`ZTO_SIGNED_VALUES`) ដែរ។

## ផែនទីមុខងារ ZoeW ➜ endpoint Palm

| មុខងារ ZoeW | Endpoint Palm | ស្ថានភាព |
|---|---|---|
| Lookup លេខទូរស័ព្ទ · COD · DOD ពេលស្កេន | `billInfoQuery` (`cod` · `dod` · `consigneeMobile`) | ប្រើរួច |
| ទាញបញ្ជីកញ្ចប់ពី ZTO (កញ្ចប់មកដល់ · ស្កេន `03`) | SSO Palm `/scan/page/scan` ប្រភេទ `03` + native `queryDispatchList` tab `5` + `queryTrackInfo` ផ្ទៀងស្កេន `3` ត្រូវសាខា/ថ្ងៃ | `candidates=1` (១០០ ជួរ/ទំព័រ · `tabs=3,5`) ➜ `tracks=` (≤ ៣០ Barcode · ស្របគ្នា · `mailNos` ម្តងមួយលេខ) · track ខូច ➜ `unverified`; ការមើលជាមុនមិនប៉ះប្រាក់ |
| បញ្ជីចុះហត្ថលេខា · បិទស្វ័យប្រវត្តិ · ការរង់ចាំ ៨ ថ្ងៃ | `queryDispatchList` `billStatus` `5` + `signSiteDate*` + ទំព័រ | ប្រើរួច (`?palm=1&list=1&signed=1` · `exact=1`) |
| 🧪 ពិនិត្យ field ដើមពេញ | `billInfoQuery` + `queryTrackInfo` (`mailType: 1` · `mailNos: barcode`) | ប៊ូតុង 🧪 របៀប Palm · JSON ពេញ អាចចម្លងបាន |
| ស្ថានភាពកញ្ចប់មួយ (`ztoClosed`) | `queryTrackInfo` · `mail.isSign` + `tracks.action`/`siteCode`/`time` | ប្រើរួច (`status=1`) · របារ «មិនទាន់ចុះហត្ថលេខា» · ពិនិត្យវដ្តមកដល់ចុងក្រោយ |
| ប្រភព VN · CN · ផ្សេងៗ | `recSite`/`customerCodeDesc` បើមាន; បើគ្មាន ឈ្មោះទីទទួលដើម `action: "1"` ពី `msgLoc`/`msgEng`/`siteName` | រក្សា `from` ទាំងជួរមកដល់ និងចុះហត្ថលេខា · មិនច្រោះតាមប្រទេសគោលដៅ |
| រូបចុះហត្ថលេខា | `querySignPic` (`billCode`) | ជម្រើស |
| ផ្ទៀងចំនួន/ទឹកប្រាក់ប្រចាំថ្ងៃ | `querySignListExpressCount` · `queryDispExpressCount` | ជម្រើស |

## H5 ដែល APK បើក · ផ្លូវត្រួតពិនិត្យអានតែប៉ុណ្ណោះ

APK មាន URL `https://apdah5.ztoglobal.com/`; source JavaScript សាធារណៈរបស់ H5 ដែលអាននៅជុំនេះ បញ្ជាក់ `SignMonitor` ➜ `LocalAgingMonitor` ➜ បញ្ជី «មកដល់តែមិនទាន់ចុះហត្ថលេខា»។ ផ្លូវនេះមិនស្ថិតក្នុង `PDAService` native ១១៣ endpoint ខាងក្រោមទេ។

- Host របាយការណ៍៖ `https://intlreport.ztoglobal.com`។ `GET /getUserInfo` ➜ `{ success, data: { siteCode, … } }`; ត្រូវសាខា Palm មុនអាន detail។
- `POST /report/seaKhLocalAgingMonitor/queryDetail` ➜ body `{ condition: { searchStartDate, searchEndDate, siteCodeList, queryType: 2 }, pageNum, pageSize }`។ H5 ផ្ញើ១០ជួរ/ទំព័រ និងអាន `{ success, data: { result, total } }`។ Column៖ `billCode`, `dispSiteName`, `centreComeDate`, `centreSendDate`, `proSign`។ ថ្ងៃមកដល់នៅមជ្ឈមណ្ឌលមិនអាចជំនួស own-site track បាន។
- H5 bridge យក `token.token` ទៅ `PDA_USER_COOKIE_01` និង `token.ssoToken` (មកពី Login `accessToken`) ទៅ `PDA_SSO_COOKIE_01`។ ZoeW ប្រើតែ SSO ដែលមានក្នុង sealed Palm token; មិនអាន Cookie ពី Blob។ គ្មាន secret ពី bundle សាធារណៈត្រូវបានប្រើ ឬចម្លងចូល repo។
- បញ្ជីមកដល់អាន `GET https://aargus-api.ztoglobal.com/getUserInfo` ផ្ទៀងសាខា រួច `POST /scan/page/scan` ដោយ SSO Palm ដដែល, `scanTypeCode: 03`, សាខា និងចន្លោះថ្ងៃជ្រើស, ទំហំ១០០។ ប្រើ helper request/projection Argus; report H5 ជាបញ្ជី API យោងប៉ុណ្ណោះ។
- Server មិនតាម redirect មិនអនុញ្ញាតប្តូរ host/path តាម config Cookie និងមិនបញ្ចេញ credentials; ទំព័រ/total មិនត្រឹមត្រូវ ឬសាខាខុស ➜ បដិសេធ។ Native signed tab `5` រកកញ្ចប់ចុះហត្ថលេខាដែលមកដល់មុនចន្លោះ។

## តារាង endpoint ទាំងអស់ (113 · អាន 65 · សរសេរ 48)

| # | ប្រភេទ | Method · Path | ឈ្មោះក្នុង App | Request (body/query) | Response `result` | Screen ក្នុង App |
|---|---|---|---|---|---|---|
| 1 | សរសេរ | `POST (@Url dynamic)` | `bindGrid` | `deviceNo` · `gridNo` · `packageCode` | `KHSortingLineSimpleRPTO` | — |
| 2 | សរសេរ | `POST (@Url dynamic)` | `closeGrid` | `deviceNo` · `gridNo` | `KHSortingLineSimpleRPTO` | — |
| 3 | សរសេរ | `POST (@Url dynamic)` | `openGrid` | `deviceNo` · `gridNo` | `KHSortingLineSimpleRPTO` | — |
| 4 | អាន | `POST (@Url dynamic)` | `queryDeviceConnectState` | `deviceNo` | `KHSortingLineSimpleRPTO` | — |
| 5 | អាន | `POST (@Url dynamic)` | `queryGridInfo` | `deviceNo` · `gridNo` | `KHSortingLineGridInfo` | — |
| 6 | សរសេរ | `POST (@Url dynamic)` | `unbindGrid` | `deviceNo` · `gridNo` | `String` | — |
| 7 | អាន | `POST /zto/bagInventory/v1/checkExist` | `checkRfidExist` | `bagCode` | `Boolean` | — |
| 8 | សរសេរ | `POST /zto/bagInventory/v1/finishAdd` | `bagPutIn` | `bagCodeList` · `bagType` = "0" | `Boolean` | — |
| 9 | សរសេរ | `POST /zto/bagInventory/v1/recycle` | `bagRecycle` | `bagCodeList` · `recycleType` | `List‹BagRecycleRPTO›` | — |
| 10 | អាន | `POST /zto/bagInventory/v1/recycleCheck` | `checkRfidByRecycle` | `bagCode` · `recycleType` | `Boolean` | — |
| 11 | អាន | `POST /zto/basic/v1/billInfoQuery` | `queryBillInfo` | `billCode` | `DispatchBillInfoRPTO` | `DispatchBillInfoPresenter` |
| 12 | សរសេរ | `POST /zto/basic/v1/cancelForReady` | `cancelOutPackage` | `ids` · `modifier` | `Boolean` | — |
| 13 | អាន | `POST /zto/basic/v1/checkTrackInfo` | `checkTrackInfo` | `mailType` = "1" · `mailNos` | `Boolean` | — |
| 14 | អាន | `POST /zto/basic/v1/findChildren` | `getCityList` | `level` · `parentCode` | `List‹CityRPTO›` | `DispatchTabFragment` · `ProblemTabFragment` |
| 15 | អាន | `GET /zto/basic/v1/getByDeliveryNo` | `getByDeliveryNo` | `deliveryNo` · query: `deliveryNo` | `String` | — |
| 16 | អាន | `GET /zto/basic/v1/getErrorWarehouseWhiteFlag` | `checkPutInWPermission` | `barScannerId` · query: `barScannerId` | `Boolean` | `TabScanPresenter` |
| 17 | អាន | `POST /zto/basic/v1/getExpressType` | `getExpressTypeList` | `consigneeCountryCode` | `List‹String›` | — |
| 18 | អាន | `POST /zto/basic/v1/hasUnload` | `hasUnload` | `packageCode` | `String` | — |
| 19 | សរសេរ | `POST /zto/basic/v1/leavePackage` | `putOutPackage` | `countryCode` · `scanSiteCode` · `scanManCode` · `billCode` · `id` | `WaitOutPackage` | — |
| 20 | សរសេរ | `POST /zto/basic/v1/movePackage` | `movePackage` | JSONArray | `List‹UploadResultRPTO›` | — |
| 21 | អាន | `POST /zto/basic/v1/nextSiteCheck` | `sendSiteCodeCheck` | `billCode` · `nextSite` | `Boolean` | — |
| 22 | អាន | `POST /zto/basic/v1/parentBillInfoQuery` | `parentBillInfoQuery` | `parentBillCode` | `List‹SubOrderInfo›` | — |
| 23 | អាន | `POST /zto/basic/v1/queryDestination` | `queryDestination` | `destinationCode` | `String` | — |
| 24 | អាន | `POST /zto/basic/v1/queryForLast` | `searchRecallInfo` | `billCode` | `RecallInfoRPTO` | — |
| 25 | អាន | `POST /zto/basic/v1/queryForReady` | `queryWaitOutPackageList` | `countryCode` · `scanSiteCode` | `List‹WaitOutPackage›` | — |
| 26 | អាន | `POST /zto/basic/v1/queryPackage` | `queryPackage` | `packageCode` | `PackageInfoRPTO` | — |
| 27 | អាន | `POST /zto/basic/v1/querySequence` | `querySequence` | `name` | `String` | — |
| 28 | អាន | `POST /zto/basic/v1/querySiteBalance` | `querySiteOwe` | `type` | `List‹Boolean›` | — |
| 29 | អាន | `POST /zto/basic/v1/querySiteVehicleInfo` | `getBaseCarInfo` | `pageSize` · `currentPage` | `InfoEntity‹CarInfoRPTO›` | — |
| 30 | អាន | `POST /zto/basic/v1/queryTimeZone` | `queryTimeZone` | — | `InfoEntity‹TimeZoneMetaDataRPTO›` | — |
| 31 | អាន | `POST /zto/basic/v1/queryVehicleInfo` | `queryVehicleInfo` | `vehicleBarcode` · `licensePlate` | `VehicleInfoRPTO` | — |
| 32 | អាន | `POST /zto/basic/v1/queryWaybillDestination` | `queryWaybillDestination` | `siteCode` | `BillDestinationPRTO` | — |
| 33 | សរសេរ | `POST /zto/basic/v1/saveBillPic` | `uploadImage` | `fileName` · `picType` · `billCode` | `Object` | — |
| 34 | សរសេរ | `POST /zto/basic/v1/saveFailPaperOrder` | `saveFailPaperOrder` | `action` · `orderNo` · `billCode` · `optReason` · `optReasonCode` | `Boolean` | `ExpressUnCollectFragment` |
| 35 | សរសេរ | `POST /zto/basic/v1/saveOmsPaperOrder` | `saveOmsPaperOrder` | UploadPaperReceiveBean { `agentAmount` · `agentServiceCharge` · `billCode` · `deliveryTypeId` · `deliveryTypeIdDesc` · `dispSiteDesc` · `dispSiteId` · `expressTypeId` · `expressTypeIdDesc` · `freightFee` · `insureFee` · `insureTypeId` · `nextStationCode` · `nextStationName` · `payTypeId` · `payTypeIdDesc` · `prevSiteCode` · `receiverId` · `receiverIdDesc` · `scanTypeCode` · `shipTypeId` · `shipTypeIdDesc` · `weight` } | `Boolean` | — |
| 36 | សរសេរ | `POST /zto/basic/v1/savePaperOrder` | `savePaperOrder` | UploadPaperReceiveBean { `agentAmount` · `agentServiceCharge` · `billCode` · `deliveryTypeId` · `deliveryTypeIdDesc` · `dispSiteDesc` · `dispSiteId` · `expressTypeId` · `expressTypeIdDesc` · `freightFee` · `insureFee` · `insureTypeId` · `nextStationCode` · `nextStationName` · `payTypeId` · `payTypeIdDesc` · `prevSiteCode` · `receiverId` · `receiverIdDesc` · `scanTypeCode` · `shipTypeId` · `shipTypeIdDesc` · `weight` } | `Boolean` | — |
| 37 | សរសេរ | `POST /zto/basic/v1/savePickUpList` | `savePickUpList` | UploadPickUpGoodsBean { `barScannerId` · `billCode` · `listNo` · `scanDate` · `scanTypeCode` } | `List‹String›` | — |
| 38 | សរសេរ | `POST /zto/basic/v1/saveScanInfo` | `uploadData` | JSONArray | `List‹UploadResultRPTO›` | — |
| 39 | សរសេរ | `POST /zto/basic/v1/saveVehiclePackageScanInfo` | `uploadVehiclePackageData` | JSONArray | `List‹UploadResultRPTO›` | — |
| 40 | សរសេរ | `POST /zto/basic/v1/scrap` | `destroyOutPackage` | `billCode` · `scanManCode` · `countryCode` | `Boolean` | — |
| 41 | សរសេរ | `POST /zto/basic/v1/shopeePackageScan` | `shopeePackageScan` | `packageCode` · `nextSiteCode` | `Integer` | — |
| 42 | អាន | `POST /zto/basic/v1/subBusinessCheck` | `subBusinessCheck` | `scanType` · `dataFrom` · `provinceCode` · `billCodeLists` | `BillCodeScanCheckRPTO` | — |
| 43 | សរសេរ | `POST /zto/basic/v1/uploadKhSignScan` | `uploadSignData` | JSONArray | `List‹UploadResultRPTO›` | — |
| 44 | សរសេរ | `POST /zto/basic/v1/uploadPackage` | `uploadPutInWarehouseData` | JSONArray | `List‹UploadResultRPTO›` | — |
| 45 | សរសេរ | `POST /zto/basic/v2/callLogUpload` | `callLogUpload` | `connectStatus` = 1 · `customerPhone` · `connectTime` · `talkTime` · `billCode` · `callTime` · `actionDescs` · `dataFrom` = "Z10-VN-PDA" | `UploadResultRPTO` | — |
| 46 | អាន | `POST /zto/basic/v2/getMaterialRule` | `getRule` | `modifyTime` · `pageSize` = 1000 · `pageNum` = 1 | `InfoEntity‹RuleRPTO›` | — |
| 47 | អាន | `POST /zto/basic/v2/laBusinessCheck` | `laBusinessCheck` | `billCode` · `scanType` · `dataFrom` · `provinceCode` · `billCodeLists` · `preOrNextStationCode` · `ignoreCodBacklog` · `ignoreDispSiteId` | `BillCodeScanCheckRPTO` | — |
| 48 | អាន | `POST /zto/basic/v2/newBusinessCheck` | `newBusinessCheck` | `billCode` · `scanType` · `dataFrom` · `provinceCode` · `billCodeLists` · `preOrNextStationCode` · `ignoreCodBacklog` · `ignoreDispSiteId` | `BillCodeScanCheckRPTO` | — |
| 49 | អាន | `POST /zto/basic/v2/queryDictionary` | `getDictionary` | `modifyTime` · `typeCodeList` · `pageSize` · `pageNum` | `InfoEntity‹MetaDataRPTO›` | — |
| 50 | អាន | `POST /zto/basic/v2/queryEmployee` | `getBaseUserInfo` | `modifyTime` · `ownerSiteCode` · `pageSize` · `pageNum` | `InfoEntity‹UserInfoRPTO›` | — |
| 51 | អាន | `POST /zto/basic/v2/querySitesByDestination` | `getBaseSiteInfo` | `modifyTime` · `pageSize` · `pageNum` | `InfoEntity‹SiteInfoRPTO›` | — |
| 52 | សរសេរ | `POST /zto/collect/v1/addPackageProblemBill` | `addPackageProblemBill` | `packageCode` · `billCode` · `problemType` | `EditResultRPTO` | — |
| 53 | សរសេរ | `POST /zto/collect/v1/printedReturn` | `savePrintSucc` | `billCode` | `Object` | — |
| 54 | អាន | `POST /zto/collect/v1/queryAccountBalance` | `queryAccountBalance` | `siteCode` · `countryCode` | `AccountBalanceRPTO` | `TabDataPresenter` |
| 55 | អាន | `POST /zto/collect/v1/queryCollectExpressCount` | `queryCollectExpressCount` | `dateFrom` · `dateTo` · `isSign` = "1" · `billStatus` · `billCollectionStatus` = "3" · `dispatchBillStatus` = "4" · `signBillStatus` = "5" | `ExpressCountRPTO` | `TabDataPresenter` |
| 56 | អាន | `POST /zto/collect/v1/queryCollectExpressDetail` | `queryExpressInfo` | `orderNo` | `ExpressInfoRPTO` | — |
| 57 | អាន | `POST /zto/collect/v1/queryCollectExpressList` | `getExpressList` | `orderStatus` · `pageSize` = 20 · `pageNum` · `billCode` · `shipperName` · `isPrint` · `dateFrom` · `dateTo` | `ExpressListRPTO` | `ExpressCollectedFragment` · `ExpressUnCollectFragment` |
| 58 | អាន | `POST /zto/collect/v1/queryDispExpressCount` | `queryDispExpressCount` | `dateFrom` · `dateTo` · `isSign` = "1" · `billStatus` · `billCollectionStatus` = "3" · `dispatchBillStatus` = "4" · `signBillStatus` = "5" | `ExpressCountRPTO` | `TabDataPresenter` |
| 59 | អាន | `POST /zto/collect/v1/queryExpressCount` | `queryExpressCount` | `dateFrom` · `dateTo` · `isSign` = "1" · `billStatus` · `billCollectionStatus` = "3" · `dispatchBillStatus` = "4" · `signBillStatus` = "5" | `ExpressCountRPTO` | — |
| 60 | អាន | `POST /zto/collect/v1/queryPackageInfo` | `getSmallPackageCodeList` | `ladingNo` | `List‹String›` | — |
| 61 | អាន | `POST /zto/collect/v1/queryPreOrderByBagCode` | `queryPreOrderByBagCode` | `billCode` | `ExpressInfoRPTO` | — |
| 62 | អាន | `POST /zto/collect/v1/queryPreOrderByBillCode` | `queryPreOrderByBillCode` | `billCode` · `customerNo` | `ExpressInfoRPTO` | — |
| 63 | អាន | `POST /zto/collect/v1/querySignListExpressCount` | `querySignListExpressCount` | `dateFrom` · `dateTo` · `isSign` = "1" · `billStatus` · `billCollectionStatus` = "3" · `dispatchBillStatus` = "4" · `signBillStatus` = "5" | `ExpressCountRPTO` | `SignTabFragment` |
| 64 | សរសេរ | `POST /zto/collect/v1/updateOrder` | `updateOrder` | `billCode` · `consigneeMobile` | `String` | — |
| 65 | អាន | `POST /zto/dispatch/v1/deliveryQuery` | `mapDeliveryQuery` | `billCode` · `orderNo` | `MapOrder` | `MapActivity` |
| 66 | អាន | `POST /zto/dispatch/v1/pickupDeliveryQuery` | `mapPickupDeliveryQuery` | `dateFrom` · `dateTo` | `MapOrderRPTO` | `MapActivity` |
| 67 | អាន | `POST /zto/dispatch/v1/pickupQuery` | `mapPickupQuery` | `billCode` · `orderNo` | `MapOrder` | `MapActivity` |
| 68 | អាន | `POST /zto/dispatch/v1/queryDispatchList` | `getDispatchList` | DispatchQueryInfoQTO { `billCode` · `billStatus` · `consigneeCityCode` · `consigneeDistrictCode` · `consigneeMobile` · `consigneeName` · `consigneeProvinceCode` · `dispEmpDateFrom` · `dispEmpDateTo` · `isIssue` · `pageNum` · `signSiteDateFrom` · `signSiteDateTo` · `pageSize` · `status` } | `DispatchListRPTO` | `DispatchTabFragment` · `ProblemTabFragment` · `SignTabFragment` |
| 69 | អាន | `POST /zto/dispatch/v1/queryDispatchListVN` | `getDispatchListVN` | DispatchQueryInfoQTO { `billCode` · `billStatus` · `consigneeCityCode` · `consigneeDistrictCode` · `consigneeMobile` · `consigneeName` · `consigneeProvinceCode` · `dispEmpDateFrom` · `dispEmpDateTo` · `isIssue` · `pageNum` · `signSiteDateFrom` · `signSiteDateTo` · `pageSize` · `status` } | `DispatchListVNRPTO` | `TabDataPresenter` · `DispatchTabFragment` · `ProblemTabFragment` |
| 70 | សរសេរ | `POST /zto/khPay/v1/applyPayOffline` | `applyPayOffline` | `billCodeList` | `KHPayInfoRPTO` | — |
| 71 | សរសេរ | `POST /zto/khPay/v1/applyPayOnline` | `applyPayOnline` | `billCodeList` · `payChannelCode` = "10045" · `productCode` · `methodCode` | `KHPayInfoRPTO` | — |
| 72 | សរសេរ | `POST /zto/khPay/v1/cancelPay` | `cancelPay` | `billCode` | `Boolean` | — |
| 73 | អាន | `POST /zto/khPay/v1/checkQrCode` | `checkQrCode` | `billCode` | `KHPayInfoRPTO` | — |
| 74 | សរសេរ | `POST /zto/khPay/v1/confirmPayOffline` | `confirmPayOffline` | `billCodeList` · `payType` = "8" | `KHPayResult` | — |
| 75 | សរសេរ | `POST /zto/khPay/v1/deletePay` | `deletePay` | `billCode` | `Boolean` | `ScanQueryDetailPresenter` |
| 76 | អាន | `POST /zto/khPay/v1/queryPayStatus` | `queryPayStatus` | `payNo` | `KHPayStatus` | — |
| 77 | អាន | `POST /zto/locus/v1/queryTrackInfo` | `queryTrackInfo` | `mailType` = 1 · `mailNos` | `List‹QueryTrackingRPTO›` | — |
| 78 | សរសេរ | `POST /zto/pay/v1/createPayment` | `createPayment` | `ztoOrder` · `retry` · `cod` = "0.00" · `dod` = "0.00" · `amount` · `billStatus` · `sendTime` · `custId` · `dataSource` | `CreatePaymentPRTO` | `DispatchTabFragment` |
| 79 | អាន | `POST /zto/pay/v1/queryPaymentRecord` | `queryPaymentRecord` | `billCode` · `sendStartTime` · `sendEndTime` | `DispatchPayRPTO` | — |
| 80 | អាន | `POST /zto/pcScan/v1/getBillCodeByFirstWayNo` | `getBillCodeByFirstWayNo` | `firstWayNo` | `String` | — |
| 81 | អាន | `GET /zto/pdaSite/v1/queryCanDis` | `queryCanDis` | — | `List‹SiteInfoRPTO›` | — |
| 82 | អាន | `GET /zto/pdaSite/v1/queryNextSite` | `queryNextSite` | — | `List‹SiteInfoRPTO›` | — |
| 83 | សរសេរ | `POST /zto/pdaWaybill/v1/addShopeeAbnormal` | `addShopeeAbnormal` | `orderNo` · `problemReasonCode` · `problemReasonDesc` · `remark` | `Boolean` | `ExpressUnCollectFragment` |
| 84 | អាន | `POST /zto/pdaWaybill/v1/getSignScanList` | `getSignScanList` | `waybillList` | `List‹WaybillInfoKH›` | — |
| 85 | អាន | `POST /zto/pdaWaybill/v1/hasWaybill` | `hasWaybill` | `billCode` | `Boolean` | — |
| 86 | សរសេរ | `POST /zto/pdaWaybill/v1/updateCenterWeight` | `updateCenterWeight` | `billCode` · `weight` | `Boolean` | — |
| 87 | សរសេរ | `POST /zto/pdaWaybill/v1/updateConsigneeAddress` | `updateConsigneeAddress` | `consigneeAddress` · `billCodeList` · `shipperAddress` · `orderNoList` | `Boolean` | `MapActivity` |
| 88 | សរសេរ | `POST /zto/pdaWaybill/v1/updateDispEmp` | `updateDispEmp` | `billCode` · `orderNo` | `Boolean` | `MapActivity` |
| 89 | សរសេរ | `POST /zto/pdaWaybill/v1/updateDispSite` | `updateDispSite` | `billCode` · `dispSiteId` · `modifier` · `businessRegion` | `Boolean` | — |
| 90 | សរសេរ | `POST /zto/pdaWaybill/v1/updateRecEmp` | `updateRecEmp` | `billCode` · `orderNo` | `Boolean` | `MapActivity` |
| 91 | សរសេរ | `POST /zto/pdaWaybill/v1/updateShipperAddress` | `updateShipperAddress` | `consigneeAddress` · `billCodeList` · `shipperAddress` · `orderNoList` | `Boolean` | `MapActivity` |
| 92 | អាន | `POST /zto/picture/v1/querySignPic` | `querySignPic` | `billCode` | `List‹QuerySignPicRPTO›` | `SignTabFragment` |
| 93 | សរសេរ | `POST /zto/pps/v1/operate` | `lightBind` | `method` = "bind" · `tagID` · `billCode` · `firstNo` · `deliveryNo` · `consigneeMobile` · `consigneeName` · `shipperPhone` · `shipperName` | `Boolean` | — |
| 94 | សរសេរ | `POST /zto/pps/v1/operate` | `lightUnBind` | `billCodeList` · `method` = "unBind" | `Boolean` | — |
| 95 | អាន | `POST /zto/scan/v1/checkForBuildPackage` | `checkForBuildPackage` | `rfid` · `packageNo` · `billCode` | `Boolean` | — |
| 96 | អាន | `POST /zto/scan/v1/checkForErrorBillWarehouse` | `checkForErrorBillWarehouse` | `billCode` | `CheckForErrorBillWarehouseRPTO` | — |
| 97 | អាន | `POST /zto/scan/v1/checkForPackageBill` | `checkForPackageBill` | `scanTypeCode` · `billCode` · `packageNo` | `Boolean` | — |
| 98 | អាន | `POST /zto/scan/v1/khSignScanCheck` | `khSignScanCheck` | `billCode` · `scanType` · `dataFrom` | `BillCodeScanCheckKHRPTO` | — |
| 99 | សរសេរ | `POST /zto/scan/v1/laPackageScanAuth` | `laPackageScanAuth` | — | `String` | `TabScanPresenter` |
| 100 | អាន | `POST /zto/scan/v1/queryVehicleNumber` | `queryVehicleNumber` | `vehicleSignNo` | `String` | — |
| 101 | អាន | `POST /zto/shopee/scan/v1/queryCount` | `queryShopeeQty` | `dayStart` · `dayEnd` | `ShopeeScanCompareCountRPTO` | `TabDataPresenter` |
| 102 | សរសេរ | `POST /zto/sign/log/v1/add` | `addScanInfoToAEGS` | `billCode` · `actionTime` | `String` | — |
| 103 | សរសេរ | `POST /zto/sign/log/v1/deleteByBillCode` | `delScanInfoToAEGSList` | `billCodeList` | `Boolean` | `ScanQueryDetailPresenter` |
| 104 | សរសេរ | `POST /zto/sign/log/v1/deleteById` | `delScanInfoToAEGS` | `id` | `Boolean` | `ScanQueryDetailPresenter` |
| 105 | អាន | `POST /zto/sms/v1/querySmsConfigStatus` | `querySmsConfigStatus` | `userName` · `countryCode` | `List‹SmsConfigRPTO›` | — |
| 106 | សរសេរ | `POST /zto/sms/v1/updateSmsConfigStatus` | `updateSmsConfigStatus` | `userName` · `countryCode` · `sendType` · `status` · `dataSource` | `Boolean` | — |
| 107 | សរសេរ | `POST /zto/system/v1/doLogin` | `login` | `userName` · `password` · `deviceSn` = "unknow" · `equipment` = "unknow" · `version` · `timeZone` · `verifyId` | `LoginInfoRPTO` | — |
| 108 | សរសេរ | `POST /zto/system/v1/modifyPassword` | `modifyPassword` | `newPassword` · `confirmNewPassword` · `oldPassword` | `String` | — |
| 109 | សរសេរ | `POST /zto/system/v1/uploadDeviceInfo` | `deviceInfoUpload` | `deviceSn` · `equipment` · `manufacturer` · `appVersion` · `deviceVersion` · `processor` · `runningMemory` · `storageMemory` · `screen` · `mac` · `source` = 0 | `String` | — |
| 110 | អាន | `POST /zto/wcs/v1/buildPackageCheckV2` | `checkRfidCodeForCreatePkg` | `bagCode` · `packageCode` | `Boolean` | — |
| 111 | សរសេរ | `POST /zto/wcs/v1/buildPackageFinishV2` | `buildPackageFinish` | `deviceNo` · `gridNo` · `packageCode` · `nextSiteCode` · `bagCode` | `BuildPkgFinishCount` | — |
| 112 | អាន | `GET /zto/wcs/v1/getRfidCheck` | `getRfidCheck` | — | `Boolean` | — |
| 113 | អាន | `GET /zto/wcs/v1/getWCSKey` | `queryKHSortingLineBaseInfo` | — | `KHSortingLineBaseInfo` | — |

## Field response របស់ endpoint អាន

- `(@Url dynamic)` ➜ `KHSortingLineSimpleRPTO` ៖ `result` · `resultMessage`
- `(@Url dynamic)` ➜ `KHSortingLineGridInfo` ៖ `deviceNo` · `gridNor` · `nextSiteCode` · `packageCode` · `result` · `resultMessage` · `status`
- `/zto/basic/v1/billInfoQuery` ➜ `DispatchBillInfoRPTO` ៖ `cod` · `consigneeAddress` · `consigneeCity` · `consigneeCityDialect` · `consigneeCountry` · `consigneeDistrict` · `consigneeDistrictDialect` · `consigneeMobile` · `consigneeName` · `consigneeProvince` · `consigneeProvinceDialect` · `declareGoodsName` · `deliveryNo` · `deliveryType` · `deliveryTypeId` · `destinationSiteId` · `dod` · `expressType` · `expressTypeId` · `firstWayNo` · `freightFee` · `packageQty` · `packageType` · `payType` · `recSiteId` · `shipType` · `shipTypeId` · `shipperAddress` · `shipperAddressDialect` · `shipperCity` · `shipperCityDialect` · `shipperDistrict` · `shipperDistrictDialect` · `shipperMobile` · `shipperName` · `shipperProvince` · `shipperProvinceDialect` · `totalGoodsAmount` · `warehouseWeight`
- `/zto/basic/v1/findChildren` ➜ `List‹CityRPTO›` ៖ `code` · `name` · `nameEn` · `nameLang` · `select`
- `/zto/basic/v1/parentBillInfoQuery` ➜ `List‹SubOrderInfo›` ៖ `billCode` · `billStatus` · `orderNo` · `orderStatus` · `packageSeq`
- `/zto/basic/v1/queryForLast` ➜ `RecallInfoRPTO` ៖ `billCode` · `consigneeAddress` · `consigneeMobile` · `countryCode` · `deliverySite` · `destinationCode` · `destinationNo` · `imageUrl1` · `imageUrl2` · `locationNo` · `problemWhStatus` · `registSiteCode` · `registTime` · `remark`
- `/zto/basic/v1/queryForReady` ➜ `List‹WaitOutPackage›` ៖ `billCode` · `check` · `consigneeAddress` · `consigneeMobile` · `deliverySite` · `destinationNo` · `id` · `imageUrl1` · `imageUrl2` · `locationNo` · `problemWhStatus` · `remark`
- `/zto/basic/v1/queryPackage` ➜ `PackageInfoRPTO` ៖ `arriveScanTime` · `countryCode` · `destinationSiteCode` · `destinationSiteName` · `packageCode` · `packageType` · `sendSiteCode` · `status`
- `/zto/basic/v1/queryVehicleInfo` ➜ `VehicleInfoRPTO` ៖ `licensePlate` · `siteCode` · `vehicleBarcode` · `vehicleType`
- `/zto/basic/v1/queryWaybillDestination` ➜ `BillDestinationPRTO` ៖ `countryCode` · `destinationCode` · `destinationName` · `destinationNameEn` · `destinationNameLang` · `destinationNo`
- `/zto/basic/v1/subBusinessCheck` ➜ `BillCodeScanCheckRPTO` ៖ `message` · `whetherForce`
- `/zto/basic/v2/laBusinessCheck` ➜ `BillCodeScanCheckRPTO` ៖ `message` · `whetherForce`
- `/zto/basic/v2/newBusinessCheck` ➜ `BillCodeScanCheckRPTO` ៖ `message` · `whetherForce`
- `/zto/collect/v1/queryAccountBalance` ➜ `AccountBalanceRPTO` ៖ `codAccount` · `ordinaryAccount`
- `/zto/collect/v1/queryCollectExpressCount` ➜ `ExpressCountRPTO` ៖ `codCount` · `codTotalMoney` · `collect` · `discountFeeTotalMoney` · `dispatch` · `dodCount` · `dodTotalMoney` · `receive` · `signFor`
- `/zto/collect/v1/queryCollectExpressDetail` ➜ `ExpressInfoRPTO` ៖ `agentAmount` · `agentServiceCharge` · `billCode` · `chargeWeight` · `consigneeAddress` · `consigneeCity` · `consigneeCityDialect` · `consigneeDistrict` · `consigneeDistrictDialect` · `consigneeMobile` · `consigneeName` · `consigneeProvince` · `consigneeProvinceDialect` · `destination` · `discountFee` · `fcAmount` · `freightFee` · `insureFee` · `orderNo` · `packageCollection` · `packageType` · `payType` · `payTypeId` · `phone` · `recordingSiteCode` · `remark` · `remoteFee` · `shipperAddress` · `shipperCity` · `shipperDistrict` · `shipperMobile` · `shipperName` · `shipperProvince` · `totalFee` · `totalGoodsAmout`
- `/zto/collect/v1/queryCollectExpressList` ➜ `ExpressListRPTO` ៖ `isFirstPage` · `isLastPage` · `list` · `pageNum` · `pageSize` · `pages` · `total` · ធាតុក្នុងបញ្ជី ៖ `billCode` · `consigneeAddress` · `hasPrint` · `hasSelect` · `orderCreateDate` · `orderNo` · `problemReasonDesc` · `reminderStatus` · `shipperAddress` · `shipperName` · `shipperPhone`
- `/zto/collect/v1/queryDispExpressCount` ➜ `ExpressCountRPTO` ៖ `codCount` · `codTotalMoney` · `collect` · `discountFeeTotalMoney` · `dispatch` · `dodCount` · `dodTotalMoney` · `receive` · `signFor`
- `/zto/collect/v1/queryExpressCount` ➜ `ExpressCountRPTO` ៖ `codCount` · `codTotalMoney` · `collect` · `discountFeeTotalMoney` · `dispatch` · `dodCount` · `dodTotalMoney` · `receive` · `signFor`
- `/zto/collect/v1/queryPreOrderByBagCode` ➜ `ExpressInfoRPTO` ៖ `agentAmount` · `agentServiceCharge` · `billCode` · `chargeWeight` · `consigneeAddress` · `consigneeCity` · `consigneeCityDialect` · `consigneeDistrict` · `consigneeDistrictDialect` · `consigneeMobile` · `consigneeName` · `consigneeProvince` · `consigneeProvinceDialect` · `destination` · `discountFee` · `fcAmount` · `freightFee` · `insureFee` · `orderNo` · `packageCollection` · `packageType` · `payType` · `payTypeId` · `phone` · `recordingSiteCode` · `remark` · `remoteFee` · `shipperAddress` · `shipperCity` · `shipperDistrict` · `shipperMobile` · `shipperName` · `shipperProvince` · `totalFee` · `totalGoodsAmout`
- `/zto/collect/v1/queryPreOrderByBillCode` ➜ `ExpressInfoRPTO` ៖ `agentAmount` · `agentServiceCharge` · `billCode` · `chargeWeight` · `consigneeAddress` · `consigneeCity` · `consigneeCityDialect` · `consigneeDistrict` · `consigneeDistrictDialect` · `consigneeMobile` · `consigneeName` · `consigneeProvince` · `consigneeProvinceDialect` · `destination` · `discountFee` · `fcAmount` · `freightFee` · `insureFee` · `orderNo` · `packageCollection` · `packageType` · `payType` · `payTypeId` · `phone` · `recordingSiteCode` · `remark` · `remoteFee` · `shipperAddress` · `shipperCity` · `shipperDistrict` · `shipperMobile` · `shipperName` · `shipperProvince` · `totalFee` · `totalGoodsAmout`
- `/zto/collect/v1/querySignListExpressCount` ➜ `ExpressCountRPTO` ៖ `codCount` · `codTotalMoney` · `collect` · `discountFeeTotalMoney` · `dispatch` · `dodCount` · `dodTotalMoney` · `receive` · `signFor`
- `/zto/dispatch/v1/deliveryQuery` ➜ `MapOrder` ៖ `billCode` · `billStatus` · `city` · `cod` · `consigneeAddress` · `consigneeMobile` · `deliveryType` · `deliveryTypeId` · `discountFee` · `dispEmpId` · `dispEmpName` · `dispatchCount` · `district` · `dod` · `goodsName` · `grossWeight` · `isSearchOrder` · `lat` · `lng` · `name` · `orderCreateDate` · `orderNo` · `orderStatus` · `province` · `recEmpId` · `recEmpName` · `reminderNum` · `reminderStatus` · `shipperAddress` · `shipperMobile` · `type`
- `/zto/dispatch/v1/pickupDeliveryQuery` ➜ `MapOrderRPTO` ៖ `assignList` · `deliveryList` · `pickupList` · `MapOrder` ៖ `billCode` · `billStatus` · `city` · `cod` · `consigneeAddress` · `consigneeMobile` · `deliveryType` · `deliveryTypeId` · `discountFee` · `dispEmpId` · `dispEmpName` · `dispatchCount` · `district` · `dod` · `goodsName` · `grossWeight` · `isSearchOrder` · `lat` · `lng` · `name` · `orderCreateDate` · `orderNo` · `orderStatus` · `province` · `recEmpId` · `recEmpName` · `reminderNum` · `reminderStatus` · `shipperAddress` · `shipperMobile` · `type`
- `/zto/dispatch/v1/pickupQuery` ➜ `MapOrder` ៖ `billCode` · `billStatus` · `city` · `cod` · `consigneeAddress` · `consigneeMobile` · `deliveryType` · `deliveryTypeId` · `discountFee` · `dispEmpId` · `dispEmpName` · `dispatchCount` · `district` · `dod` · `goodsName` · `grossWeight` · `isSearchOrder` · `lat` · `lng` · `name` · `orderCreateDate` · `orderNo` · `orderStatus` · `province` · `recEmpId` · `recEmpName` · `reminderNum` · `reminderStatus` · `shipperAddress` · `shipperMobile` · `type`
- `/zto/dispatch/v1/queryDispatchList` ➜ `DispatchListRPTO` ៖ `isFirstPage` · `isLastPage` · `list` · `pageNum` · `pageSize` · `pages` · `total` · ធាតុក្នុងបញ្ជី ៖ `billCode` · `billStatus` · `cod` · `consigneeAddress` · `consigneeAddressDistrict` · `consigneeMobile` · `consigneeName` · `deliveryType` · `deliveryTypeId` · `details` · `discountFee` · `dispEmpDate` · `dispatchCount` · `dod` · `goodsName` · `grossWeight` · `registerTime` · `reminderNum` · `reminderStatus` · `shipperMobile`
- `/zto/dispatch/v1/queryDispatchListVN` ➜ `DispatchListVNRPTO` ៖ `dispatchList` · `problemList` · `DispatchListRPTO` ៖ `isFirstPage` · `isLastPage` · `list` · `pageNum` · `pageSize` · `pages` · `total` · `billCode` · `billStatus` · `cod` · `consigneeAddress` · `consigneeAddressDistrict` · `consigneeMobile` · `consigneeName` · `deliveryType` · `deliveryTypeId` · `details` · `discountFee` · `dispEmpDate` · `dispatchCount` · `dod` · `goodsName` · `grossWeight` · `registerTime` · `reminderNum` · `reminderStatus` · `shipperMobile`
- `/zto/khPay/v1/checkQrCode` ➜ `KHPayInfoRPTO` ៖ `amount` · `applyTime` · `billCodeList` · `expireTime` · `payInfoList` · `payNo` · `payType` · `url` · `WaybillInfoKH` ៖ `agentAmount` · `billCode` · `currencyCode` · `discountFee` · `fcAmount` · `orderNo` · `paidFee` · `payNo` · `paymentStatus` · `realPayFee`
- `/zto/khPay/v1/queryPayStatus` ➜ `KHPayStatus` ៖ `amount` · `payNo` · `status`
- `/zto/locus/v1/queryTrackInfo` ➜ `List‹QueryTrackingRPTO›` ៖ `tracks` · `TrackingRPTO` ៖ `action` · `actionName` · `carrier` · `country` · `customsCode` · `deliveryCode` · `deliveryContact` · `deliveryName` · `deliveryType` · `flightCode` · `id` · `mailNo` · `message` · `msgEng` · `msgLoc` · `place` · `preOrNext` · `preOrNextID` · `remark` · `siteCode` · `siteName` · `szAction` · `time` · `trackSource` · `weight` · `zone`
- `/zto/pay/v1/queryPaymentRecord` ➜ `DispatchPayRPTO` ៖ `codAll` · `currency` · `dodAll` · `paymentRecordVOList` · `total` · ធាតុក្នុងបញ្ជី ៖ `billCode` · `billStatus` · `cod` · `dod` · `orderCode` · `requestAmount` · `requestTime` · `sendTime` · `status`
- `/zto/pdaSite/v1/queryCanDis` ➜ `List‹SiteInfoRPTO›` ៖ `blCityWarehouse` · `blWarehouse` · `countryCode` · `defaultCurrencyCode` · `destinationCode` · `destinationName` · `destinationNameEn` · `destinationNameLang` · `destinationNo` · `id` · `isCenter` · `modifyTime` · `provinceCode` · `select` · `siteCode` · `siteName` · `siteNameEn` · `siteNameLang` · `siteNatureCode` · `status` · `superiorFinanceCenterCode` · `superiorSiteCode` · `typeCode`
- `/zto/pdaSite/v1/queryNextSite` ➜ `List‹SiteInfoRPTO›` ៖ `blCityWarehouse` · `blWarehouse` · `countryCode` · `defaultCurrencyCode` · `destinationCode` · `destinationName` · `destinationNameEn` · `destinationNameLang` · `destinationNo` · `id` · `isCenter` · `modifyTime` · `provinceCode` · `select` · `siteCode` · `siteName` · `siteNameEn` · `siteNameLang` · `siteNatureCode` · `status` · `superiorFinanceCenterCode` · `superiorSiteCode` · `typeCode`
- `/zto/pdaWaybill/v1/getSignScanList` ➜ `List‹WaybillInfoKH›` ៖ `agentAmount` · `billCode` · `currencyCode` · `discountFee` · `fcAmount` · `orderNo` · `paidFee` · `payNo` · `paymentStatus` · `realPayFee`
- `/zto/picture/v1/querySignPic` ➜ `List‹QuerySignPicRPTO›` ៖ `aliasName` · `billCode` · `savePos`
- `/zto/scan/v1/checkForErrorBillWarehouse` ➜ `CheckForErrorBillWarehouseRPTO` ៖ `billCode` · `retreatType`
- `/zto/scan/v1/khSignScanCheck` ➜ `BillCodeScanCheckKHRPTO` ៖ `errorMessage` · `waybillResVo` · `whetherForce` · `WaybillInfoKH` ៖ `agentAmount` · `billCode` · `currencyCode` · `discountFee` · `fcAmount` · `orderNo` · `paidFee` · `payNo` · `paymentStatus` · `realPayFee`
- `/zto/shopee/scan/v1/queryCount` ➜ `ShopeeScanCompareCountRPTO` ៖ `forecastQty` · `isDiff` · `overQty` · `scanQty` · `waitQty`
- `/zto/sms/v1/querySmsConfigStatus` ➜ `List‹SmsConfigRPTO›` ៖ `countryCode` · `dataSource` · `sendType` · `status` · `userName`
- `/zto/wcs/v1/getWCSKey` ➜ `KHSortingLineBaseInfo` ៖ `secretKey` · `time` · `timeZone` · `urlPrefix`

## វាលពេញលេញនៃ request/response model ពី APK

បញ្ជីនេះស្រង់ឈ្មោះ និងប្រភេទ field ដែលប្រកាសពិតពី DEX របស់ APK ហើយផ្ទៀង generic type ជាមួយកូដស្រង់។ រួមមាន package `component.http.rpto`, `component.http.rqto`, `component.http.core.base.entity` និង nested class ទាំងអស់។ Field ដែលទទួលតាម parent ត្រូវអានបន្ថែមក្នុង model parent។ `static` និង callback របស់ UI កត់សម្គាល់ដាច់ដោយឡែក; វាមិនស្មើថាជា field ក្នុង JSON របស់ server ទេ។

ផ្ទៀងបាន **63 model/class · 573 field ដែលប្រកាស**។ រកឈ្មោះ model ពីតារាង endpoint ខាងលើ រួចស្វែងរក heading ខាងក្រោម។ សោ និង token កត់តែឈ្មោះ field; គ្មានតម្លៃសោ។

### `core.base.entity.HttpEntity`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `message` | `String` | — |
| `result` | `T` | — |
| `status` | `boolean` | — |
| `statusCode` | `String` | — |

### `core.base.entity.InfoEntity`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `isFirstPage` | `boolean` | — |
| `isLastPage` | `boolean` | — |
| `list` | `List<T>` | — |
| `pageNum` | `int` | — |
| `pageSize` | `int` | — |
| `pages` | `int` | — |
| `total` | `int` | — |

### `core.base.entity.KHSortingLineHttpEntity`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `data` | `T` | — |
| `errorMsg` | `String` | — |
| `success` | `boolean` | — |

### `rpto.AccountBalanceRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `codAccount` | `double` | — |
| `ordinaryAccount` | `double` | — |

### `rpto.BagRecycleRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `bagCode` | `String` | — |
| `remark` | `String` | — |

### `rpto.BillCodeScanCheckKHRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `errorMessage` | `String` | — |
| `waybillResVo` | `WaybillInfoKH` | — |
| `whetherForce` | `boolean` | — |

### `rpto.BillCodeScanCheckRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `message` | `String` | — |
| `whetherForce` | `boolean` | — |

### `rpto.BillDestinationPRTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `countryCode` | `String` | — |
| `destinationCode` | `String` | — |
| `destinationName` | `String` | — |
| `destinationNameEn` | `String` | — |
| `destinationNameLang` | `String` | — |
| `destinationNo` | `String` | — |

### `rpto.BuildPkgFinishCount`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `finishCount` | `int` | — |

### `rpto.CarInfoRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `coDriverId` | `String` | — |
| `coDriverName` | `String` | — |
| `coMobileNum` | `String` | — |
| `countryCode` | `String` | — |
| `driverId` | `String` | — |
| `driverName` | `String` | — |
| `licensePlate` | `String` | — |
| `mobileNum` | `String` | — |
| `siteCode` | `String` | — |
| `siteName` | `String` | — |
| `status` | `Integer` | — |
| `vehicleBarcode` | `String` | — |
| `vehicleType` | `String` | — |

### `rpto.CheckForErrorBillWarehouseRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `billCode` | `String` | — |
| `retreatType` | `String` | — |

### `rpto.CityRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `code` | `String` | — |
| `name` | `String` | — |
| `nameEn` | `String` | — |
| `nameLang` | `String` | — |
| `select` | `boolean` | — |

### `rpto.CreatePaymentPRTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `orderCode` | `String` | — |
| `resultCode` | `String` | — |
| `url` | `String` | — |

### `rpto.DispatchBillInfoRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `cod` | `String` | — |
| `consigneeAddress` | `String` | — |
| `consigneeCity` | `String` | — |
| `consigneeCityDialect` | `String` | — |
| `consigneeCountry` | `String` | — |
| `consigneeDistrict` | `String` | — |
| `consigneeDistrictDialect` | `String` | — |
| `consigneeMobile` | `String` | — |
| `consigneeName` | `String` | — |
| `consigneeProvince` | `String` | — |
| `consigneeProvinceDialect` | `String` | — |
| `declareGoodsName` | `String` | — |
| `deliveryNo` | `String` | — |
| `deliveryType` | `String` | — |
| `deliveryTypeId` | `String` | — |
| `destinationSiteId` | `String` | — |
| `dod` | `String` | — |
| `expressType` | `String` | — |
| `expressTypeId` | `String` | — |
| `firstWayNo` | `String` | — |
| `freightFee` | `String` | — |
| `packageQty` | `String` | — |
| `packageType` | `String` | — |
| `payType` | `String` | — |
| `recSiteId` | `String` | — |
| `shipType` | `String` | — |
| `shipTypeId` | `String` | — |
| `shipperAddress` | `String` | — |
| `shipperAddressDialect` | `String` | — |
| `shipperCity` | `String` | — |
| `shipperCityDialect` | `String` | — |
| `shipperDistrict` | `String` | — |
| `shipperDistrictDialect` | `String` | — |
| `shipperMobile` | `String` | — |
| `shipperName` | `String` | — |
| `shipperProvince` | `String` | — |
| `shipperProvinceDialect` | `String` | — |
| `totalGoodsAmount` | `String` | — |
| `warehouseWeight` | `Double` | — |

### `rpto.DispatchListRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `isFirstPage` | `boolean` | — |
| `isLastPage` | `boolean` | — |
| `list` | `List<ExpressInfo>` | — |
| `pageNum` | `int` | — |
| `pageSize` | `int` | — |
| `pages` | `int` | — |
| `total` | `int` | — |

### `rpto.DispatchListRPTO.ExpressInfo`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `billCode` | `String` | — |
| `billInfoClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `billStatus` | `String` | — |
| `callPhoneClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `callProblemClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `callSignClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `callSmsClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `cod` | `String` | — |
| `consigneeAddress` | `String` | — |
| `consigneeAddressDistrict` | `String` | — |
| `consigneeMobile` | `String` | — |
| `consigneeName` | `String` | — |
| `deliveryType` | `String` | — |
| `deliveryTypeId` | `String` | — |
| `details` | `String` | — |
| `discountFee` | `BigDecimal` | — |
| `dispEmpDate` | `String` | — |
| `dispatchCount` | `byte` | — |
| `dod` | `String` | — |
| `goodsName` | `String` | — |
| `grossWeight` | `String` | — |
| `onAddressClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `onPayClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `onPhoneClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `registerTime` | `String` | — |
| `reminderNum` | `long` | — |
| `reminderStatus` | `String` | — |
| `shipperMobile` | `String` | — |

### `rpto.DispatchListVNRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `dispatchList` | `List<DispatchListRPTO.ExpressInfo>` | — |
| `problemList` | `List<DispatchListRPTO.ExpressInfo>` | — |

### `rpto.DispatchPayRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `codAll` | `String` | — |
| `currency` | `String` | — |
| `dodAll` | `String` | — |
| `paymentRecordVOList` | `List<PaymentRecord>` | — |
| `total` | `String` | — |

### `rpto.DispatchPayRPTO.PaymentRecord`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `billCode` | `String` | — |
| `billStatus` | `String` | — |
| `cod` | `String` | — |
| `dod` | `String` | — |
| `orderCode` | `String` | — |
| `requestAmount` | `String` | — |
| `requestTime` | `String` | — |
| `sendTime` | `String` | — |
| `status` | `String` | — |

### `rpto.EditResultRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `editResult` | `boolean` | — |

### `rpto.EmptyRPTO`

មិនប្រកាស field ផ្ទាល់; អានតាម parent។

### `rpto.ExpressCountRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `codCount` | `Long` | — |
| `codTotalMoney` | `BigDecimal` | — |
| `collect` | `Long` | — |
| `discountFeeTotalMoney` | `BigDecimal` | — |
| `dispatch` | `Long` | — |
| `dodCount` | `Long` | — |
| `dodTotalMoney` | `BigDecimal` | — |
| `receive` | `Long` | — |
| `signFor` | `Long` | — |

### `rpto.ExpressInfoRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `agentAmount` | `double` | — |
| `agentServiceCharge` | `double` | — |
| `billCode` | `String` | — |
| `chargeWeight` | `double` | — |
| `consigneeAddress` | `String` | — |
| `consigneeCity` | `String` | — |
| `consigneeCityDialect` | `String` | — |
| `consigneeDistrict` | `String` | — |
| `consigneeDistrictDialect` | `String` | — |
| `consigneeMobile` | `String` | — |
| `consigneeName` | `String` | — |
| `consigneeProvince` | `String` | — |
| `consigneeProvinceDialect` | `String` | — |
| `destination` | `String` | — |
| `discountFee` | `double` | — |
| `fcAmount` | `double` | — |
| `freightFee` | `double` | — |
| `insureFee` | `double` | — |
| `orderNo` | `String` | — |
| `packageCollection` | `String` | — |
| `packageType` | `String` | — |
| `payType` | `String` | — |
| `payTypeId` | `String` | — |
| `phone` | `String` | — |
| `recordingSiteCode` | `String` | — |
| `remark` | `String` | — |
| `remoteFee` | `double` | — |
| `shipperAddress` | `String` | — |
| `shipperCity` | `String` | — |
| `shipperDistrict` | `String` | — |
| `shipperMobile` | `String` | — |
| `shipperName` | `String` | — |
| `shipperProvince` | `String` | — |
| `totalFee` | `String` | — |
| `totalGoodsAmout` | `double` | — |

### `rpto.ExpressListRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `isFirstPage` | `boolean` | — |
| `isLastPage` | `boolean` | — |
| `list` | `List<ExpressInfo>` | — |
| `pageNum` | `int` | — |
| `pageSize` | `int` | — |
| `pages` | `int` | — |
| `total` | `int` | — |

### `rpto.ExpressListRPTO.ExpressInfo`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `billCode` | `String` | — |
| `callPhoneClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `consigneeAddress` | `String` | — |
| `expressCollectClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `expressPrintClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `hasPrint` | `boolean` | — |
| `hasSelect` | `boolean` | — |
| `onAbnormalClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `onAddressClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `onCopyPhone` | `View.OnClickListener` | callback UI · ក្នុង App |
| `onFailReceiveClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `onRejectReceiveClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `orderCreateDate` | `String` | — |
| `orderNo` | `String` | — |
| `problemReasonDesc` | `String` | — |
| `reminderStatus` | `String` | — |
| `selectExpressClick` | `View.OnClickListener` | callback UI · ក្នុង App |
| `shipperAddress` | `String` | — |
| `shipperName` | `String` | — |
| `shipperPhone` | `String` | — |

### `rpto.GetProblemInfoRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `billcode` | `String` | — |
| `describe` | `String` | — |
| `signTime` | `String` | — |

### `rpto.GetTrackInfoRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `classes` | `String` | — |
| `describe` | `String` | — |
| `num` | `String` | — |
| `scanTime` | `String` | — |
| `uploadTime` | `String` | — |
| `weight` | `String` | — |

### `rpto.KHPayInfoRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `amount` | `Double` | — |
| `applyTime` | `String` | — |
| `billCodeList` | `List<String>` | — |
| `expireTime` | `long` | — |
| `payInfoList` | `List<WaybillInfoKH>` | — |
| `payNo` | `String` | — |
| `payType` | `String` | — |
| `url` | `String` | — |

### `rpto.KHPayResult`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `billCodeList` | `List<String>` | — |
| `updateResult` | `boolean` | — |

### `rpto.KHPayStatus`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `amount` | `String` | — |
| `payNo` | `String` | — |
| `status` | `int` | — |

### `rpto.KHSortingLineBaseInfo`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `secretKey` | `String` | — |
| `time` | `long` | — |
| `timeZone` | `String` | — |
| `urlPrefix` | `String` | — |

### `rpto.KHSortingLineGridInfo`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `deviceNo` | `String` | — |
| `gridNor` | `String` | — |
| `nextSiteCode` | `String` | — |
| `packageCode` | `String` | — |
| `result` | `Boolean` | — |
| `resultMessage` | `String` | — |
| `status` | `String` | — |

### `rpto.KHSortingLineSimpleRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `result` | `boolean` | — |
| `resultMessage` | `String` | — |

### `rpto.LightBindRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `code` | `String` | — |
| `message` | `String` | — |

### `rpto.LoginInfoRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `accessToken` | `String` | — |
| `countryCode` | `String` | — |
| `currentTime` | `String` | — |
| `location` | `String` | — |
| `nickName` | `String` | — |
| `permissions` | `Set<String>` | — |
| `siteCode` | `String` | — |
| `siteName` | `String` | — |
| `token` | `String` | — |
| `userName` | `String` | — |

### `rpto.MapOrder`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `billCode` | `String` | — |
| `billStatus` | `String` | — |
| `city` | `String` | — |
| `cod` | `String` | — |
| `consigneeAddress` | `String` | — |
| `consigneeMobile` | `String` | — |
| `deliveryType` | `String` | — |
| `deliveryTypeId` | `String` | — |
| `discountFee` | `String` | — |
| `dispEmpId` | `String` | — |
| `dispEmpName` | `String` | — |
| `dispatchCount` | `String` | — |
| `district` | `String` | — |
| `dod` | `String` | — |
| `goodsName` | `String` | — |
| `grossWeight` | `String` | — |
| `isSearchOrder` | `boolean` | — |
| `lat` | `String` | — |
| `lng` | `String` | — |
| `name` | `String` | — |
| `orderCreateDate` | `String` | — |
| `orderNo` | `String` | — |
| `orderStatus` | `String` | — |
| `province` | `String` | — |
| `recEmpId` | `String` | — |
| `recEmpName` | `String` | — |
| `reminderNum` | `String` | — |
| `reminderStatus` | `String` | — |
| `shipperAddress` | `String` | — |
| `shipperMobile` | `String` | — |
| `type` | `String` | — |

### `rpto.MapOrderRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `assignList` | `List<MapOrder>` | — |
| `deliveryList` | `List<MapOrder>` | — |
| `pickupList` | `List<MapOrder>` | — |

### `rpto.MetaDataRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `code` | `String` | — |
| `countryCode` | `String` | — |
| `id` | `Long` | — |
| `modifyTime` | `String` | — |
| `nameCn` | `String` | — |
| `nameEn` | `String` | — |
| `nameLang` | `String` | — |
| `typeCode` | `String` | — |

### `rpto.PackageInfoRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `arriveScanTime` | `String` | — |
| `countryCode` | `String` | — |
| `destinationSiteCode` | `String` | — |
| `destinationSiteName` | `String` | — |
| `packageCode` | `String` | — |
| `packageType` | `int` | — |
| `sendSiteCode` | `String` | — |
| `status` | `int` | — |

### `rpto.QuerySignPicRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `aliasName` | `String` | — |
| `billCode` | `String` | — |
| `savePos` | `String` | — |

### `rpto.QueryTrackingRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `tracks` | `List<TrackingRPTO>` | — |

### `rpto.RecallInfoRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `billCode` | `String` | — |
| `consigneeAddress` | `String` | — |
| `consigneeMobile` | `String` | — |
| `countryCode` | `String` | — |
| `deliverySite` | `String` | — |
| `destinationCode` | `String` | — |
| `destinationNo` | `String` | — |
| `imageUrl1` | `String` | — |
| `imageUrl2` | `String` | — |
| `locationNo` | `String` | — |
| `problemWhStatus` | `int` | — |
| `registSiteCode` | `String` | — |
| `registTime` | `String` | — |
| `remark` | `String` | — |

### `rpto.RuleRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `modifyTime` | `String` | — |
| `regular` | `String` | — |
| `ruleCode` | `String` | — |
| `ruleName` | `String` | — |

### `rpto.ShopeeScanCompareCountRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `forecastQty` | `String` | — |
| `isDiff` | `boolean` | — |
| `overQty` | `String` | — |
| `scanQty` | `String` | — |
| `waitQty` | `String` | — |

### `rpto.SiteInfoRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `blCityWarehouse` | `int` | — |
| `blWarehouse` | `int` | — |
| `countryCode` | `String` | — |
| `defaultCurrencyCode` | `String` | — |
| `destinationCode` | `String` | — |
| `destinationName` | `String` | — |
| `destinationNameEn` | `String` | — |
| `destinationNameLang` | `String` | — |
| `destinationNo` | `String` | — |
| `id` | `Long` | — |
| `isCenter` | `boolean` | — |
| `modifyTime` | `String` | — |
| `provinceCode` | `String` | — |
| `select` | `boolean` | — |
| `siteCode` | `String` | — |
| `siteName` | `String` | — |
| `siteNameEn` | `String` | — |
| `siteNameLang` | `String` | — |
| `siteNatureCode` | `String` | — |
| `status` | `String` | — |
| `superiorFinanceCenterCode` | `String` | — |
| `superiorSiteCode` | `String` | — |
| `typeCode` | `String` | — |

### `rpto.SmsConfigRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `countryCode` | `String` | — |
| `dataSource` | `String` | — |
| `sendType` | `String` | — |
| `status` | `String` | — |
| `userName` | `String` | — |

### `rpto.SubOrderInfo`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `billCode` | `String` | — |
| `billStatus` | `int` | — |
| `orderNo` | `String` | — |
| `orderStatus` | `int` | — |
| `packageSeq` | `String` | — |

### `rpto.TimeZoneMetaDataRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `code` | `String` | — |
| `countryCode` | `String` | — |
| `id` | `Long` | — |
| `modifyTime` | `String` | — |
| `nameCn` | `String` | — |
| `nameEn` | `String` | — |
| `nameLang` | `String` | — |
| `typeCode` | `String` | — |

### `rpto.TrackingRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `action` | `String` | — |
| `actionName` | `String` | — |
| `carrier` | `String` | — |
| `country` | `String` | — |
| `customsCode` | `String` | — |
| `deliveryCode` | `String` | — |
| `deliveryContact` | `String` | — |
| `deliveryName` | `String` | — |
| `deliveryType` | `int` | — |
| `flightCode` | `String` | — |
| `id` | `int` | — |
| `mailNo` | `String` | — |
| `message` | `String` | — |
| `msgEng` | `String` | — |
| `msgLoc` | `String` | — |
| `place` | `String` | — |
| `preOrNext` | `String` | — |
| `preOrNextID` | `String` | — |
| `remark` | `String` | — |
| `siteCode` | `String` | — |
| `siteName` | `String` | — |
| `szAction` | `String` | — |
| `time` | `String` | — |
| `trackSource` | `String` | — |
| `weight` | `Double` | — |
| `zone` | `String` | — |

### `rpto.UploadResultRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `barScannerId` | `long` | — |
| `exceptionMessage` | `String` | — |
| `vehicleSignNo` | `String` | — |

### `rpto.UserInfoRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `employeeCode` | `String` | — |
| `employeeName` | `String` | — |
| `employeeNameEn` | `String` | — |
| `employeeNameLang` | `String` | — |
| `id` | `Long` | — |
| `modifyTime` | `String` | — |
| `status` | `String` | — |

### `rpto.VehicleInfoRPTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `licensePlate` | `String` | — |
| `siteCode` | `String` | — |
| `vehicleBarcode` | `String` | — |
| `vehicleType` | `String` | — |

### `rpto.WaitOutPackage`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `billCode` | `String` | — |
| `check` | `boolean` | — |
| `consigneeAddress` | `String` | — |
| `consigneeMobile` | `String` | — |
| `deliverySite` | `String` | — |
| `destinationNo` | `String` | — |
| `id` | `long` | — |
| `imageUrl1` | `String` | — |
| `imageUrl2` | `String` | — |
| `locationNo` | `String` | — |
| `problemWhStatus` | `String` | — |
| `remark` | `String` | — |

### `rpto.WaybillInfoKH`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `agentAmount` | `double` | — |
| `billCode` | `String` | — |
| `currencyCode` | `String` | — |
| `discountFee` | `double` | — |
| `fcAmount` | `double` | — |
| `orderNo` | `String` | — |
| `paidFee` | `double` | — |
| `payNo` | `String` | — |
| `paymentStatus` | `int` | — |
| `realPayFee` | `double` | — |

### `rqto.BillCodeList`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `billCode` | `String` | — |

### `rqto.CallLogInfoBean`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `date` | `String` | — |
| `duration` | `long` | — |
| `id` | `int` | — |
| `location` | `String` | — |
| `name` | `String` | — |
| `number` | `String` | — |
| `type` | `int` | — |

### `rqto.DispatchQueryInfoQTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `billCode` | `String` | — |
| `billStatus` | `String` | — |
| `consigneeCityCode` | `String` | — |
| `consigneeDistrictCode` | `String` | — |
| `consigneeMobile` | `String` | — |
| `consigneeName` | `String` | — |
| `consigneeProvinceCode` | `String` | — |
| `dispEmpDateFrom` | `String` | — |
| `dispEmpDateTo` | `String` | — |
| `isIssue` | `String` | — |
| `pageNum` | `int` | — |
| `pageSize` | `int` | — |
| `signSiteDateFrom` | `String` | — |
| `signSiteDateTo` | `String` | — |
| `status` | `int` | — |

### `rqto.DispatchQueryInfoQTO.WorkOrderStatus`

Parent ៖ `java.lang.Enum`។

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `ALL` | `WorkOrderStatus` | static · ក្នុង App |
| `DONE` | `WorkOrderStatus` | static · ក្នុង App |
| `ING` | `WorkOrderStatus` | static · ក្នុង App |
| `NOT` | `WorkOrderStatus` | static · ក្នុង App |

### `rqto.UploadDataRQTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `barScannerId` | `long` | — |
| `billCode` | `String` | — |
| `classCode` | `String` | — |
| `dataFrom` | `String` | — |
| `dataType` | `int` | — |
| `departure` | `String` | — |
| `destination` | `String` | — |
| `deviceDesc` | `String` | — |
| `dispatchOrSendManCode` | `String` | — |
| `goodsHigh` | `int` | — |
| `goodsLong` | `int` | — |
| `goodsTypeCode` | `String` | — |
| `goodsWidth` | `int` | — |
| `isLaPackage` | `boolean` | — |
| `licensePlateNo` | `String` | — |
| `listNo` | `String` | — |
| `notifySiteCode` | `String` | — |
| `notifySiteName` | `String` | — |
| `packageNo` | `String` | — |
| `preOrNextStationCode` | `String` | — |
| `previousSiteVehicleSignNos` | `List<String>` | — |
| `problemBillCode` | `String` | — |
| `problemReason` | `String` | — |
| `scanDate` | `String` | — |
| `scanTypeCode` | `String` | — |
| `signMan` | `String` | — |
| `transportationCode` | `String` | — |
| `vehicleNo` | `String` | — |
| `vehicleNumber` | `String` | — |
| `vehicleSignNo` | `List<String>` | — |
| `volumeWeight` | `double` | — |
| `weight` | `double` | — |
| `zone` | `String` | — |

### `rqto.UploadPaperReceiveBean`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `agentAmount` | `String` | — |
| `agentServiceCharge` | `String` | — |
| `billCode` | `String` | — |
| `deliveryTypeId` | `String` | — |
| `deliveryTypeIdDesc` | `String` | — |
| `dispSiteDesc` | `String` | — |
| `dispSiteId` | `String` | — |
| `expressTypeId` | `Integer` | — |
| `expressTypeIdDesc` | `String` | — |
| `freightFee` | `String` | — |
| `insureFee` | `String` | — |
| `insureTypeId` | `String` | — |
| `nextStationCode` | `String` | — |
| `nextStationName` | `String` | — |
| `payTypeId` | `String` | — |
| `payTypeIdDesc` | `String` | — |
| `prevSiteCode` | `String` | — |
| `receiverId` | `String` | — |
| `receiverIdDesc` | `String` | — |
| `scanTypeCode` | `int` | — |
| `shipTypeId` | `String` | — |
| `shipTypeIdDesc` | `String` | — |
| `weight` | `String` | — |

### `rqto.UploadPickUpGoodsBean`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `barScannerId` | `long` | — |
| `billCode` | `String` | — |
| `listNo` | `String` | — |
| `scanDate` | `String` | — |
| `scanTypeCode` | `String` | — |

### `rqto.UploadPutInWarehouseRQTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `barScannerId` | `long` | — |
| `billCode` | `String` | — |
| `countryCode` | `String` | — |
| `dataFrom` | `String` | — |
| `imageUrl1` | `String` | — |
| `imageUrl2` | `String` | — |
| `language` | `String` | — |
| `locationNo` | `String` | — |
| `scanDate` | `String` | — |
| `scanManCode` | `String` | — |
| `scanSiteCode` | `String` | — |

### `rqto.UploadVehiclePackageDataRQTO`

| Field | ប្រភេទក្នុង APK | សម្គាល់ |
|---|---|---|
| `bagCode` | `String` | — |
| `barScannerId` | `long` | — |
| `billCode` | `String` | — |
| `classCode` | `String` | — |
| `dataFrom` | `String` | — |
| `dataType` | `int` | — |
| `departure` | `String` | — |
| `destination` | `String` | — |
| `dispatchOrSendManCode` | `String` | — |
| `goodsHigh` | `int` | — |
| `goodsLong` | `int` | — |
| `goodsTypeCode` | `String` | — |
| `goodsWidth` | `int` | — |
| `licensePlateNo` | `String` | — |
| `listNo` | `String` | — |
| `notifySiteCode` | `String` | — |
| `notifySiteName` | `String` | — |
| `packageNo` | `String` | — |
| `preOrNextStationCode` | `String` | — |
| `previousSiteVehicleSignNos` | `List<String>` | — |
| `problemBillCode` | `String` | — |
| `problemReason` | `String` | — |
| `scanDate` | `String` | — |
| `scanTypeCode` | `String` | — |
| `signMan` | `String` | — |
| `transportationCode` | `String` | — |
| `vehicleNo` | `String` | — |
| `vehicleNumber` | `String` | — |
| `vehicleSignNo` | `String` | — |
| `volumeWeight` | `double` | — |
| `weight` | `double` | — |
| `zone` | `String` | — |

## Field JSON ដែលបង្កើតផ្ទាល់ក្នុង request

គន្លឹះខាងក្រោមមកពី `PDARequestImpl` តាម method; គន្លឹះខ្លះនៅក្នុង object ខាងក្នុង។ Method ដែល serialize DTO ទាំងមូល ត្រូវអាន field ក្នុង request model ខាងលើ; query parameter និង header ស្ថិតនៅតារាង endpoint។

| Method ក្នុង App | គន្លឹះ JSON ដែលបង្កើត |
|---|---|
| `addPackageProblemBill` | `billCode` · `packageCode` · `problemType` |
| `addScanInfoToAEGS` | `actionTime` · `billCode` |
| `addShopeeAbnormal` | `orderNo` · `problemReasonCode` · `problemReasonDesc` · `remark` |
| `applyPayOffline` | `billCodeList` |
| `applyPayOnline` | `billCodeList` · `methodCode` · `payChannelCode` · `productCode` |
| `bagPutIn` | `bagCodeList` · `bagType` |
| `bagRecycle` | `bagCodeList` · `recycleType` |
| `bindGrid` | `deviceNo` · `gridNo` · `packageCode` |
| `buildPackageFinish` | `bagCode` · `deviceNo` · `gridNo` · `nextSiteCode` · `packageCode` |
| `callLogUpload` | `actionDescs` · `billCode` · `callTime` · `connectStatus` · `connectTime` · `customerPhone` · `dataFrom` · `talkTime` |
| `cancelOutPackage` | `ids` · `modifier` |
| `cancelPay` | `billCode` |
| `checkForBuildPackage` | `billCode` · `packageNo` · `rfid` |
| `checkForErrorBillWarehouse` | `billCode` |
| `checkForPackageBill` | `billCode` · `packageNo` · `scanTypeCode` |
| `checkPutInWPermission` | `barScannerId` |
| `checkQrCode` | `billCode` |
| `checkRfidCodeByRecycle` | `bagCode` · `recycleType` |
| `checkRfidCodeForCreatePkg` | `bagCode` · `packageCode` |
| `checkRfidExist` | `bagCode` |
| `checkTrackInfo` | `mailNos` · `mailType` |
| `closeGrid` | `deviceNo` · `gridNo` |
| `confirmPayOffline` | `billCodeList` · `payType` |
| `createPayment` | `amount` · `billStatus` · `cod` · `custId` · `dataSource` · `dod` · `retry` · `sendTime` · `ztoOrder` |
| `delScanInfoToAEGS` | `billCodeList` · `id` |
| `deletePay` | `billCode` |
| `destroyOutPackage` | `billCode` · `countryCode` · `scanManCode` |
| `deviceInfoUpload` | `appVersion` · `deviceSn` · `deviceVersion` · `equipment` · `mac` · `manufacturer` · `processor` · `runningMemory` · `screen` · `source` · `storageMemory` |
| `getBaseCarInfo` | `currentPage` · `pageSize` |
| `getBaseSiteInfo` | `modifyTime` · `pageNum` · `pageSize` |
| `getBaseUserInfo` | `modifyTime` · `ownerSiteCode` · `pageNum` · `pageSize` |
| `getBillCodeByFirstWayNo` | `firstWayNo` |
| `getByDeliveryNo` | `deliveryNo` |
| `getCityList` | `level` · `parentCode` |
| `getDictionary` | `modifyTime` · `pageNum` · `pageSize` · `typeCodeList` |
| `getExpressList` | `billCode` · `dateFrom` · `dateTo` · `isPrint` · `orderStatus` · `pageNum` · `pageSize` · `shipperName` |
| `getExpressTypeList` | `consigneeCountryCode` |
| `getRule` | `modifyTime` · `pageNum` · `pageSize` |
| `getSignScanList` | `waybillList` |
| `getSmallPackageCodeList` | `ladingNo` |
| `hasUnload` | `packageCode` |
| `hasWaybill` | `billCode` |
| `khSignScanCheck` | `billCode` · `dataFrom` · `scanType` |
| `laBusinessCheck` | `billCode` · `billCodeLists` · `dataFrom` · `ignoreCodBacklog` · `ignoreDispSiteId` · `preOrNextStationCode` · `provinceCode` · `scanType` |
| `lightBinding` | `billCode` · `consigneeMobile` · `consigneeName` · `deliveryNo` · `firstNo` · `method` · `shipperName` · `shipperPhone` · `tagID` |
| `lightForcedBind` | `billCode` · `consigneeMobile` · `consigneeName` · `deliveryNo` · `firstNo` · `method` · `shipperName` · `shipperPhone` · `tagID` |
| `lightUnBind` | `billCodeList` · `method` |
| `login` | `deviceSn` · `equipment` · `password` · `timeZone` · `userName` · `verifyId` · `version` |
| `mapPickupDeliveryQuery` | `dateFrom` · `dateTo` |
| `mapQuery` | `billCode` · `orderNo` |
| `modifyPassWord` | `confirmNewPassword` · `newPassword` · `oldPassword` |
| `newBusinessCheck` | `billCode` · `billCodeLists` · `dataFrom` · `ignoreCodBacklog` · `ignoreDispSiteId` · `preOrNextStationCode` · `provinceCode` · `scanType` |
| `newBusinessCheckOffline` | `billCode` · `billCodeLists` · `dataFrom` · `ignoreCodBacklog` · `ignoreDispSiteId` · `preOrNextStationCode` · `provinceCode` · `scanType` |
| `openGrid` | `deviceNo` · `gridNo` |
| `parentBillInfoQuery` | `parentBillCode` |
| `putOutPackage` | `billCode` · `countryCode` · `id` · `scanManCode` · `scanSiteCode` |
| `queryAccountBalance` | `countryCode` · `siteCode` |
| `queryBillInfo` | `billCode` |
| `queryCollectExpressCount` | `billCollectionStatus` · `billStatus` · `dateFrom` · `dateTo` · `dispatchBillStatus` · `isSign` · `signBillStatus` |
| `queryDestination` | `destinationCode` |
| `queryDeviceConnectState` | `deviceNo` |
| `queryDispExpressCount` | `billCollectionStatus` · `billStatus` · `dateFrom` · `dateTo` · `dispatchBillStatus` · `isSign` · `signBillStatus` |
| `queryExpressCount` | `billCollectionStatus` · `billStatus` · `dateFrom` · `dateTo` · `dispatchBillStatus` · `isSign` · `signBillStatus` |
| `queryExpressInfo` | `orderNo` |
| `queryGridInfo` | `deviceNo` · `gridNo` |
| `queryPackage` | `packageCode` |
| `queryPayStatus` | `payNo` |
| `queryPaymentRecord` | `billCode` · `sendEndTime` · `sendStartTime` |
| `queryPreOrderByBagCode` | `billCode` |
| `queryPreOrderByBillCode` | `billCode` · `customerNo` |
| `querySequence` | `name` |
| `queryShopeeQty` | `dayEnd` · `dayStart` |
| `querySignListExpressCount` | `billCollectionStatus` · `billStatus` · `dateFrom` · `dateTo` · `dispatchBillStatus` · `isSign` · `signBillStatus` |
| `querySignPic` | `billCode` |
| `querySiteOwe` | `type` |
| `querySmsConfigStatus` | `countryCode` · `userName` |
| `queryTrackInfo` | `mailNos` · `mailType` |
| `queryVehicleInfo` | `vehicleBarcode` |
| `queryVehicleInfoByLicensePlate` | `licensePlate` |
| `queryVehicleNumber` | `vehicleSignNo` |
| `queryWaitOutPackageList` | `countryCode` · `scanSiteCode` |
| `queryWaybillDestination` | `siteCode` |
| `saveFailPaperOrder` | `action` · `billCode` · `optReason` · `optReasonCode` · `orderNo` |
| `savePrintSucc` | `billCode` |
| `searchRecallInfo` | `billCode` |
| `sendSiteCodeCheck` | `billCode` · `nextSite` |
| `shopeePackageScan` | `nextSiteCode` · `packageCode` |
| `subBusinessCheck` | `billCodeLists` · `dataFrom` · `provinceCode` · `scanType` |
| `unbindGrid` | `deviceNo` · `gridNo` |
| `updateAddress` | `billCodeList` · `consigneeAddress` · `orderNoList` · `shipperAddress` |
| `updateDispSite` | `billCode` · `businessRegion` · `dispSiteId` · `modifier` |
| `updateOrder` | `billCode` · `consigneeMobile` |
| `updateRecOrDispEmp` | `billCode` · `orderNo` |
| `updateSmsConfigStatus` | `countryCode` · `dataSource` · `sendType` · `status` · `userName` |
| `updateWeight` | `billCode` · `weight` |
| `uploadImage` | `billCode` · `fileName` · `picType` |

## Field បន្ថែមពីចម្លើយ server ពិត

ចម្លើយ server អាចមាន field លើស DTO ក្នុង APK។ នៅ `queryTrackInfo.result[]` មាន `mail` និង `tracks`; `mail` មិនប្រកាសក្នុង `QueryTrackingRPTO` របស់ APK នេះ។ Field ដែលឃើញពិត៖

| ទីតាំង | Field · ប្រភេទដែលបានផ្ទៀង |
|---|---|
| `billInfoQuery.result` | `dispSite: String` · `dispSiteId: String` (ឈ្មោះ និងកូដសាខាចែកចាយ; បន្ថែមលើ DTO) |
| `mail` | `busSource: String` · `clientId: String` · `customerNo: String` · `departureName: String` · `destinationName: String` · `endNo: String` · `isSign: number (0/1)` · `mailNo: String` · `mailSource: String` · `newStatusDesc: String` · `newStatusTime: String` · `startNo: String` |
| `mail` អាចទទេ | `consignee` · `cusDecType` (មិនទាន់ស្គាល់ប្រភេទពេលមានតម្លៃ) |
| `tracks[]` បន្ថែម | `countryCode: String` · `problemReason: String` · `signName: String` |
| `tracks[].id` | ចម្លើយពិតជា String ទោះ DTO ប្រកាស `int`; កុំយកវាជាចំនួនសម្រាប់គណនាលុយ |

`mail` និង `isSign` ជា metadata បន្ថែមដែលអាចអវត្តមាន; បញ្ជីមកដល់ផ្ទៀងអត្តសញ្ញាណតាម envelope (`mail.mailNo` · `mailNo`) ឬ `tracks[].mailNo` ហើយយកតែ track របស់ Barcode នោះ (track ដែលមាន `mailNo` ផ្សេង · ម៉ោង/action ខូច មិនជាភស្តុតាង)។ ខ្វះ metadata ចុះហត្ថលេខាមិនលុបភស្តុតាងមកដល់ទេ។

ភស្តុតាងមកដល់ ៖ `action="3"` + `siteCode` ត្រូវសាខា + `time` ក្នុងថ្ងៃដែលជ្រើស។ ភស្តុតាងចុះហត្ថលេខា ៖ `action="5"` ត្រូវ Barcode/សាខា ហើយមិននៅមុនការមកដល់ថ្មី (ដូចស្កេន `05` របស់ Cookie) · `mail.isSign=0` ផ្ទុយ ➜ មិនច្បាស់ (`null`) · ការពិនិត្យកញ្ចប់មួយ (`status=1`) នៅតម្រូវ `mail.isSign=1`។ ភស្តុតាងត្រឡប់ ៖ `action="-710"` (`退货中`) ត្រូវសាខា ហើយមិននៅមុនការមកដល់ចុងក្រោយ។

`tracks[].action` ដែលឃើញក្នុងចម្លើយពិត ៖ `10` 客户下单 · `1` 收件 · `2` 发件 (ដាក់ឡាន · `preOrNext` = សាខាបន្ទាប់) · `217` 出口清关完成 · `375` 清关完成 · `70` 建包扫描 · `3` 到件 · `4` 派件 · `5` 签收 · `-579` 电话联系不上 · `-585` 客户拒收 · `-710` 退货中 (ត្រឡប់ស្កេន)។ `-579` · `-585` ជាស្កេនកញ្ចប់មានបញ្ហា — កញ្ចប់នៅសាខា។ Field `shipTypeId="03"` ក្នុង Lookup ជាប្រភេទដឹកជញ្ជូន; វាមិនមែនស្កេនមកដល់ `03` ទេ។

## លេខប្រភេទស្កេនក្នុង APK (`ScanType`)

| ឈ្មោះក្នុង App | លេខ |
|---|---|
| `ALL` | `0` |
| `RECEIVE_SCAN` | `1` |
| `SEND_SCAN` | `2` |
| `ARRIVE_SCAN` | `3` |
| `DISPATCH_SCAN` | `4` |
| `SIGN_SCAN` | `5` |
| `KEPP_HOUSE_SCAN` | `6` |
| `PROBLEM_SCAN` | `29` |
| `OPEN_PKG_SCAN` | `7` |
| `CREATE_PKG_SCAN` | `70` |
| `SEND_PKG_SCAN` | `71` |
| `ARRIVE_PKG_SCAN` | `72` |
| `SEND_CAR_SCAN` | `75` |
| `UNLOAD_CAR_SCAN` | `76` |
| `RETURN_SCAN` | `-710` |
| `ARRIVE_SEND_SCAN` | `32` |
| `RECEIVE_SEND_SCAN` | `12` |
| `CALL_RECORDS` | `321` |
| `PICK_UP_GOODS_SCAN` | `9` |
| `CAR_ARRIVAL_SCAN` | `77` |
| `SIGN_PHOTO_UPLOAD_SCAN` | `123` |
| `SEND_PHOTO_UPLOAD_SCAN` | `456` |
| `PUT_IN_WAREHOUSE_SCAN` | `789` |
| `PUT_OUT_WAREHOUSE_SCAN` | `987` |
| `DESTROY_OUT_WAREHOUSE_SCAN` | `987789` |
| `ADD_PKG_SCAN` | `73` |
| `SUB_PKG_SCAN` | `74` |
