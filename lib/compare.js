'use strict'

const constants = require('./constants')
const describe = require('./describe')
const recursorUtils = require('./recursorUtils')
const shouldCompareDeep = require('./shouldCompareDeep')
const symbolProperties = require('./symbolProperties')

const AMBIGUOUS = constants.AMBIGUOUS
const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function shortcircuitPrimitive (value) {
  if (value === null || value === undefined || value === true || value === false) return true

  const type = typeof value
  if (type === 'string' || type === 'symbol') return true
  // Don't shortcircuit NaN values
  if (type === 'number') return !isNaN(value)

  return false
}

function compareDescriptors (lhs, rhs) {
  const lhsLookup = new Map()
  const rhsLookup = new Map()

  const lhsStack = []
  const rhsStack = []
  let topIndex = -1

  do {
    let result

    if (lhs.isComplex) {
      lhsLookup.set(lhs.pointer, lhs)
    }
    if (rhs.isComplex) {
      rhsLookup.set(rhs.pointer, rhs)
    }

    if (lhs.isPointer) {
      if (rhs.isPointer && lhs.compare(rhs) === DEEP_EQUAL) {
        result = DEEP_EQUAL
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

    if (result === UNEQUAL) return false
    if (result !== DEEP_EQUAL) {
      if (!shouldCompareDeep(result, lhs, rhs)) return false

      if (result === AMBIGUOUS && lhs.isProperty) {
        // Replace both sides by a pseudo-descriptor which collects symbol
        // properties instead.
        lhs = new symbolProperties.Collector(lhs, lhsStack[topIndex])
        rhs = new symbolProperties.Collector(rhs, rhsStack[topIndex])
        // Replace the current recursors so they can continue correctly after
        // the collectors have been "compared". This is necessary since the
        // collectors eat the first value after the last symbol property.
        lhsStack[topIndex] = recursorUtils.unshift(lhsStack[topIndex], lhs.collectAll())
        rhsStack[topIndex] = recursorUtils.unshift(rhsStack[topIndex], rhs.collectAll())
      }

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
exports.compareDescriptors = compareDescriptors

function compare (actual, expected) {
  if (Object.is(actual, expected)) return { pass: true }
  // Primitive values should be the same, so if actual or expected is primitive
  // then the values will never compare.
  if (shortcircuitPrimitive(actual) || shortcircuitPrimitive(expected)) return { pass: false }

  actual = describe(actual)
  expected = describe(expected)
  const pass = compareDescriptors(actual, expected)
  return { actual, expected, pass }
}
exports.compare = compare
