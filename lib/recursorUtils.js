'use strict'

const NOOP_RECURSOR = {
  size: 0,
  next () { return null }
}
exports.NOOP_RECURSOR = NOOP_RECURSOR

function fork (recursor) {
  const buffer = []

  return {
    shared () {
      const next = recursor()
      if (next !== null) buffer.push(next)
      return next
    },

    recursor () {
      if (buffer.length > 0) return buffer.shift()
      return recursor()
    }
  }
}
exports.fork = fork

function map (recursor, mapFn) {
  return () => {
    const next = recursor()
    if (next === null) return null

    return mapFn(next)
  }
}
exports.map = map

function sequence (first, second) {
  let fromFirst = true
  return () => {
    if (fromFirst) {
      const next = first()
      if (next) return next

      fromFirst = false
    }

    return second()
  }
}
exports.sequence = sequence

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
