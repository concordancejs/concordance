'use strict'

const constants = require('../constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function describe (pointer) {
  return new Pointer(pointer)
}
exports.describe = describe

exports.deserialize = describe

const tag = Symbol('Pointer')
exports.tag = tag

class Pointer {
  constructor (pointer) {
    this.pointer = pointer
  }

  compare (expected) {
    return this.tag === expected.tag && this.pointer === expected.pointer
      ? DEEP_EQUAL
      : UNEQUAL
  }

  serialize () {
    return this.pointer
  }
}
Object.defineProperty(Pointer.prototype, 'isPointer', { value: true })
Object.defineProperty(Pointer.prototype, 'tag', { value: tag })
