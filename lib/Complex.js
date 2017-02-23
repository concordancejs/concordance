'use strict'

const constants = require('./constants')
const getObjectKeys = require('./getObjectKeys')
const hasLength = require('./hasLength')
const Item = require('./Item')
const Property = require('./Property')

class ComplexStats {
  constructor (propertyLength, listLength, iterableLength) {
    this.propertyLength = propertyLength
    this.listLength = listLength
    this.iterableLength = iterableLength
  }

  compare (expected) {
    return expected.isComplexStats === true &&
      this.propertyLength === expected.propertyLength &&
      this.listLength === expected.listLength &&
      this.iterableLength === expected.iterableLength
        ? constants.DEEP_EQUAL
        : constants.UNEQUAL
  }
}
Object.defineProperty(ComplexStats.prototype, 'isComplexStats', { value: true })

class Complex {
  constructor (tag, ctor, unwrapped, pointer, describeNested, instance) {
    this.tag = tag
    this.ctor = ctor
    this.unwrapped = unwrapped
    this.pointer = pointer

    this.describeNested = describeNested
    this.instance = instance

    this.listInstance = hasLength(instance) ? instance : null
    this.iteratorInstance = !Array.isArray(instance) && instance[Symbol.iterator] ? instance : null
  }

  static fromValue (instance, tag, ctor, unwrapped, pointer, describeNested) {
    return new this(tag, ctor, unwrapped, pointer, describeNested, instance)
  }

  createPropertyRecursor () {
    const keys = getObjectKeys(this.instance)
    const length = keys.length
    if (length === 0) return null

    let index = 0
    const next = () => {
      if (index === length) return null

      const key = keys[index++]
      const primitive = this.describeNested(key)
      const value = this.describeNested(this.instance[key])
      return new Property(primitive, value)
    }

    return { length, next }
  }

  createListRecursor () {
    if (this.listInstance === null) return null

    const length = this.listInstance.length

    let index = 0
    const next = () => {
      if (index === length) return null

      const current = index
      index++
      const value = this.describeNested(this.listInstance[current])
      return new Item(current, value)
    }

    return { length, next }
  }

  createIterableRecursor () {
    if (this.iteratorInstance === null) return null

    const ignoreIfAccessor = this.listInstance !== null

    let index = 0
    let iterator
    let done = false
    const next = () => {
      if (done) return null

      if (!iterator) {
        iterator = this.iteratorInstance[Symbol.iterator]()
      }

      while (!done) {
        const current = iterator.next()
        if (current.done) {
          done = true
        }

        const item = current.value
        if (done && item === undefined) return null

        if (ignoreIfAccessor && this.listInstance[index] === item) {
          index++
        } else {
          const value = this.describeNested(item)
          return new Item(index++, value)
        }
      }
    }

    return { length: -1, next }
  }

  createRecursor () {
    let property = this.createPropertyRecursor()
    let list = this.createListRecursor()
    let iterable = this.createIterableRecursor()

    let sentStats = false
    return () => {
      if (!sentStats) {
        sentStats = true

        const propertyLength = property === null ? 0 : property.length
        const listLength = list === null ? 0 : list.length
        const iterableLength = iterable === null ? -1 : iterable.length
        return new ComplexStats(propertyLength, listLength, iterableLength)
      }

      if (property) {
        const retval = property.next()
        if (retval) {
          return retval
        } else {
          property = null
        }
      }

      if (list) {
        const retval = list.next()
        if (retval) {
          return retval
        } else {
          list = null
        }
      }

      if (iterable) {
        const retval = iterable.next()
        if (retval) {
          return retval
        } else {
          iterable = null
        }
      }

      return null
    }
  }

  compare (expected) {
    if (expected.isComplex !== true) return constants.UNEQUAL
    if (this.instance && expected.instance && this.instance === expected.instance) return constants.DEEP_EQUAL
    if (this.tag !== expected.tag || this.ctor !== expected.ctor) return constants.UNEQUAL
    if (this.unwrapped && expected.unwrapped && this.unwrapped.compare(expected.unwrapped) !== constants.DEEP_EQUAL) return constants.UNEQUAL
    return constants.SHALLOW_EQUAL
  }
}
Object.defineProperty(Complex.prototype, 'isComplex', { value: true })
module.exports = Complex
