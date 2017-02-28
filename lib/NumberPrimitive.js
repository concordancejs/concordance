'use strict'

const isNegativeZero = require('negative-zero')

const constants = require('./constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

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
        ? DEEP_EQUAL
        : UNEQUAL
  }

  format () {
    if (isNegativeZero(this.value)) return '-0'
    if (this.notANumber) return 'NaN'
    return String(this.value)
  }
}
Object.defineProperty(NumberPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(NumberPrimitive.prototype, 'isNumberPrimitive', { value: true })
module.exports = NumberPrimitive
