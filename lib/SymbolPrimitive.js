'use strict'

const constants = require('./constants')

class SymbolPrimitive {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    if (expected.isSymbolPrimitive !== true) return constants.UNEQUAL
    return this.value === expected.value
      ? constants.DEEP_EQUAL
      // After deserialization symbols may not be strictly equal. Calling code
      // needs to decide how to interpret the result.
      : constants.AMBIGUOUS
  }
}
Object.defineProperty(SymbolPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(SymbolPrimitive.prototype, 'isSymbolPrimitive', { value: true })
module.exports = SymbolPrimitive
