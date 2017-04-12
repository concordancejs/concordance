'use strict'

const constants = require('../constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function describeIterableRecursor (recursor) {
  return new IterableStats(recursor.size)
}
exports.describeIterableRecursor = describeIterableRecursor

function describeListRecursor (recursor) {
  return new ListStats(recursor.size)
}
exports.describeListRecursor = describeListRecursor

function describePropertyRecursor (recursor) {
  return new PropertyStats(recursor.size)
}
exports.describePropertyRecursor = describePropertyRecursor

function deserializeIterableStats (size) {
  return new IterableStats(size)
}
exports.deserializeIterableStats = deserializeIterableStats

function deserializeListStats (size) {
  return new ListStats(size)
}
exports.deserializeListStats = deserializeListStats

function deserializePropertyStats (size) {
  return new PropertyStats(size)
}
exports.deserializePropertyStats = deserializePropertyStats

const iterableTag = Symbol('IterableStats')
exports.iterableTag = iterableTag

const listTag = Symbol('ListStats')
exports.listTag = listTag

const propertyTag = Symbol('PropertyStats')
exports.propertyTag = propertyTag

class Stats {
  constructor (size) {
    this.size = size
  }

  format () {
    return this.size !== 0 ? '---' : null
  }

  serialize () {
    return this.size
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
