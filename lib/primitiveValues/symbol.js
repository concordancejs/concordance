'use strict'

const wellKnownSymbols = require('well-known-symbols')

const constants = require('../constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function describe (value) {
  let stringCompare = null

  const key = Symbol.keyFor(value)
  if (key !== undefined) {
    stringCompare = key
  } else if (wellKnownSymbols.isWellKnown(value)) {
    stringCompare = wellKnownSymbols.getLabel(value)
  }

  return new SymbolValue({
    stringCompare,
    value
  })
}
exports.describe = describe

const tag = Symbol('SymbolValue')
exports.tag = tag

class SymbolValue {
  constructor (props) {
    this.stringCompare = props.stringCompare
    this.value = props.value
  }

  compare (expected) {
    if (expected.tag !== tag) return UNEQUAL

    if (this.stringCompare !== null) {
      return this.stringCompare === expected.stringCompare
        ? DEEP_EQUAL
        : UNEQUAL
    }

    return this.value === expected.value
      ? DEEP_EQUAL
      : UNEQUAL
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
Object.defineProperty(SymbolValue.prototype, 'isPrimitive', { value: true })
Object.defineProperty(SymbolValue.prototype, 'tag', { value: tag })
