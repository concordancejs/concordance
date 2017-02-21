'use strict'

const constants = require('./constants')

class Property {
  constructor (key, value) {
    this.key = key
    this.value = value
  }

  *[Symbol.iterator] () {
    yield this.value
  }

  compare (expected) {
    if (!(expected instanceof Property)) return constants.UNEQUAL
    if (this.key.compare(expected.key) !== constants.DEEP_EQUAL) return constants.UNEQUAL

    return this.value.compare(expected.value) === constants.DEEP_EQUAL
      ? constants.DEEP_EQUAL
      : constants.SHALLOW_EQUAL
  }
}
module.exports = Property
