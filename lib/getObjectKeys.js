'use strict'

const hasLength = require('./hasLength')

function getObjectKeys (obj) {
  const keys = []

  const length = hasLength(obj)
    ? obj.length
    : null

  // Sort property names, they should never be order-sensitive
  const nameCandidates = Object.getOwnPropertyNames(obj).sort()
  // Comparators should verify symbols in an order-insensitive manner if
  // possible.
  const symbolCandidates = Object.getOwnPropertySymbols(obj)

  for (let i = 0; i < nameCandidates.length; i++) {
    const name = nameCandidates[i]

    let accept = true
    // Reject list item accessors
    if (length !== null) {
      const index = Number(name)
      accept = (index % 1 !== 0) || index >= length
    }

    if (accept && Object.getOwnPropertyDescriptor(obj, name).enumerable) {
      keys.push(name)
    }
  }

  for (let i = 0; i < symbolCandidates.length; i++) {
    const symbol = symbolCandidates[i]
    if (Object.getOwnPropertyDescriptor(obj, symbol).enumerable) {
      keys.push(symbol)
    }
  }

  return keys
}
module.exports = getObjectKeys
