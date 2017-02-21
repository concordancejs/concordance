'use strict'

const constants = require('./constants')

class Primitive {
  constructor (type, value) {
    this.type = type
    this.value = value
  }

  compare (expected) {
    if (!(expected instanceof Primitive)) return constants.UNEQUAL
    if (this.type !== expected.type) return constants.UNEQUAL
    if (this.value === expected.value) return constants.DEEP_EQUAL

    // After deserialization symbols may not be strictly equal. Calling code
    // needs to decide how to interpret the result.
    if (this.type === 'symbol') return constants.AMBIGUOUS

    return this.type === 'number' && isNaN(this.value) && isNaN(expected.value)
      ? constants.DEEP_EQUAL
      : constants.UNEQUAL
  }
}
module.exports = Primitive
