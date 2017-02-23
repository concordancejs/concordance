'use strict'

const constants = require('./constants')

class StringPrimitive {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    return expected.isStringPrimitive === true && this.value === expected.value
      ? constants.DEEP_EQUAL
      : constants.UNEQUAL
  }
}
Object.defineProperty(StringPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(StringPrimitive.prototype, 'isStringPrimitive', { value: true })
module.exports = StringPrimitive
