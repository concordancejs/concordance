'use strict'

const constants = require('./constants')
const Complex = require('./Complex')
const Property = require('./Property')

const DEFAULT = {
  length: 0,
  next () { return null }
}

function shouldAdd (obj, key) {
  const desc = Object.getOwnPropertyDescriptor(obj, key)
  return !desc || !desc.enumerable
}

class FunctionComplex extends Complex {
  createPropertyRecursor () {
    const recursor = super.createPropertyRecursor() || DEFAULT

    const emitName = shouldAdd(this.instance, 'name') && typeof this.instance.name === 'string'

    if (!emitName && recursor === DEFAULT) return null

    let length = recursor.length
    if (emitName) {
      length += 1
    }

    let done = false
    const next = () => {
      if (done) return null

      const property = recursor.next()
      if (property) return property

      done = true
      if (emitName) {
        const key = this.describeNested('name')
        const value = this.describeNested(this.instance.name)
        return new Property(key, value)
      }

      return null
    }

    return { length, next }
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
