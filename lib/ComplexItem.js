'use strict'

const constants = require('./constants')

const SHALLOW_EQUAL = constants.SHALLOW_EQUAL
const UNEQUAL = constants.UNEQUAL

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
    if (expected.isComplexItem !== true || this.index !== expected.index) return UNEQUAL

    const result = this.value.compare(expected.value)
    if (result !== UNEQUAL) return result

    if (this.value.isPointer === true) {
      return expected.value.isPointer === true
        ? UNEQUAL
        : SHALLOW_EQUAL
    }

    return expected.value.isPointer === true
      ? SHALLOW_EQUAL
      : UNEQUAL
  }

  format () {
    let value
    return {
      buffer (formatted) {
        value = formatted
      },
      finalize () {
        return value + ','
      }
    }
  }
}
Object.defineProperty(ComplexItem.prototype, 'isComplexItem', { value: true })
module.exports = ComplexItem
