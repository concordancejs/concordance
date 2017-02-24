'use strict'

const constants = require('./constants')

const AMBIGUOUS = constants.AMBIGUOUS
const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

class SymbolPrimitive {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    if (expected.isSymbolPrimitive !== true) return UNEQUAL
    return this.value === expected.value
      ? DEEP_EQUAL
      // After deserialization symbols may not be strictly equal. Calling code
      // needs to decide how to interpret the result.
      : AMBIGUOUS
  }
}
Object.defineProperty(SymbolPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(SymbolPrimitive.prototype, 'isSymbolPrimitive', { value: true })
module.exports = SymbolPrimitive
