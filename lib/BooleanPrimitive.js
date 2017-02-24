'use strict'

const constants = require('./constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

class BooleanPrimitive {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    return expected.isBooleanPrimitive === true && this.value === expected.value
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(BooleanPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(BooleanPrimitive.prototype, 'isBooleanPrimitive', { value: true })
module.exports = BooleanPrimitive
