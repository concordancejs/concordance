'use strict'

const constants = require('./constants')
const Complex = require('./Complex')

class PromiseComplex extends Complex {
  compare (expected) {
    const result = super.compare(expected)

    // After deserialization promises may not be strictly equal. Calling code
    // needs to decide how to interpret the result.
    if (result === constants.SHALLOW_EQUAL) return constants.AMBIGUOUS

    return result
  }
}
module.exports = PromiseComplex
