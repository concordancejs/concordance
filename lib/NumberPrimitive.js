'use strict'

const constants = require('./constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

class NumberPrimitive {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    return expected.isNumberPrimitive === true && Object.is(this.value, expected.value)
      ? DEEP_EQUAL
      : UNEQUAL
  }

  format () {
    return Object.is(this.value, -0)
      ? '-0'
      : String(this.value)
  }
}
Object.defineProperty(NumberPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(NumberPrimitive.prototype, 'isNumberPrimitive', { value: true })
module.exports = NumberPrimitive
