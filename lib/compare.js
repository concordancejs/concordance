'use strict'

const constants = require('./constants')
const describe = require('./describe')

function compare (actual, expected) {
  if (actual === expected) return true

  const lhsLookup = new Map()
  const rhsLookup = new Map()
  const queue = [[describe(actual), describe(expected)]]
  while (queue.length > 0) {
    const pair = queue.shift()
    let lhs = pair[0]
    let rhs = pair[1]

    if (lhs.isComplex) {
      lhsLookup.set(lhs.pointer, lhs)
    }
    if (rhs.isComplex) {
      rhsLookup.set(rhs.pointer, rhs)
    }

    if (lhs.isPointer) {
      if (rhs.isPointer && lhs.compare(rhs) === constants.DEEP_EQUAL) continue

      lhs = lhsLookup.get(lhs.pointer)
    }
    if (rhs.isPointer) {
      rhs = rhsLookup.get(rhs.pointer)
    }

    const result = lhs.compare(rhs)
    if (result === constants.UNEQUAL) return false
    if (result === constants.DEEP_EQUAL) continue

    const compareNested = result === constants.SHALLOW_EQUAL ||
      result === constants.AMBIGUOUS && lhs.isArgumentsComplex
    if (!compareNested) return false

    const comparators = rhs[Symbol.iterator]()
    for (const comparable of lhs) {
      const step = comparators.next()
      if (step.done) return false

      queue.push([comparable, step.value])
    }

    if (!comparators.next().done) return false
  }

  return true
}
module.exports = compare
