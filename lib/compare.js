'use strict'

const constants = require('./constants')
const describe = require('./describe')

function shortcircuitPrimitive (value) {
  if (value === null || value === undefined || value === true || value === false) return true

  const type = typeof value
  if (type === 'string' || type === 'symbol') return true
  // Don't shortcircuit NaN values
  if (type === 'number') return !isNaN(value)

  return false
}

function shouldCompareDeep (result, lhs) {
  return result === constants.SHALLOW_EQUAL ||
    result === constants.AMBIGUOUS && lhs.isArgumentsComplex
}

function compare (actual, expected) {
  if (actual === expected) return true
  // Primitive values should be the same, so if actual or expected is primitive
  // then the values will never compare.
  if (shortcircuitPrimitive(actual) || shortcircuitPrimitive(expected)) return false

  const lhsLookup = new Map()
  const rhsLookup = new Map()

  const lhsStack = []
  const rhsStack = []
  let topIndex = -1

  let lhs = describe(actual)
  let rhs = describe(expected)

  do {
    let result

    if (lhs.isComplex) {
      lhsLookup.set(lhs.pointer, lhs)
    }
    if (rhs.isComplex) {
      rhsLookup.set(rhs.pointer, rhs)
    }

    if (lhs.isPointer) {
      if (rhs.isPointer && lhs.compare(rhs) === constants.DEEP_EQUAL) {
        result = constants.DEEP_EQUAL
      } else {
        lhs = lhsLookup.get(lhs.pointer)
      }
    }
    if (rhs.isPointer) {
      rhs = rhsLookup.get(rhs.pointer)
    }

    if (!result) {
      result = lhs.compare(rhs)
    }

    if (result === constants.UNEQUAL) return false
    if (result !== constants.DEEP_EQUAL) {
      if (!shouldCompareDeep(result, lhs)) return false

      lhsStack.push(lhs.createRecursor())
      rhsStack.push(rhs.createRecursor())
      topIndex++
    }

    while (topIndex >= 0) {
      lhs = lhsStack[topIndex]()
      rhs = rhsStack[topIndex]()
      if (lhs !== null && rhs !== null) {
        break
      }

      if (lhs === null && rhs === null) {
        lhsStack.pop()
        rhsStack.pop()
        topIndex--
      } else {
        return false
      }
    }
  } while (topIndex >= 0)

  return true
}
module.exports = compare
