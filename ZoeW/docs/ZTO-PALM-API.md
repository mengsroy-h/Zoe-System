# កាតាឡុក API ZTO Palm

ឯកសារយោងសម្រាប់អភិវឌ្ឍ ZoeW ៖ endpoint ទាំងអស់ដែល App **ZTO Palm** ផ្លូវការហៅ (ដកពី APK ដែលម្ចាស់គម្រោងផ្តល់) —
method · path · field request · ប្រភេទ `result` · field response · screen ក្នុង App ដែលហៅវា។ របៀបកំណត់ និងប្រើ Login Palm ៖
[ZTO-PALM.md](ZTO-PALM.md)។

## ⛔ ច្បាប់មុនប្រើ endpoint ណាមួយ

- ZoeW ហៅតែ endpoint ដែល `netlify/functions/_shared/zto-palm.js` សរសេរច្បាស់ (`doLogin` · `billInfoQuery` · `queryDispatchList`) ។ endpoint ថ្មីចូលតែតាម
  PR ដែលមានអ្នកយាមធ្លាក់លើកូដមុនកែ ហើយផ្លូវលុយ (auto-close · ការរង់ចាំ ៨ ថ្ងៃ · ចំណូល) ត្រូវវាស់ជាមួយគណនីពិតជាមុន។
- ⛔ endpoint **សរសេរ** (save · upload · add · update · cancel · pay · scan · move · leave · bind …) បង្កើតការស្កេន ការចុះហត្ថលេខា
  ឬការបង់ប្រាក់ពិតក្នុង ZTO ➜ ZoeW មិនហៅវាឡើយ។ ប្រភេទ «អាន/សរសេរ» ក្នុងតារាងកំណត់តាមឈ្មោះ endpoint ➜ ផ្ទៀងកូដ App មុនប្រើ។
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
| `mailType` (`queryTrackInfo` · `checkTrackInfo`) | `1` | `mailNos` = លេខ Barcode |
| `status` (`ProblemTabFragment`) | `WorkOrderStatus` `ALL` · `NOT` · `ING` · `DONE` (ordinal ០–៣) | ស្ថានភាពការងារបញ្ហា |
| `pageSize` (`DispatchQueryInfoQTO`) | លំនាំដើម `20` | ចម្លើយមាន `pageNum` · `pages` · `total` · `isFirstPage` · `isLastPage` |

`billStatus` `5` = ចុះហត្ថលេខា ក៏ស្របនឹង Argus (`ZTO_SIGNED_VALUES`) ដែរ។

## ផែនទីមុខងារ ZoeW ➜ endpoint Palm

| មុខងារ ZoeW | Endpoint Palm | ស្ថានភាព |
|---|---|---|
| Lookup លេខទូរស័ព្ទ · COD · DOD ពេលស្កេន | `billInfoQuery` (`cod` · `dod` · `consigneeMobile`) | ប្រើរួច |
| ទាញបញ្ជីកញ្ចប់ពី ZTO (កញ្ចប់មកដល់ · ស្កេន `03`) | គ្មាន endpoint អានបញ្ជីស្កេនមកដល់ក្នុង App Palm (`queryTrackInfo` ម្តងមួយកញ្ចប់) | មិនប្រើ ៖ ប្រើបានតែរបៀប Cookie (`palm:no-arrival-list`) |
| បញ្ជីចុះហត្ថលេខា · បិទស្វ័យប្រវត្តិ · ការរង់ចាំ ៨ ថ្ងៃ | `queryDispatchList` `billStatus` `5` + `signSiteDate*` + ទំព័រ | ប្រើរួច (`?palm=1&list=1&signed=1` · `exact=1`) |
| ស្ថានភាពកញ្ចប់មួយ (`/detail` `ztoClosed`) | `queryDispatchList` + `billCode` · ឬ `queryTrackInfo` | មិនទាន់ប្រើ ៖ វាស់ចម្លើយពិតមុន (គ្មានរបារ «មិនទាន់ចុះហត្ថលេខា» ក្នុងរបៀប Palm) |
| រូបចុះហត្ថលេខា | `querySignPic` (`billCode`) | ជម្រើស |
| ផ្ទៀងចំនួន/ទឹកប្រាក់ប្រចាំថ្ងៃ | `querySignListExpressCount` · `queryDispExpressCount` | ជម្រើស |

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
