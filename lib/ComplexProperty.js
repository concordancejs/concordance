'use strict'

const constants = require('./constants')

class ComplexProperty {
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

    // Always compare keys if both sides are properties. This way compare()
    // can detect symbol keys and switch to their sorted-comparison logic.
    const keyResult = this.key.compare(expected.key)
    if (keyResult === constants.AMBIGUOUS || keyResult === constants.UNEQUAL) return keyResult

    if (expected.isComplexProperty !== true) return constants.UNEQUAL

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
Object.defineProperty(ComplexProperty.prototype, 'isProperty', { value: true })
Object.defineProperty(ComplexProperty.prototype, 'isComplexProperty', { value: true })
module.exports = ComplexProperty
