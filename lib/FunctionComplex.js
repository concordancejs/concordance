'use strict'

const constants = require('./constants')
const Complex = require('./Complex')

const AMBIGUOUS = constants.AMBIGUOUS
const UNEQUAL = constants.UNEQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL

function shouldAdd (obj, key) {
  const desc = Object.getOwnPropertyDescriptor(obj, key)
  return !desc || !desc.enumerable
}

class FunctionComplex extends Complex {
  static fromValue (
    instance,
    tag, ctor, unwrapped, pointer,
    describeItem, describeMapEntry, describeProperty
  ) {
    const isArray = false
    const isIterable = false
    const isList = false

    return new this(
      tag, ctor, unwrapped, pointer, isArray, isIterable, isList,
      describeItem, describeMapEntry, describeProperty,
      instance
    )
  }

  createPropertyRecursor () {
    const recursor = super.createPropertyRecursor()

    const emitName = shouldAdd(this.instance, 'name') && typeof this.instance.name === 'string'
    if (!emitName) return recursor

    let size = recursor.size
    if (emitName) {
      size += 1
    }

    let done = false
    const next = () => {
      if (done) return null

      const property = recursor.next()
      if (property) return property

      done = true
      if (emitName) {
        return this.describeProperty('name', this.instance.name)
      }

      return null
    }

    return { size, next }
  }

  compare (expected) {
    if (expected.isFunctionComplex !== true) return UNEQUAL

    const result = super.compare(expected)
    // After deserialization functions may not be strictly equal. Calling code
    // needs to decide how to interpret the result.
    return result === SHALLOW_EQUAL
      ? AMBIGUOUS
      : result
  }
}
Object.defineProperty(FunctionComplex.prototype, 'isFunctionComplex', { value: true })
module.exports = FunctionComplex
