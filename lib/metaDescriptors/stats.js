import { DEEP_EQUAL, UNEQUAL } from '../constants.js'
import lineBuilder from '../lineBuilder.js'
import * as recursorUtils from '../recursorUtils.js'

export function describeIterableRecursor (recursor) {
  return new IterableStats(recursor.size)
}

export function describeListRecursor (recursor) {
  return new ListStats(recursor.size)
}

export function describePropertyRecursor (recursor) {
  return new PropertyStats(recursor.size)
}

export function deserializeIterableStats (size) {
  return new IterableStats(size)
}

export function deserializeListStats (size) {
  return new ListStats(size)
}

export function deserializePropertyStats (size) {
  return new PropertyStats(size)
}

export const iterableTag = Symbol('IterableStats')

export const listTag = Symbol('ListStats')

export const propertyTag = Symbol('PropertyStats')

class Stats {
  constructor (size) {
    this.size = size
  }

  formatDeep (theme) {
    return lineBuilder.single(theme.stats.separator)
  }

  prepareDiff (expected, lhsRecursor, rhsRecursor, compareComplexShape) {
    if (expected.isStats !== true || expected.tag === this.tag) return null

    // Try to line up stats descriptors with the same tag.
    const rhsFork = recursorUtils.fork(rhsRecursor)
    const initialExpected = expected

    const missing = []
    while (expected !== null && this.tag !== expected.tag) {
      missing.push(expected)
      expected = rhsFork.shared()
    }

    if (expected !== null && missing.length > 0) {
      return {
        multipleAreMissing: true,
        descriptors: missing,
        lhsRecursor: recursorUtils.unshift(lhsRecursor, this),
        // Use original `rhsRecursor`, not `rhsFork`, since the consumed
        // descriptors are returned with the `missing` array.
        rhsRecursor: recursorUtils.unshift(rhsRecursor, expected),
      }
    }

    const lhsFork = recursorUtils.fork(lhsRecursor)
    let actual = this

    const extraneous = []
    while (actual !== null && actual.tag !== initialExpected.tag) {
      extraneous.push(actual)
      actual = lhsFork.shared()
    }

    if (actual !== null && extraneous.length > 0) {
      return {
        multipleAreExtraneous: true,
        descriptors: extraneous,
        // Use original `lhsRecursor`, not `lhsFork`, since the consumed
        // descriptors are returned with the `extraneous` array.
        lhsRecursor: recursorUtils.unshift(lhsRecursor, actual),
        rhsRecursor: recursorUtils.unshift(rhsFork.recursor, initialExpected),
      }
    }

    return null
  }

  serialize () {
    return this.size
  }

  isStats = true
}

class IterableStats extends Stats {
  compare (expected) {
    return expected.tag === iterableTag && this.size === expected.size
      ? DEEP_EQUAL
      : UNEQUAL
  }

  tag = iterableTag
}

class ListStats extends Stats {
  compare (expected) {
    return expected.tag === listTag && this.size === expected.size
      ? DEEP_EQUAL
      : UNEQUAL
  }

  tag = listTag
}

class PropertyStats extends Stats {
  compare (expected) {
    return expected.tag === propertyTag && this.size === expected.size
      ? DEEP_EQUAL
      : UNEQUAL
  }

  tag = propertyTag
}
