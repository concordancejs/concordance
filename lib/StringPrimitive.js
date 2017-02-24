'use strict'

const constants = require('./constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

class StringPrimitive {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    return expected.isStringPrimitive === true && this.value === expected.value
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(StringPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(StringPrimitive.prototype, 'isStringPrimitive', { value: true })
module.exports = StringPrimitive
