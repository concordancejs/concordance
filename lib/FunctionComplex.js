'use strict'

const constants = require('./constants')
const Complex = require('./Complex')

function shouldAdd (obj, key) {
  const desc = Object.getOwnPropertyDescriptor(obj, key)
  return !desc || !desc.enumerable
}

class FunctionComplex extends Complex {
  createPropertyRecursor () {
    const recursor = super.createPropertyRecursor()

    const emitName = shouldAdd(this.instance, 'name') && typeof this.instance.name === 'string'
    if (!emitName) return recursor

    let size = recursor.size
    if (emitName) {
      size += 1
    }

    let done = false
    const next = () => {
      if (done) return null

      const property = recursor.next()
      if (property) return property

      done = true
      if (emitName) {
        return this.describeProperty('name', this.instance.name)
      }

      return null
    }

    return { size, next }
  }

  compare (expected) {
    const result = super.compare(expected)

    // After deserialization functions may not be strictly equal. Calling code
    // needs to decide how to interpret the result.
    if (result === constants.SHALLOW_EQUAL) return constants.AMBIGUOUS

    return result
  }
}
module.exports = FunctionComplex
