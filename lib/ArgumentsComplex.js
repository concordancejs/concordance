'use strict'

const constants = require('./constants')
const Complex = require('./Complex')

const AMBIGUOUS = constants.AMBIGUOUS
const UNEQUAL = constants.UNEQUAL

class ArgumentsComplex extends Complex {
  static fromValue (
    instance,
    tag, ctor, unwrapped, pointer,
    describeItem, describeProperty
  ) {
    // Treat as an array, to allow comparisons with arrays
    const isArray = true
    const isIterable = false
    const isList = true

    return new this(
      tag, ctor, unwrapped, pointer, isArray, isIterable, isList,
      describeItem, describeProperty,
      instance
    )
  }

  compare (expected) {
    if (expected.isComplex !== true) return UNEQUAL

    // Calling code may decide that Arguments can be compared to Arrays
    if (expected.tag === 'Array') return AMBIGUOUS

    return expected.isArgumentsComplex === true
      ? super.compare(expected)
      : UNEQUAL
  }
}
Object.defineProperty(ArgumentsComplex.prototype, 'isArgumentsComplex', { value: true })
module.exports = ArgumentsComplex
