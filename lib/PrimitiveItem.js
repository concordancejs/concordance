'use strict'

const constants = require('./constants')
const recursorUtils = require('./recursorUtils')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

class PrimitiveItem {
  constructor (index, value) {
    this.index = index
    this.value = value
  }

  compare (expected) {
    return expected.isPrimitiveItem === true && this.index === expected.index
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
}
Object.defineProperty(PrimitiveItem.prototype, 'isItem', { value: true })
Object.defineProperty(PrimitiveItem.prototype, 'isPrimitiveItem', { value: true })
module.exports = PrimitiveItem
