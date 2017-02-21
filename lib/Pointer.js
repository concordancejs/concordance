'use strict'

const constants = require('./constants')

class Pointer {
  constructor (pointer) {
    this.pointer = pointer
  }

  compare (expected) {
    return expected instanceof Pointer && this.pointer === expected.pointer
      ? constants.DEEP_EQUAL
      : constants.UNEQUAL
  }
}
module.exports = Pointer
