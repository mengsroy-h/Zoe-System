'use strict';

const code = "newData.child('code').val()";
const key = "newData.child('registryKey').val()";
const quote = value => JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const regexWhitespace = [9, 10, 11, 12, 13, 8232, 8233];
const whitespace = String.fromCharCode(32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8239, 8287, 12288, 65279);
const regexInput = value => regexWhitespace.reduce((text, point) => text + '.replace(' + quote(String.fromCharCode(point)) + ', " ")', value);
const encode = [37, 46, 35, 36, 91, 93, 47, ...Array.from({ length: 32 }, (_, index) => index).filter(index => index < 9 || index > 13), 127];
const escaped = encode.reduce((value, point) => value + '.replace(' + quote(String.fromCharCode(point)) + ', ' + quote('%' + point.toString(16).toUpperCase().padStart(2, '0')) + ')', code + '.replace(' + quote('ᲊ') + ', ' + quote('Ᲊ') + ').toUpperCase()');
const decoded = [9, 10, 11, 12, 13].reduce((value, point) => value + '.replace(' + quote('%' + point.toString(16).toUpperCase().padStart(2, '0')) + ', ' + quote(String.fromCharCode(point)) + ')', key);
const NATIVE_F03_CANONICAL_GUARD = "(newData.child('code').isString() && newData.child('registryKey').isString() && " + key + '.length > 0'
    + ' && !' + key + '.matches(/^([^A]|A)*[.#$\\[\\]\\/' + String.fromCharCode(0) + '-' + String.fromCharCode(31, 127) + ']([^A]|A)*$/)'
    + ' && !' + regexInput(decoded) + '.matches(/^[' + whitespace + ']([^A]|A)*$/)'
    + ' && !' + regexInput(decoded) + '.matches(/^([^A]|A)*[' + whitespace + ']$/)'
    + ' && ' + regexInput(escaped + '.replace(' + decoded + ', ".")') + '.matches(/^[' + whitespace + ']*[.][' + whitespace + ']*$/))';

module.exports = { NATIVE_F03_CANONICAL_GUARD };
