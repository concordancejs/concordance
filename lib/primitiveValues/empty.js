'use strict'

const constants = require('../constants')
const formatUtils = require('../formatUtils')
const lineBuilder = require('../lineBuilder')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function describe () {
  return new EmptyValue()
}
exports.describe = describe

exports.deserialize = describe

const tag = Symbol('EmptyValue')
exports.tag = tag

class EmptyValue {
  compare (expected) {
    return expected.tag === tag
      ? DEEP_EQUAL
      : UNEQUAL
  }

  formatDeep (theme) {
    return lineBuilder.single(formatUtils.wrap(theme.empty, '<empty item>'))
  }
}
Object.defineProperty(EmptyValue.prototype, 'isPrimitive', { value: true })
Object.defineProperty(EmptyValue.prototype, 'tag', { value: tag })
