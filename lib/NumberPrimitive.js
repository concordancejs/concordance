'use strict'

const constants = require('./constants')

class NumberPrimitive {
  constructor (value) {
    const notANumber = isNaN(value)
    this.notANumber = notANumber
    this.value = notANumber ? 0 : value
  }

  compare (expected) {
    return expected.isNumberPrimitive === true &&
      this.value === expected.value &&
      this.notANumber === expected.notANumber
        ? constants.DEEP_EQUAL
        : constants.UNEQUAL
  }
}
Object.defineProperty(NumberPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(NumberPrimitive.prototype, 'isNumberPrimitive', { value: true })
module.exports = NumberPrimitive
