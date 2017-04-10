'use strict'

const constants = require('../constants')
const object = require('./object')

const AMBIGUOUS = constants.AMBIGUOUS
const UNEQUAL = constants.UNEQUAL

function describe (props) {
  return new DescribedArgumentsValue(Object.assign({
    // Treat as an array, to allow comparisons with arrays
    isArray: true,
    isList: true
  }, props, { ctor: 'Arguments' }))
}
exports.describe = describe

const tag = Symbol('ArgumentsValue')
exports.tag = tag

class ArgumentsValue extends object.ObjectValue {
  compare (expected) {
    if (expected.isComplex !== true) return UNEQUAL

    // Calling code may decide that Arguments can be compared to Arrays
    if (expected.stringTag === 'Array') return AMBIGUOUS

    return super.compare(expected)
  }
}
Object.defineProperty(ArgumentsValue.prototype, 'tag', { value: tag })

const DescribedArgumentsValue = object.DescribedMixin(ArgumentsValue)
