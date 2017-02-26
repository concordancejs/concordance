'use strict'

const constants = require('./constants')
const Complex = require('./Complex')

const UNEQUAL = constants.UNEQUAL

class MapComplex extends Complex {
  createIterableRecursor () {
    const size = this.instance.size

    let index = 0
    let entries
    const next = () => {
      if (index === size) return null

      if (!entries) {
        entries = Array.from(this.instance)
      }

      const entry = entries[index++]
      return this.describeMapEntry(entry[0], entry[1])
    }

    return { size, next }
  }

  compare (expected) {
    return expected.isMapComplex !== true || this.size !== expected.size
      ? UNEQUAL
      : super.compare(expected)
  }
}
Object.defineProperty(MapComplex.prototype, 'isMapComplex', { value: true })
module.exports = MapComplex
