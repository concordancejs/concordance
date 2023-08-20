import { DEEP_EQUAL, UNEQUAL } from '../constants.js'
import * as formatUtils from '../formatUtils.js'
import lineBuilder from '../lineBuilder.js'

export function describe (value) {
  return new NumberValue(value)
}

export const deserialize = describe

export const tag = Symbol('NumberValue')

class NumberValue {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    return expected.tag === tag && Object.is(this.value, expected.value)
      ? DEEP_EQUAL
      : UNEQUAL
  }

  formatDeep (theme) {
    const string = Object.is(this.value, -0) ? '-0' : String(this.value)
    return lineBuilder.single(formatUtils.wrap(theme.number, string))
  }

  serialize () {
    return this.value
  }

  isPrimitive = true

  tag = tag
}
