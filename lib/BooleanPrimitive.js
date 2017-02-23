'use strict'

const constants = require('./constants')

class BooleanPrimitive {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    return expected.isBooleanPrimitive === true && this.value === expected.value
      ? constants.DEEP_EQUAL
      : constants.UNEQUAL
  }
}
Object.defineProperty(BooleanPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(BooleanPrimitive.prototype, 'isBooleanPrimitive', { value: true })
module.exports = BooleanPrimitive
