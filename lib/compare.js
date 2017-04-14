'use strict'

const constants = require('./constants')
const describe = require('./describe')
const recursorUtils = require('./recursorUtils')
const shouldCompareDeep = require('./shouldCompareDeep')
const symbolProperties = require('./symbolProperties')
const Circular = require('./Circular')

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
  const circular = new Circular()
  const lhsLookup = new Map()
  const rhsLookup = new Map()

  const lhsStack = []
  const rhsStack = []
  let topIndex = -1

  do {
    let result

    if (lhs.isComplex === true) {
      lhsLookup.set(lhs.pointer, lhs)
    }
    if (rhs.isComplex === true) {
      rhsLookup.set(rhs.pointer, rhs)
    }

    if (lhs.isPointer === true) {
      if (rhs.isPointer === true && lhs.compare(rhs) === DEEP_EQUAL) {
        result = DEEP_EQUAL
      } else {
        lhs = lhsLookup.get(lhs.pointer)
      }
    }
    if (rhs.isPointer === true) {
      rhs = rhsLookup.get(rhs.pointer)
    }

    if (circular.has(lhs) && circular.has(rhs)) {
      result = UNEQUAL
    }

    if (!result) {
      result = lhs.compare(rhs)
    }

    if (result === UNEQUAL) return false
    if (result !== DEEP_EQUAL) {
      if (!shouldCompareDeep(result, lhs, rhs)) return false

      if (result === AMBIGUOUS && lhs.isProperty === true) {
        // Replace both sides by a pseudo-descriptor which collects symbol
        // properties instead.
        lhs = new symbolProperties.Collector(lhs, lhsStack[topIndex].recursor)
        rhs = new symbolProperties.Collector(rhs, rhsStack[topIndex].recursor)
        // Replace the current recursors so they can continue correctly after
        // the collectors have been "compared". This is necessary since the
        // collectors eat the first value after the last symbol property.
        lhsStack[topIndex].recursor = recursorUtils.unshift(lhsStack[topIndex].recursor, lhs.collectAll())
        rhsStack[topIndex].recursor = recursorUtils.unshift(rhsStack[topIndex].recursor, rhs.collectAll())
      }

      circular.add(lhs)
      circular.add(rhs)

      lhsStack.push({ origin: lhs, recursor: lhs.createRecursor() })
      rhsStack.push({ origin: rhs, recursor: rhs.createRecursor() })
      topIndex++
    }

    while (topIndex >= 0) {
      lhs = lhsStack[topIndex].recursor()
      rhs = rhsStack[topIndex].recursor()
      if (lhs !== null && rhs !== null) {
        break
      }

      if (lhs === null && rhs === null) {
        const lhsRecord = lhsStack.pop()
        const rhsRecord = rhsStack.pop()
        circular.delete(lhsRecord.origin)
        circular.delete(rhsRecord.origin)
        topIndex--
      } else {
        return false
      }
    }
  } while (topIndex >= 0)

  return true
}
exports.compareDescriptors = compareDescriptors

function compare (actual, expected, options) {
  if (Object.is(actual, expected)) return { pass: true }
  // Primitive values should be the same, so if actual or expected is primitive
  // then the values will never compare.
  if (shortcircuitPrimitive(actual) || shortcircuitPrimitive(expected)) return { pass: false }

  actual = describe(actual, options)
  expected = describe(expected, options)
  const pass = compareDescriptors(actual, expected)
  return { actual, expected, pass }
}
exports.compare = compare
