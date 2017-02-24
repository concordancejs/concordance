'use strict'

const constants = require('./constants')
const Complex = require('./Complex')

const AMBIGUOUS = constants.AMBIGUOUS
const UNEQUAL = constants.UNEQUAL

class ArgumentsComplex extends Complex {
  constructor (tag, ctor, unwrapped, pointer, describeItem, describeProperty, instance) {
    super(tag, ctor, unwrapped, pointer, describeItem, describeProperty, instance)

    // Treat as an array, to allow comparisons with arrays
    this.instanceIsArray = true
    this.iteratorInstance = null
  }

  compare (expected) {
    const result = super.compare(expected)

    // Calling code may decide that Arguments can be compared to Arrays
    if (result === UNEQUAL && expected.isComplex === true && expected.tag === 'Array') {
      return AMBIGUOUS
    }

    return result
  }
}
Object.defineProperty(ArgumentsComplex.prototype, 'isArgumentsComplex', { value: true })
module.exports = ArgumentsComplex
