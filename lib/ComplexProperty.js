'use strict'

const constants = require('./constants')
const Property = require('./Property')

const AMBIGUOUS = constants.AMBIGUOUS
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL
const UNEQUAL = constants.UNEQUAL

class ComplexProperty extends Property {
  constructor (key, value) {
    super(key)
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
    if (expected.isProperty !== true) return UNEQUAL

    // Always compare keys if both sides are properties. This way compare()
    // and diff() can detect symbol keys and switch to their sorted-comparison
    // logic.
    const keyResult = this.key.compare(expected.key)
    if (keyResult === AMBIGUOUS || keyResult === UNEQUAL) return keyResult

    if (expected.isComplexProperty !== true) return UNEQUAL

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
    let value = '…'
    return {
      buffer (gutter, formatted) {
        value = formatted
      },
      finalize: () => {
        return `${this.key.formatAsKey()}: ${value},`
      }
    }
  }
}
Object.defineProperty(ComplexProperty.prototype, 'isComplexProperty', { value: true })
module.exports = ComplexProperty
