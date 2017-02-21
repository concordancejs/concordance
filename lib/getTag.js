'use strict'

const ts = Object.prototype.toString
const getTag = value => ts.call(value).slice(8, -1)

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

module.exports = getTag(Promise.resolve()) === 'Promise'
  ? getTag
  : value => {
    const tag = getTag(value)
    return tag === 'Object' && isPromise(value)
      ? 'Promise'
      : tag
  }
