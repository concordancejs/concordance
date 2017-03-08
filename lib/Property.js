'use strict'

const constants = require('./constants')
const recursorUtils = require('./recursorUtils')

const DEEP_EQUAL = constants.DEEP_EQUAL

class Property {
  constructor (key) {
    this.key = key
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
module.exports = Property
