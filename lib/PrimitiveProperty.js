'use strict'

const constants = require('./constants')

class PrimitiveProperty {
  constructor (key, value) {
    this.key = key
    this.value = value
  }

  compare (expected) {
    // TODO: Allow ambiguous symbol key comparisons
    return expected.isPrimitiveProperty === true && this.key.compare(expected.key) === constants.DEEP_EQUAL
      ? this.value.compare(expected.value)
      : constants.UNEQUAL
  }
}
Object.defineProperty(PrimitiveProperty.prototype, 'isPrimitiveProperty', { value: true })
module.exports = PrimitiveProperty
