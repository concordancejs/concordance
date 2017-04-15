'use strict'

const constants = require('../constants')
const formatUtils = require('../formatUtils')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function describe () {
  return new GlobalValue()
}
exports.describe = describe

exports.deserialize = describe

const tag = Symbol('GlobalValue')
exports.tag = tag

class GlobalValue {
  compare (expected) {
    return this.tag === expected.tag
      ? DEEP_EQUAL
      : UNEQUAL
  }

  format (theme) {
    return formatUtils.wrap(theme.global, 'Global') + ' ' + formatUtils.wrap(theme.object, '')
  }
}
Object.defineProperty(GlobalValue.prototype, 'isComplex', { value: true })
Object.defineProperty(GlobalValue.prototype, 'tag', { value: tag })
