'use strict'

const constants = require('../constants')
const formatUtils = require('../formatUtils')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function describe () {
  return new UndefinedValue()
}
exports.describe = describe

exports.deserialize = describe

const tag = Symbol('UndefinedValue')
exports.tag = tag

class UndefinedValue {
  compare (expected) {
    return expected.tag === tag
      ? DEEP_EQUAL
      : UNEQUAL
  }

  format (theme) {
    return formatUtils.wrap(theme.undefined, 'undefined')
  }
}
Object.defineProperty(UndefinedValue.prototype, 'isPrimitive', { value: true })
Object.defineProperty(UndefinedValue.prototype, 'tag', { value: tag })
