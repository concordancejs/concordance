'use strict'

const hasLength = require('./hasLength')

function getObjectKeys (obj) {
  const length = hasLength(obj)
    ? obj.length
    : -1

  return Object.getOwnPropertyNames(obj)
    // Reject list item accessors
    .filter(key => !/^\d+$/.test(key) || key >= length)
    .sort() // Property names are never order-sensitive
    .concat(Object.getOwnPropertySymbols(obj)) // But symbols are
    .filter(key => {
      const desc = Object.getOwnPropertyDescriptor(obj, key)
      return desc.enumerable
    })
}
module.exports = getObjectKeys
