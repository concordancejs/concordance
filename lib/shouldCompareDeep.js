'use strict'

const constants = require('./constants')

const AMBIGUOUS = constants.AMBIGUOUS
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL

function shouldCompareDeep (result, lhs, rhs) {
  if (result === SHALLOW_EQUAL) return true
  if (result !== AMBIGUOUS) return false

  return lhs.isArgumentsComplex ||
    // This is a property that has a symbol key, and the key comparison is
    // ambiguous, which could occur if the properties are compared in an
    // order-sensitive manner. This compare() must be order-insensitive for
    // object properties.
    (lhs.isProperty === true && lhs.key.isSymbolPrimitive === true && lhs.key.value !== rhs.key.value)
}
module.exports = shouldCompareDeep
