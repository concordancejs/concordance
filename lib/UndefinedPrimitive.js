'use strict'

const constants = require('./constants')

class UndefinedPrimitive {
  compare (expected) {
    return expected.isUndefinedPrimitive === true
      ? constants.DEEP_EQUAL
      : constants.UNEQUAL
  }
}
Object.defineProperty(UndefinedPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(UndefinedPrimitive.prototype, 'isUndefinedPrimitive', { value: true })
module.exports = UndefinedPrimitive
