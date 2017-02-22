'use strict'

const constants = require('./constants')

class Item {
  constructor (index, value) {
    this.index = index
    this.value = value
  }

  createRecursor () {
    let done = false
    return () => {
      if (done) return null
      done = true
      return this.value
    }
  }

  compare (expected) {
    if (!expected.isItem) return constants.UNEQUAL
    if (this.index !== expected.index) return constants.UNEQUAL

    return this.value.compare(expected.value) === constants.DEEP_EQUAL
      ? constants.DEEP_EQUAL
      : constants.SHALLOW_EQUAL
  }
}
Object.defineProperty(Item.prototype, 'isItem', { value: true })
module.exports = Item
