'use strict'

const constants = require('./constants')
const Complex = require('./Complex')

const UNEQUAL = constants.UNEQUAL

const DEFAULT = {
  size: 0,
  next () { return null }
}

class ArrayBufferComplex extends Complex {
  createPropertyRecursor () {
    const recursor = super.createPropertyRecursor() || DEFAULT
    const size = recursor.size + 1

    let done = false
    const next = () => {
      if (done) return null

      const property = recursor.next()
      if (property) return property

      done = true

      return this.describeProperty('byteLength', this.instance.byteLength)
    }

    return { size, next }
  }

  createIterableRecursor () {
    const array = new Uint8Array(this.instance)
    const size = array.length

    let index = 0
    let iterator
    let done = false
    const next = () => {
      if (done) return null

      if (!iterator) {
        iterator = array[Symbol.iterator]()
      }

      const current = iterator.next()
      if (current.done) {
        done = true
      }

      const item = current.value
      if (done && item === undefined) return null

      return this.describeItem(index++, item)
    }

    return { size, next }
  }

  compare (expected) {
    return expected.isArrayBufferComplex !== true
      ? UNEQUAL
      : super.compare(expected)
  }
}
Object.defineProperty(ArrayBufferComplex.prototype, 'isArrayBufferComplex', { value: true })
module.exports = ArrayBufferComplex
