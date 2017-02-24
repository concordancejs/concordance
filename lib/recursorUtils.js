'use strict'

function unshift (recursor, value) {
  return () => {
    if (value) {
      const next = value
      value = null
      return next
    }

    return recursor()
  }
}
exports.unshift = unshift
