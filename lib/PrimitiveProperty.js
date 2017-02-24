'use strict'

const constants = require('./constants')

class PrimitiveProperty {
  constructor (key, value) {
    this.key = key
    this.value = value
  }

  compare (expected) {
    if (expected.isProperty !== true) return constants.UNEQUAL

    // Always compare keys if both sides are properties. This way compare()
    // can detect symbol keys and switch to their sorted-comparison logic.
    const keyResult = this.key.compare(expected.key)
    if (keyResult === constants.AMBIGUOUS || keyResult === constants.UNEQUAL) return keyResult

    return expected.isPrimitiveProperty !== true
      ? constants.UNEQUAL
      : this.value.compare(expected.value)
  }
}
Object.defineProperty(PrimitiveProperty.prototype, 'isProperty', { value: true })
Object.defineProperty(PrimitiveProperty.prototype, 'isPrimitiveProperty', { value: true })
module.exports = PrimitiveProperty
