'use strict'

const constants = require('./constants')
const getObjectKeys = require('./getObjectKeys')
const hasLength = require('./hasLength')

class IterableStats {
  constructor (recursor) {
    this.size = recursor.length
  }

  compare (expected) {
    return expected.isIterableStats === true && this.size === expected.size
      ? constants.DEEP_EQUAL
      : constants.UNEQUAL
  }
}
Object.defineProperty(IterableStats.prototype, 'isIterableStats', { value: true })

class ListStats {
  constructor (recursor) {
    this.size = recursor.length
  }

  compare (expected) {
    return expected.isListStats === true && this.size === expected.size
      ? constants.DEEP_EQUAL
      : constants.UNEQUAL
  }
}
Object.defineProperty(ListStats.prototype, 'isListStats', { value: true })

class PropertyStats {
  constructor (recursor) {
    this.size = recursor.length
  }

  compare (expected) {
    return expected.isPropertyStats === true && this.size === expected.size
      ? constants.DEEP_EQUAL
      : constants.UNEQUAL
  }
}
Object.defineProperty(PropertyStats.prototype, 'isPropertyStats', { value: true })

const DEFAULT_RECURSOR = {
  length: 0,
  next () { return null }
}

class Complex {
  constructor (tag, ctor, unwrapped, pointer, describeItem, describeProperty, instance) {
    this.tag = tag
    this.ctor = ctor
    this.unwrapped = unwrapped
    this.pointer = pointer

    this.describeItem = describeItem
    this.describeProperty = describeProperty
    this.instance = instance

    this.instanceIsArray = Array.isArray(instance)
    this.listInstance = hasLength(instance) ? instance : null
    this.iteratorInstance = !this.instanceIsArray && instance[Symbol.iterator] ? instance : null
  }

  static fromValue (instance, tag, ctor, unwrapped, pointer, describeItem, describeProperty) {
    return new this(tag, ctor, unwrapped, pointer, describeItem, describeProperty, instance)
  }

  createPropertyRecursor () {
    const keys = getObjectKeys(this.instance)
    const length = keys.length
    if (length === 0) return DEFAULT_RECURSOR

    let index = 0
    const next = () => {
      if (index === length) return null

      const key = keys[index++]
      return this.describeProperty(key, this.instance[key])
    }

    return { length, next }
  }

  createListRecursor () {
    if (this.listInstance === null) return DEFAULT_RECURSOR

    const length = this.listInstance.length

    let index = 0
    const next = () => {
      if (index === length) return null

      const current = index
      index++
      return this.describeItem(current, this.listInstance[current])
    }

    return { length, next }
  }

  createIterableRecursor () {
    if (this.iteratorInstance === null) return DEFAULT_RECURSOR

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
          return this.describeItem(index++, item)
        }
      }
    }

    return { length: -1, next }
  }

  createRecursor () {
    let recursedProperty = false
    let recursedList = false
    let recursedIterable = false

    let recursor = null
    return () => {
      if (recursor !== null) {
        const retval = recursor.next()
        if (retval) {
          return retval
        } else {
          recursor = null
        }
      }

      // Prioritize recursing lists when the instance is an array.
      if (!recursedList && (this.instanceIsArray || recursedProperty)) {
        recursor = this.createListRecursor()
        recursedList = true
        return new ListStats(recursor)
      }

      if (!recursedProperty) {
        recursor = this.createPropertyRecursor()
        recursedProperty = true
        return new PropertyStats(recursor)
      }

      if (!recursedIterable) {
        recursor = this.createIterableRecursor()
        recursedIterable = true
        return new IterableStats(recursor)
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
