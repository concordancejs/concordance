'use strict'

const constants = require('./constants')

class NullPrimitive {
  compare (expected) {
    return expected.isNullPrimitive === true
      ? constants.DEEP_EQUAL
      : constants.UNEQUAL
  }
}
Object.defineProperty(NullPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(NullPrimitive.prototype, 'isNullPrimitive', { value: true })
module.exports = NullPrimitive
