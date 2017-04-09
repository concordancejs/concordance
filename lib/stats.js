'use strict'

const constants = require('./constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

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
    return expected.isIterableStats === true && this.size === expected.size
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(IterableStats.prototype, 'isIterableStats', { value: true })
exports.IterableStats = IterableStats

class ListStats extends Stats {
  compare (expected) {
    return expected.isListStats === true && this.size === expected.size
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(ListStats.prototype, 'isListStats', { value: true })
exports.ListStats = ListStats

class PropertyStats extends Stats {
  compare (expected) {
    return expected.isPropertyStats === true && this.size === expected.size
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(PropertyStats.prototype, 'isPropertyStats', { value: true })
exports.PropertyStats = PropertyStats
