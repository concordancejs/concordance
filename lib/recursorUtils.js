'use strict'

const NOOP_RECURSOR = {
  size: 0,
  next () { return null }
}
exports.NOOP_RECURSOR = NOOP_RECURSOR

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
