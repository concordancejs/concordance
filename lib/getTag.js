'use strict'

const ts = Object.prototype.toString
function getTag (value) {
  return ts.call(value).slice(8, -1)
}

const fts = Function.prototype.toString
const promiseCtorString = fts.call(Promise)
const isPromise = value => {
  if (!value.constructor) return false

  try {
    return fts.call(value.constructor) === promiseCtorString
  } catch (err) {
    return false
  }
}

if (getTag(Promise.resolve()) === 'Promise') {
  module.exports = getTag
} else {
  const getTagWithPromiseWorkaround = value => {
    const tag = getTag(value)
    return tag === 'Object' && isPromise(value)
      ? 'Promise'
      : tag
  }
  module.exports = getTagWithPromiseWorkaround
}
