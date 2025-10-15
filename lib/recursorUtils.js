'use strict'

class Recursor {
  // Class fields were not added until ECMAScript 2022 and per MDN would require
  // Node.js version 12 or greater.
  // next = () => null
  // size = 0
  constructor (size, next, extraProps) {
    this.next = next
    this.size = size
    if (extraProps) Object.assign(this, extraProps)
  }
}
exports.Recursor = Recursor

const NOOP_RECURSOR = new (class NoopRecursor extends Recursor {})(0, () => null)
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
    },
  }
}
exports.fork = fork

function consumeDeep (recursor) {
  const stack = [recursor]
  while (stack.length > 0) {
    const subject = stack[stack.length - 1]()
    if (subject === null) {
      stack.pop()
      continue
    }

    if (typeof subject.createRecursor === 'function') {
      stack.push(subject.createRecursor())
    }
  }
}
exports.consumeDeep = consumeDeep

function map (recursor, mapFn) {
  return () => {
    const next = recursor()
    if (next === null) return null

    return mapFn(next)
  }
}
exports.map = map

class ReplayableState extends Recursor {}
class ReplayRecursor extends Recursor {}

function replay (state, create) {
  if (!state) {
    const recursor = create()
    if (recursor === NOOP_RECURSOR) {
      state = recursor
    } else {
      const stateProps = { buffer: [], done: false }
      state = new ReplayableState(recursor.size, recursor.next, stateProps)
    }
  }

  if (state === NOOP_RECURSOR) return { state, recursor: state }

  let done = false
  let index = 0
  const next = () => {
    if (done) return null

    let retval = state.buffer[index]
    if (retval === undefined) {
      retval = state.buffer[index] = state.next()
    }

    index++
    if (retval === null) {
      done = true
    }
    return retval
  }

  return { state, recursor: new ReplayRecursor(state.size, next) }
}
exports.replay = replay

function sequence (first, second) {
  let fromFirst = true
  return () => {
    if (fromFirst) {
      const next = first()
      if (next !== null) return next

      fromFirst = false
    }

    return second()
  }
}
exports.sequence = sequence

function singleValue (value) {
  let done = false
  return () => {
    if (done) return null

    done = true
    return value
  }
}
exports.singleValue = singleValue

function unshift (recursor, value) {
  return () => {
    if (value !== null) {
      const next = value
      value = null
      return next
    }

    return recursor()
  }
}
exports.unshift = unshift
