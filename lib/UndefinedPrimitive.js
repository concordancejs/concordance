'use strict'

const constants = require('./constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

class UndefinedPrimitive {
  compare (expected) {
    return expected.isUndefinedPrimitive === true
      ? DEEP_EQUAL
      : UNEQUAL
  }

  format () {
    return 'undefined'
  }
}
Object.defineProperty(UndefinedPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(UndefinedPrimitive.prototype, 'isUndefinedPrimitive', { value: true })
module.exports = UndefinedPrimitive
