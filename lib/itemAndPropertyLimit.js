'use strict'

function normalizeLimit (value) {
  return Number.isInteger(value) && value >= 0
    ? value
    : Infinity
}

function normalize (options) {
  return {
    maxItems: normalizeLimit(options && options.maxItems),
    maxProperties: normalizeLimit(options && options.maxProperties),
  }
}

function wrap (shouldFormat, limits) {
  if (limits.maxItems === Infinity && limits.maxProperties === Infinity) {
    return shouldFormat
  }

  let itemCount = 0
  let propertyCount = 0

  return subject => {
    if (!shouldFormat(subject)) return false

    if (subject.isItem === true) {
      if (itemCount >= limits.maxItems) return false
      itemCount++
      return true
    }

    if (subject.isProperty === true) {
      if (propertyCount >= limits.maxProperties) return false
      propertyCount++
      return true
    }

    return true
  }
}

exports.normalize = normalize
exports.wrap = wrap
