import { describe, expect, it } from 'vitest';
import { parseParcelNumber } from '../../../../ZoeW/src/domain/parcel-number';

describe('ការបកលេខពីទិន្នន័យកញ្ចប់', () => {
    const cases: Array<[string, unknown]> = [
        ['លេខវិជ្ជមាន', 2.5], ['សូន្យ', 0], ['សូន្យអវិជ្ជមាន', -0], ['លេខអវិជ្ជមាន', -12],
        ['លេខអក្សរ', ' 12.50 '], ['អក្សរតាមក្រោយ', '5.25garbage'], ['ទទេ', ''],
        ['null', null], ['undefined', undefined], ['NaN', NaN], ['Infinity', Infinity],
        ['boolean', false], ['array', [5]], ['object', {}], ['date', new Date(0)], ['bigint', 123n]
    ];

    it.each(cases)('%s រក្សាលទ្ធផល JavaScript ដើម', (_label, value) => {
        const baseline = Reflect.apply(parseFloat, undefined, [value]);
        expect(Object.is(parseParcelNumber(value), baseline)).toBe(true);
    });

    it('Symbol បដិសេធដូចការបកលេខដើម', () => {
        expect(() => Reflect.apply(parseFloat, undefined, [Symbol('money')])).toThrow(TypeError);
        expect(() => parseParcelNumber(Symbol('money'))).toThrow(TypeError);
    });

    it('Object ទទួល string hint ដូចការបកលេខដើម', () => {
        const hints: string[] = [];
        const value = { [Symbol.toPrimitive](hint: string) { hints.push(hint); return '3.75'; } };
        expect(Reflect.apply(parseFloat, undefined, [value])).toBe(3.75);
        expect(parseParcelNumber(value)).toBe(3.75);
        expect(hints).toEqual(['string', 'string']);
    });

    it('ការបរាជ័យពេលបម្លែង Object មិនបាត់', () => {
        const failure = new Error('conversion');
        const value = { toString() { throw failure; } };
        expect(() => Reflect.apply(parseFloat, undefined, [value])).toThrow(failure);
        expect(() => parseParcelNumber(value)).toThrow(failure);
    });
});
