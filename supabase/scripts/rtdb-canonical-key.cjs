'use strict';

const code = "newData.child('code').val()";
const key = "newData.child('registryKey').val()";
const quote = value => JSON.stringify(value);
const whitespace = '\\u0009-\\u000D\\u0020\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF';
const encode = [37, 46, 35, 36, 91, 93, 47, ...Array.from({ length: 32 }, (_, index) => index).filter(index => index < 9 || index > 13), 127];
const escaped = encode.reduce((value, point) => value + '.replace(' + quote(String.fromCharCode(point)) + ', ' + quote('%' + point.toString(16).toUpperCase().padStart(2, '0')) + ')', code + '.toUpperCase()');
const decoded = [9, 10, 11, 12, 13].reduce((value, point) => value + '.replace(' + quote('%' + point.toString(16).toUpperCase().padStart(2, '0')) + ', ' + quote(String.fromCharCode(point)) + ')', key);
const NATIVE_F03_CANONICAL_GUARD = "(newData.child('code').isString() && newData.child('registryKey').isString() && " + key + '.length > 0'
    + ' && !' + key + '.matches(/^[\\s\\S]*[.#$\\[\\]\\/\\u0000-\\u001F\\u007F][\\s\\S]*$/)'
    + ' && !' + decoded + '.matches(/^[' + whitespace + '][\\s\\S]*$/)'
    + ' && !' + decoded + '.matches(/^[\\s\\S]*[' + whitespace + ']$/)'
    + ' && ' + escaped + '.replace(' + decoded + ', ".").matches(/^[' + whitespace + ']*[.][' + whitespace + ']*$/))';

module.exports = { NATIVE_F03_CANONICAL_GUARD };
