'use strict'

const constants = require('./constants')

function shouldCompareDeep (result, lhs, rhs) {
  if (result === constants.SHALLOW_EQUAL) return true
  if (result !== constants.AMBIGUOUS) return false

  return lhs.isArgumentsComplex ||
    // This is a property that has a symbol key, and the key comparison is
    // ambiguous, which could occur if the properties are compared in an
    // order-sensitive manner. This compare() must be order-insensitive for
    // object properties.
    (lhs.isProperty && lhs.key.isSymbolPrimitive && lhs.key.value !== rhs.key.value)
}
module.exports = shouldCompareDeep
