'use strict'

const Complex = require('./Complex')

function shouldAdd (obj, key) {
  const desc = Object.getOwnPropertyDescriptor(obj, key)
  return !desc || !desc.enumerable
}

class ErrorComplex extends Complex {
  createPropertyRecursor () {
    const recursor = super.createPropertyRecursor()

    let emitName = shouldAdd(this.instance, 'name')
    let emitMessage = shouldAdd(this.instance, 'message')

    let size = recursor.size
    if (emitName) {
      size += 1
    }
    if (emitMessage) {
      size += 1
    }

    let done = false
    const next = () => {
      if (done) return null

      const property = recursor.next()
      if (property) return property

      if (emitName) {
        emitName = false
        return this.describeProperty('name', this.instance.name)
      }

      if (emitMessage) {
        emitMessage = false
        return this.describeProperty('message', this.instance.message)
      }

      done = true
      return null
    }

    return { size, next }
  }
}
module.exports = ErrorComplex
