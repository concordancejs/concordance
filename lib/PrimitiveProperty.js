'use strict'

const constants = require('./constants')
const Property = require('./Property')

const AMBIGUOUS = constants.AMBIGUOUS
const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

class PrimitiveProperty extends Property {
  constructor (key, value) {
    super(key)
    this.value = value
  }

  compare (expected) {
    if (expected.isProperty !== true) return UNEQUAL

    // Always compare keys if both sides are properties. This way compare()
    // and diff() can detect symbol keys and switch to their sorted-comparison
    // logic.
    const keyResult = this.key.compare(expected.key)
    if (keyResult === AMBIGUOUS || keyResult === UNEQUAL) return keyResult

    return expected.isPrimitiveProperty !== true
      ? UNEQUAL
      : this.value.compare(expected.value)
  }

  format (gutter, indent, innerIndent) {
    return `${this.key.formatAsKey()}: ${this.value.format(gutter, indent, innerIndent)},`
  }

  formatDiff (expected, gutters, indent) {
    // Verify a diff can be formatted
    if (expected.isPrimitiveProperty !== true) return null
    if (!this.value.formatDiff) return null
    if (this.key.compare(expected.key) !== DEEP_EQUAL) return null

    const valueDiff = this.value.formatDiff(expected.value, gutters, indent)
    if (!valueDiff) return null

    const key = this.key.formatAsKey() // Assume keys are formatted into a single line
    valueDiff[0].formatted = `${key}: ${valueDiff[0].formatted}`
    valueDiff[1].formatted = `${key}: ${valueDiff[1].formatted},`
    return valueDiff
  }
}
Object.defineProperty(PrimitiveProperty.prototype, 'isPrimitiveProperty', { value: true })
module.exports = PrimitiveProperty
