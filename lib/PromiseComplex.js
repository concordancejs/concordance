'use strict'

const constants = require('./constants')
const Complex = require('./Complex')

const AMBIGUOUS = constants.AMBIGUOUS
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL

class PromiseComplex extends Complex {
  compare (expected) {
    const result = super.compare(expected)

    // After deserialization promises may not be strictly equal. Calling code
    // needs to decide how to interpret the result.
    if (result === SHALLOW_EQUAL) return AMBIGUOUS

    return result
  }
}
module.exports = PromiseComplex
