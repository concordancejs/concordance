'use strict'

const constants = require('./constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

class Pointer {
  constructor (pointer) {
    this.pointer = pointer
  }

  compare (expected) {
    return expected.isPointer === true && this.pointer === expected.pointer
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(Pointer.prototype, 'isPointer', { value: true })
module.exports = Pointer
