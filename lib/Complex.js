'use strict'

const constants = require('./constants')
const getObjectKeys = require('./getObjectKeys')
const hasLength = require('./hasLength')

const DEEP_EQUAL = constants.DEEP_EQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL
const UNEQUAL = constants.UNEQUAL

class IterableStats {
  constructor (recursor) {
    this.size = recursor.size
  }

  compare (expected) {
    return expected.isIterableStats === true && this.size === expected.size
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(IterableStats.prototype, 'isIterableStats', { value: true })

class ListStats {
  constructor (recursor) {
    this.size = recursor.size
  }

  compare (expected) {
    return expected.isListStats === true && this.size === expected.size
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(ListStats.prototype, 'isListStats', { value: true })

class PropertyStats {
  constructor (recursor) {
    this.size = recursor.size
  }

  compare (expected) {
    return expected.isPropertyStats === true && this.size === expected.size
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(PropertyStats.prototype, 'isPropertyStats', { value: true })

const DEFAULT_RECURSOR = {
  size: 0,
  next () { return null }
}

class Complex {
  constructor (
    tag, ctor, unwrapped, pointer, isArray, isIterable, isList,
    describeItem, describeMapEntry, describeProperty,
    instance
  ) {
    this.tag = tag
    this.ctor = ctor
    this.unwrapped = unwrapped
    this.pointer = pointer
    this.isArray = isArray
    this.isIterable = isIterable
    this.isList = isList

    this.describeItem = describeItem
    this.describeMapEntry = describeMapEntry
    this.describeProperty = describeProperty

    this.instance = instance
  }

  static fromValue (
    instance,
    tag, ctor, unwrapped, pointer,
    describeItem, describeMapEntry, describeProperty
  ) {
    const isArray = tag === 'Array'
    const isIterable = instance[Symbol.iterator] !== undefined
    const isList = isArray || hasLength(instance)

    return new this(
      tag, ctor, unwrapped, pointer, isArray, isIterable, isList,
      describeItem, describeMapEntry, describeProperty,
      instance
    )
  }

  createPropertyRecursor () {
    const objectKeys = getObjectKeys(this.instance, this.isList ? this.instance.length : 0)
    const size = objectKeys.size
    if (size === 0) return DEFAULT_RECURSOR

    let index = 0
    const next = () => {
      if (index === size) return null

      const key = objectKeys.keys[index++]
      return this.describeProperty(key, this.instance[key])
    }

    return { size, next }
  }

  createListRecursor () {
    if (!this.isList) return DEFAULT_RECURSOR

    const size = this.instance.length

    let index = 0
    const next = () => {
      if (index === size) return null

      const current = index
      index++
      return this.describeItem(current, this.instance[current])
    }

    return { size, next }
  }

  createIterableRecursor () {
    if (this.isArray || !this.isIterable) return DEFAULT_RECURSOR

    const iterator = this.instance[Symbol.iterator]()
    let first = iterator.next()

    let done = false
    let size = -1
    if (first.done) {
      if (first.value === undefined) {
        size = 0
        done = true
      } else {
        size = 1
      }
    }

    let index = 0
    const next = () => {
      if (done) return null

      while (!done) {
        const current = first || iterator.next()
        if (current === first) {
          first = null
        }
        if (current.done) {
          done = true
        }

        const item = current.value
        if (done && item === undefined) return null

        if (this.isList && this.instance[index] === item) {
          index++
        } else {
          return this.describeItem(index++, item)
        }
      }
    }

    return { size, next }
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

      // Prioritize recursing lists
      if (!recursedList && (this.isList || recursedProperty)) {
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
    if (expected.isComplex !== true) return UNEQUAL
    if (this.instance && expected.instance && this.instance === expected.instance) return DEEP_EQUAL
    if (this.tag !== expected.tag || this.ctor !== expected.ctor) return UNEQUAL
    if (this.unwrapped && expected.unwrapped && this.unwrapped.compare(expected.unwrapped) !== DEEP_EQUAL) return UNEQUAL
    return SHALLOW_EQUAL
  }
}
Object.defineProperty(Complex.prototype, 'isComplex', { value: true })
module.exports = Complex
