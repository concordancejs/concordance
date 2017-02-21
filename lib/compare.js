'use strict'

const constants = require('./constants')
const describe = require('./describe')
const ArgumentsComplex = require('./ArgumentsComplex')
const Complex = require('./Complex')
const Pointer = require('./Pointer')

function compare (actual, expected) {
  if (actual === expected) return true

  const lhsLookup = new Map()
  const rhsLookup = new Map()
  const queue = [[describe(actual), describe(expected)]]
  while (queue.length > 0) {
    const pair = queue.shift()
    let lhs = pair[0]
    let rhs = pair[1]

    if (lhs instanceof Complex) {
      lhsLookup.set(lhs.pointer, lhs)
    }
    if (rhs instanceof Complex) {
      rhsLookup.set(rhs.pointer, rhs)
    }

    if (lhs instanceof Pointer) {
      if (rhs instanceof Pointer && lhs.compare(rhs) === constants.DEEP_EQUAL) continue

      lhs = lhsLookup.get(lhs.pointer)
    }
    if (rhs instanceof Pointer) {
      rhs = rhsLookup.get(rhs.pointer)
    }

    const result = lhs.compare(rhs)
    if (result === constants.UNEQUAL) return false
    if (result === constants.DEEP_EQUAL) continue

    const compareNested = result === constants.SHALLOW_EQUAL ||
      result === constants.AMBIGUOUS && lhs instanceof ArgumentsComplex
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
