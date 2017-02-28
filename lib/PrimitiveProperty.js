'use strict'

const constants = require('./constants')

const AMBIGUOUS = constants.AMBIGUOUS
const UNEQUAL = constants.UNEQUAL

class PrimitiveProperty {
  constructor (key, value) {
    this.key = key
    this.value = value
  }

  compare (expected) {
    if (expected.isProperty !== true) return UNEQUAL

    // Always compare keys if both sides are properties. This way compare()
    // can detect symbol keys and switch to their sorted-comparison logic.
    const keyResult = this.key.compare(expected.key)
    if (keyResult === AMBIGUOUS || keyResult === UNEQUAL) return keyResult

    return expected.isPrimitiveProperty !== true
      ? UNEQUAL
      : this.value.compare(expected.value)
  }

  format (indent, innerIndent) {
    return `${this.key.formatAsKey()}: ${this.value.format(indent, innerIndent)},`
  }
}
Object.defineProperty(PrimitiveProperty.prototype, 'isProperty', { value: true })
Object.defineProperty(PrimitiveProperty.prototype, 'isPrimitiveProperty', { value: true })
module.exports = PrimitiveProperty
