import {DEEP_EQUAL, UNEQUAL} from '../constants.js'
import * as formatUtils from '../formatUtils.js'
import lineBuilder from '../lineBuilder.js'

export function describe () {
  return new UndefinedValue()
}

export const deserialize = describe

export const tag = Symbol('UndefinedValue')

class UndefinedValue {
  compare (expected) {
    return expected.tag === tag
      ? DEEP_EQUAL
      : UNEQUAL
  }

  formatDeep (theme) {
    return lineBuilder.single(formatUtils.wrap(theme.undefined, 'undefined'))
  }

  isPrimitive = true

  tag = tag
}
