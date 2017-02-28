'use strict'

const constants = require('./constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

class NullPrimitive {
  compare (expected) {
    return expected.isNullPrimitive === true
      ? DEEP_EQUAL
      : UNEQUAL
  }

  format () {
    return 'null'
  }
}
Object.defineProperty(NullPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(NullPrimitive.prototype, 'isNullPrimitive', { value: true })
module.exports = NullPrimitive
