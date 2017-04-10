'use strict'

const constants = require('../constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function describeIterableRecursor (recursor) {
  return new IterableStats(recursor)
}
exports.describeIterableRecursor = describeIterableRecursor

function describeListRecursor (recursor) {
  return new ListStats(recursor)
}
exports.describeListRecursor = describeListRecursor

function describePropertyRecursor (recursor) {
  return new PropertyStats(recursor)
}
exports.describePropertyRecursor = describePropertyRecursor

const iterableTag = Symbol('IterableStats')
exports.iterableTag = iterableTag

const listTag = Symbol('ListStats')
exports.listTag = listTag

const propertyTag = Symbol('PropertyStats')
exports.propertyTag = propertyTag

class Stats {
  constructor (recursor) {
    this.size = recursor.size
  }

  format () {
    return this.size !== 0 ? '---' : null
  }
}
Object.defineProperty(Stats.prototype, 'isStats', { value: true })

class IterableStats extends Stats {
  compare (expected) {
    return expected.tag === iterableTag && this.size === expected.size
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(IterableStats.prototype, 'tag', { value: iterableTag })

class ListStats extends Stats {
  compare (expected) {
    return expected.tag === listTag && this.size === expected.size
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(ListStats.prototype, 'tag', { value: listTag })

class PropertyStats extends Stats {
  compare (expected) {
    return expected.tag === propertyTag && this.size === expected.size
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(PropertyStats.prototype, 'tag', { value: propertyTag })
