'use strict'

const constants = require('../constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function describe (value) {
  return new NumberValue(value)
}
exports.describe = describe

exports.deserialize = describe

const tag = Symbol('NumberValue')
exports.tag = tag

class NumberValue {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    return expected.tag === tag && Object.is(this.value, expected.value)
      ? DEEP_EQUAL
      : UNEQUAL
  }

  format () {
    return Object.is(this.value, -0)
      ? '-0'
      : String(this.value)
  }

  serialize () {
    return this.value
  }
}
Object.defineProperty(NumberValue.prototype, 'isPrimitive', { value: true })
Object.defineProperty(NumberValue.prototype, 'tag', { value: tag })
