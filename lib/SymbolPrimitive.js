'use strict'

const wellKnownSymbols = require('well-known-symbols')

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

  format () {
    if (wellKnownSymbols.isWellKnown(this.value)) {
      return wellKnownSymbols.getLabel(this.value)
    }

    const key = Symbol.keyFor(this.value)
    if (key !== undefined) return `Symbol(${key})`

    // TODO: Properly indent symbols that stringify to multiple lines
    return this.value.toString()
  }

  formatAsKey () {
    return `[${this.format()}]`
  }
}
Object.defineProperty(SymbolPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(SymbolPrimitive.prototype, 'isSymbolPrimitive', { value: true })
module.exports = SymbolPrimitive
