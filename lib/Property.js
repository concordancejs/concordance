'use strict'

const constants = require('./constants')

class Property {
  constructor (key, value) {
    this.key = key
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
    if (expected.isProperty !== true) return constants.UNEQUAL
    if (this.key.compare(expected.key) !== constants.DEEP_EQUAL) return constants.UNEQUAL

    return this.value.compare(expected.value) === constants.DEEP_EQUAL
      ? constants.DEEP_EQUAL
      : constants.SHALLOW_EQUAL
  }
}
Object.defineProperty(Property.prototype, 'isProperty', { value: true })
module.exports = Property
