'use strict'

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

class ErrorComplex extends Complex {
  createPropertyRecursor () {
    const recursor = super.createPropertyRecursor() || DEFAULT

    let emitName = shouldAdd(this.instance, 'name')
    let emitMessage = shouldAdd(this.instance, 'message')

    let length = recursor.length
    if (emitName) {
      length += 1
    }
    if (emitMessage) {
      length += 1
    }

    let done = false
    const next = () => {
      if (done) return null

      const property = recursor.next()
      if (property) return property

      if (emitName) {
        emitName = false
        const key = this.describeNested('name')
        const value = this.describeNested(this.instance.name)
        return new Property(key, value)
      }

      if (emitMessage) {
        emitMessage = false
        const key = this.describeNested('message')
        const value = this.describeNested(this.instance.message)
        return new Property(key, value)
      }

      done = true
      return null
    }

    return { length, next }
  }
}
module.exports = ErrorComplex
