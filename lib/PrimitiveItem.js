'use strict'

const UNEQUAL = require('./constants').UNEQUAL

class PrimitiveItem {
  constructor (index, value) {
    this.index = index
    this.value = value
  }

  compare (expected) {
    return expected.isPrimitiveItem === true && this.index === expected.index
      ? this.value.compare(expected.value)
      : UNEQUAL
  }
}
Object.defineProperty(PrimitiveItem.prototype, 'isPrimitiveItem', { value: true })
module.exports = PrimitiveItem
