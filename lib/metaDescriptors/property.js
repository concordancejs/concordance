'use strict'

const constants = require('../constants')
const recursorUtils = require('../recursorUtils')
const symbolPrimitive = require('../primitiveValues/symbol').tag

const AMBIGUOUS = constants.AMBIGUOUS
const DEEP_EQUAL = constants.DEEP_EQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL
const UNEQUAL = constants.UNEQUAL

function describeComplex (key, value) {
  return new ComplexProperty(key, value)
}
exports.describeComplex = describeComplex

function deserializeComplex (key, recursor) {
  const value = recursor()
  return new ComplexProperty(key, value)
}
exports.deserializeComplex = deserializeComplex

function describePrimitive (key, value) {
  return new PrimitiveProperty(key, value)
}
exports.describePrimitive = describePrimitive

function deserializePrimitive (state) {
  const key = state[0]
  const value = state[1]
  return new PrimitiveProperty(key, value)
}
exports.deserializePrimitive = deserializePrimitive

const complexTag = Symbol('ComplexProperty')
exports.complexTag = complexTag

const primitiveTag = Symbol('PrimitiveProperty')
exports.primitiveTag = primitiveTag

class Property {
  constructor (key) {
    this.key = key
  }

  compareKeys (expected) {
    const result = this.key.compare(expected.key)
    // Return AMBIGUOUS if symbol keys are unequal. It's likely that properties
    // are compared in order of declaration, which is not the desired strategy.
    // Returning AMBIGUOUS allows compare() and diff() to recognize this
    // situation and sort the symbol properties before comparing them.
    return result === UNEQUAL && this.key.tag === symbolPrimitive && expected.key.tag === symbolPrimitive
      ? AMBIGUOUS
      : result
  }

  rebalanceDiff (recursor, expectedRecursor, expected) {
    const fork = recursorUtils.fork(expectedRecursor)
    const initialExpected = expected

    do {
      if (expected === null || expected.isProperty !== true) {
        return {
          actualIsExtraneous: true,
          recursor,
          expectedRecursor: recursorUtils.unshift(fork.recursor, initialExpected)
        }
      } else if (this.key.compare(expected.key) === DEEP_EQUAL) {
        if (expected === initialExpected) {
          return null
        } else {
          return {
            expectedIsMissing: true,
            recursor: recursorUtils.unshift(recursor, this),
            expectedRecursor: fork.recursor
          }
        }
      }

      expected = fork.shared()
    } while (true)
  }
}
Object.defineProperty(Property.prototype, 'isProperty', { value: true })

class ComplexProperty extends Property {
  constructor (key, value) {
    super(key)
    this.value = value
  }

  createRecursor () {
    return recursorUtils.singleValue(this.value)
  }

  compare (expected) {
    if (expected.isProperty !== true) return UNEQUAL

    const keyResult = this.compareKeys(expected)
    if (keyResult !== DEEP_EQUAL) return keyResult

    if (this.tag !== expected.tag) return UNEQUAL

    const result = this.value.compare(expected.value)
    if (result !== UNEQUAL) return result

    if (this.value.isPointer === true) {
      return expected.value.isPointer === true
        ? UNEQUAL
        : SHALLOW_EQUAL
    }

    return expected.value.isPointer === true
      ? SHALLOW_EQUAL
      : UNEQUAL
  }

  format () {
    let value = '…'
    return {
      buffer (gutter, formatted) {
        value = formatted
      },
      finalize: () => {
        return `${this.key.formatAsKey()}: ${value},`
      }
    }
  }

  serialize () {
    return this.key
  }
}
Object.defineProperty(ComplexProperty.prototype, 'tag', { value: complexTag })

class PrimitiveProperty extends Property {
  constructor (key, value) {
    super(key)
    this.value = value
  }

  compare (expected) {
    if (expected.isProperty !== true) return UNEQUAL

    const keyResult = this.compareKeys(expected)
    if (keyResult !== DEEP_EQUAL) return keyResult

    return this.tag !== expected.tag
      ? UNEQUAL
      : this.value.compare(expected.value)
  }

  format (gutter, indent, innerIndent) {
    return `${this.key.formatAsKey()}: ${this.value.format(gutter, indent, innerIndent)},`
  }

  formatDiff (expected, gutters, indent) {
    // Verify a diff can be formatted
    if (this.tag !== expected.tag) return null
    if (!this.value.formatDiff) return null
    if (this.key.compare(expected.key) !== DEEP_EQUAL) return null

    const valueDiff = this.value.formatDiff(expected.value, gutters, indent)
    if (!valueDiff) return null

    const key = this.key.formatAsKey() // Assume keys are formatted into a single line
    valueDiff[0].formatted = `${key}: ${valueDiff[0].formatted}`
    valueDiff[1].formatted = `${key}: ${valueDiff[1].formatted},`
    return valueDiff
  }

  serialize () {
    return [this.key, this.value]
  }
}
Object.defineProperty(PrimitiveProperty.prototype, 'tag', { value: primitiveTag })
