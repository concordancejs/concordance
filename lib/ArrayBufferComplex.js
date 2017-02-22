'use strict'

const Complex = require('./Complex')
const Item = require('./Item')
const Property = require('./Property')

const DEFAULT = {
  length: 0,
  next () { return null }
}

class ArrayBufferComplex extends Complex {
  createPropertyRecursor () {
    const recursor = super.createPropertyRecursor() || DEFAULT
    const length = recursor.length + 1

    let done = false
    const next = () => {
      if (done) return null

      const property = recursor.next()
      if (property) return property

      done = true

      const key = this.describeNested('byteLength')
      const value = this.describeNested(this.instance.byteLength)
      return new Property(key, value)
    }

    return { length, next }
  }

  createIterableRecursor () {
    const array = new Uint8Array(this.instance)
    const length = array.length

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

      const value = this.describeNested(item)
      return new Item(index++, value)
    }

    return { length, next }
  }
}
module.exports = ArrayBufferComplex
