'use strict'

const constants = require('../constants')
const recursorUtils = require('../recursorUtils')

const DEEP_EQUAL = constants.DEEP_EQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL
const UNEQUAL = constants.UNEQUAL

function describeComplex (index, value) {
  return new ComplexItem(index, value)
}
exports.describeComplex = describeComplex

function deserializeComplex (index, recursor) {
  const value = recursor()
  return new ComplexItem(index, value)
}
exports.deserializeComplex = deserializeComplex

function describePrimitive (index, value) {
  return new PrimitiveItem(index, value)
}
exports.describePrimitive = describePrimitive

function deserializePrimitive (state) {
  const index = state[0]
  const value = state[1]
  return new PrimitiveItem(index, value)
}
exports.deserializePrimitive = deserializePrimitive

const complexTag = Symbol('ComplexItem')
exports.complexTag = complexTag

const primitiveTag = Symbol('PrimitiveItem')
exports.primitiveTag = primitiveTag

class ComplexItem {
  constructor (index, value) {
    this.index = index
    this.value = value
  }

  createRecursor () {
    return recursorUtils.singleValue(this.value)
  }

  compare (expected) {
    if (expected.tag !== complexTag || this.index !== expected.index) return UNEQUAL

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
    let value
    return {
      buffer (gutter, formatted) {
        value = formatted
      },
      finalize () {
        return value + ','
      }
    }
  }

  compareDiff () {
    // Force the items to be compared through rebalancing.
    return UNEQUAL
  }

  rebalanceDiff (recursor, expectedRecursor, expected, compareComplexShape) {
    const actualFork = recursorUtils.fork(recursor)
    const expectedFork = recursorUtils.fork(expectedRecursor)
    const initialExpected = expected

    let expectedIsMissing = false
    while (!expectedIsMissing && expected !== null && expected.isItem === true) {
      if (expected.tag === complexTag) {
        expectedIsMissing = compareComplexShape(this.value, expected.value) !== UNEQUAL
      }

      expected = expectedFork.shared()
    }

    let actualIsExtraneous = false
    if (initialExpected.tag === complexTag) {
      let actual = this
      while (!actualIsExtraneous && actual !== null && actual.isItem === true) {
        if (actual.tag === complexTag) {
          actualIsExtraneous = compareComplexShape(actual.value, initialExpected.value) !== UNEQUAL
        }

        actual = actualFork.shared()
      }
    } else if (initialExpected.tag === primitiveTag) {
      let actual = this
      while (!actualIsExtraneous && actual !== null && actual.isItem === true) {
        if (actual.tag === primitiveTag) {
          actualIsExtraneous = initialExpected.value.compare(actual.value) === DEEP_EQUAL
        }

        actual = actualFork.shared()
      }
    }

    if (actualIsExtraneous && !expectedIsMissing) {
      return {
        actualIsExtraneous: true,
        recursor: actualFork.recursor,
        expectedRecursor: recursorUtils.map(
          recursorUtils.unshift(expectedFork.recursor, initialExpected),
          next => {
            if (next.isItem !== true) return next

            next.index++
            return next
          })
      }
    }

    if (expectedIsMissing && !actualIsExtraneous) {
      return {
        expectedIsMissing: true,
        recursor: recursorUtils.map(
          recursorUtils.unshift(actualFork.recursor, this),
          next => {
            if (next.isItem !== true) return next

            next.index++
            return next
          }),
        expectedRecursor: expectedFork.recursor
      }
    }

    const isDeeplyInequal = this.tag === complexTag && initialExpected.tag === complexTag
    return {
      isDeeplyInequal,
      isSimplyInequal: !isDeeplyInequal,
      recursor: actualFork.recursor,
      expectedRecursor: expectedFork.recursor
    }
  }

  serialize () {
    return this.index
  }
}
Object.defineProperty(ComplexItem.prototype, 'isItem', { value: true })
Object.defineProperty(ComplexItem.prototype, 'tag', { value: complexTag })

class PrimitiveItem {
  constructor (index, value) {
    this.index = index
    this.value = value
  }

  compare (expected) {
    return expected.tag === primitiveTag && this.index === expected.index
      ? this.value.compare(expected.value)
      : UNEQUAL
  }

  format (gutter, indent, innerIndent) {
    return this.value.format(gutter, indent, innerIndent) + ','
  }

  rebalanceDiff (recursor, expectedRecursor, expected) {
    const expectedFork = recursorUtils.fork(expectedRecursor)
    const initialExpected = expected

    do {
      if (expected === null || expected.isItem !== true) {
        return {
          actualIsExtraneous: true,
          recursor,
          expectedRecursor: recursorUtils.map(
            recursorUtils.unshift(expectedFork.recursor, initialExpected),
            next => {
              if (next.isItem !== true) return next

              next.index++
              return next
            })
        }
      }

      if (this.value.compare(expected.value) === DEEP_EQUAL) {
        return {
          expectedIsMissing: true,
          recursor: recursorUtils.map(
            recursorUtils.unshift(recursor, this),
            next => {
              if (next.isItem !== true) return next

              next.index++
              return next
            }),
          expectedRecursor: expectedFork.recursor
        }
      }

      expected = expectedFork.shared()
    } while (true)
  }

  serialize () {
    return [this.index, this.value]
  }
}
Object.defineProperty(PrimitiveItem.prototype, 'isItem', { value: true })
Object.defineProperty(PrimitiveItem.prototype, 'tag', { value: primitiveTag })
