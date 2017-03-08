'use strict'

const constants = require('./constants')
const recursorUtils = require('./recursorUtils')

const DEEP_EQUAL = constants.DEEP_EQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL
const UNEQUAL = constants.UNEQUAL

class ComplexItem {
  constructor (index, value) {
    this.index = index
    this.value = value
  }

  createRecursor () {
    let done = false
    return () => {
      if (done) return null
      done = true
      return this.value
    }
  }

  compare (expected) {
    if (expected.isComplexItem !== true || this.index !== expected.index) return UNEQUAL

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
      if (expected.isComplexItem === true) {
        expectedIsMissing = compareComplexShape(this.value, expected.value) !== UNEQUAL
      }

      expected = expectedFork.shared()
    }

    let actualIsExtraneous = false
    if (initialExpected.isComplexItem === true) {
      let actual = this
      while (!actualIsExtraneous && actual !== null && actual.isItem === true) {
        if (actual.isComplexItem === true) {
          actualIsExtraneous = compareComplexShape(actual.value, initialExpected.value) !== UNEQUAL
        }

        actual = actualFork.shared()
      }
    } else if (initialExpected.isPrimitiveItem === true) {
      let actual = this
      while (!actualIsExtraneous && actual !== null && actual.isItem === true) {
        if (actual.isPrimitiveItem === true) {
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

    const isDeeplyInequal = this.isComplexItem && initialExpected.isComplexItem
    return {
      isDeeplyInequal,
      isSimplyInequal: !isDeeplyInequal,
      recursor: actualFork.recursor,
      expectedRecursor: expectedFork.recursor
    }
  }
}
Object.defineProperty(ComplexItem.prototype, 'isItem', { value: true })
Object.defineProperty(ComplexItem.prototype, 'isComplexItem', { value: true })
module.exports = ComplexItem
