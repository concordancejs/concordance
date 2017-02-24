'use strict'

function getObjectKeys (obj, excludeListItemAccessors) {
  const keys = []

  const length = excludeListItemAccessors ? obj.length : 0

  // Sort property names, they should never be order-sensitive
  const nameCandidates = Object.getOwnPropertyNames(obj).sort()
  // Comparators should verify symbols in an order-insensitive manner if
  // possible.
  const symbolCandidates = Object.getOwnPropertySymbols(obj)

  for (let i = 0; i < nameCandidates.length; i++) {
    const name = nameCandidates[i]

    let accept = true
    if (excludeListItemAccessors) {
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
