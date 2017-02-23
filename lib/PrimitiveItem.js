'use strict'

const constants = require('./constants')

class PrimitiveItem {
  constructor (index, value) {
    this.index = index
    this.value = value
  }

  compare (expected) {
    return expected.isPrimitiveItem === true && this.index === expected.index
      ? this.value.compare(expected.value)
      : constants.UNEQUAL
  }
}
Object.defineProperty(PrimitiveItem.prototype, 'isPrimitiveItem', { value: true })
module.exports = PrimitiveItem
