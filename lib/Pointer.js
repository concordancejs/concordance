'use strict'

const constants = require('./constants')

class Pointer {
  constructor (pointer) {
    this.pointer = pointer
  }

  compare (expected) {
    return expected.isPointer && this.pointer === expected.pointer
      ? constants.DEEP_EQUAL
      : constants.UNEQUAL
  }
}
Object.defineProperty(Pointer.prototype, 'isPointer', { value: true })
module.exports = Pointer
