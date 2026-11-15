import type { DeletedParcelRow, ParcelBarcode, ParcelRow, PickupTransition } from '../../../../ZoeW/src/domain/parcel';
import { canonicalBarcodeRegistryKey } from '../../../../ZoeW/src/domain/barcode-key';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends (1 & T) ? true : false;

export type ParcelMoneyIsOptional = Assert<undefined extends ParcelRow['cod'] ? true : false>;
export type BarcodeMoneyIsOptional = Assert<undefined extends ParcelBarcode['cod'] ? true : false>;
export type NullIsNotParcel = Assert<null extends ParcelRow ? false : true>;
export type NullIsNotBarcode = Assert<null extends ParcelBarcode ? false : true>;
export type NullIsNotMoney = Assert<null extends ParcelBarcode['cod'] ? false : true>;
export type MoneyIsNotAny = Assert<IsAny<ParcelBarcode['cod']> extends false ? true : false>;
export type BarcodeRejectsTextMoney = Assert<{ cod: string } extends ParcelBarcode ? false : true>;
export type BarcodeRejectsNumericCode = Assert<{ code: number } extends ParcelBarcode ? false : true>;
export type BarcodeRejectsTextClosed = Assert<{ isClosed: string } extends ParcelBarcode ? false : true>;
export type DeletedRejectsTextTimestamp = Assert<{ deletedAt: string } extends DeletedParcelRow ? false : true>;
export type TransitionRequiresIdentity = Assert<{ epoch: number } extends PickupTransition ? false : true>;

export const legacyParcel: ParcelRow = { id: 'legacy', barcode: 'OLD-1' };
export const legacyBarcode: ParcelBarcode = { code: 'OLD-1' };
export const modernParcel: ParcelRow = { id: 'row', phone: '012345678', barcodes: [{ code: 'ZT1', cod: 0, dod: 2.5, isClosed: false }] };
export const nullableCodeInput: unknown = null;
export const canonicalKey: string = canonicalBarcodeRegistryKey(nullableCodeInput);
