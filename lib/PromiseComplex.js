'use strict'

const constants = require('./constants')
const Complex = require('./Complex')

const AMBIGUOUS = constants.AMBIGUOUS
const UNEQUAL = constants.UNEQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL

class PromiseComplex extends Complex {
  compare (expected) {
    if (expected.isPromiseComplex !== true) return UNEQUAL

    const result = super.compare(expected)
    // After deserialization promises may not be strictly equal. Calling code
    // needs to decide how to interpret the result.
    return result === SHALLOW_EQUAL
      ? AMBIGUOUS
      : result
  }
}
Object.defineProperty(PromiseComplex.prototype, 'isPromiseComplex', { value: true })
module.exports = PromiseComplex
