'use strict'

const constants = require('./constants')

class ComplexItem {
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
    if (expected.isComplexItem !== true || this.index !== expected.index) return constants.UNEQUAL

    const result = this.value.compare(expected.value)
    if (result !== constants.UNEQUAL) return result

    if (this.value.isPointer === true) {
      return expected.value.isPointer === true
        ? constants.UNEQUAL
        : constants.SHALLOW_EQUAL
    }

    return expected.value.isPointer === true
      ? constants.SHALLOW_EQUAL
      : constants.UNEQUAL
  }
}
Object.defineProperty(ComplexItem.prototype, 'isComplexItem', { value: true })
module.exports = ComplexItem
