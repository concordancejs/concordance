'use strict'

const constants = require('./constants')
const getObjectKeys = require('./getObjectKeys')
const ComplexFormatter = require('./formatUtils').ComplexFormatter
const hasLength = require('./hasLength')
const recursorUtils = require('./recursorUtils')
const stats = require('./stats')

const DEEP_EQUAL = constants.DEEP_EQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL
const UNEQUAL = constants.UNEQUAL

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
    this.iterableState = null
    this.listState = null
    this.propertyState = null
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
    if (size === 0) return recursorUtils.NOOP_RECURSOR

    let index = 0
    const next = () => {
      if (index === size) return null

      const key = objectKeys.keys[index++]
      return this.describeProperty(key, this.instance[key])
    }

    return { size, next }
  }

  createListRecursor () {
    if (!this.isList) return recursorUtils.NOOP_RECURSOR

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
    if (this.isArray || !this.isIterable) return recursorUtils.NOOP_RECURSOR

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
      let retval = null
      do {
        if (recursor !== null) {
          retval = recursor.next()
          if (retval === null) {
            recursor = null
          }
        }

        while (recursor === null && (!recursedList || !recursedProperty || !recursedIterable)) {
          // Prioritize recursing lists
          if (!recursedList) {
            const replay = recursorUtils.replay(this.listState, () => this.createListRecursor())
            this.listState = replay.state
            recursor = replay.recursor
            recursedList = true
            if (recursor !== recursorUtils.NOOP_RECURSOR) {
              retval = new stats.ListStats(recursor)
            }
          } else if (!recursedProperty) {
            const replay = recursorUtils.replay(this.propertyState, () => this.createPropertyRecursor())
            this.propertyState = replay.state
            recursor = replay.recursor
            recursedProperty = true
            if (recursor !== recursorUtils.NOOP_RECURSOR) {
              retval = new stats.PropertyStats(recursor)
            }
          } else if (!recursedIterable) {
            const replay = recursorUtils.replay(this.iterableState, () => this.createIterableRecursor())
            this.iterableState = replay.state
            recursor = replay.recursor
            recursedIterable = true
            if (recursor !== recursorUtils.NOOP_RECURSOR) {
              retval = new stats.IterableStats(recursor)
            }
          }
        }
      } while (recursor !== null && retval === null)

      return retval
    }
  }

  compare (expected) {
    if (expected.isComplex !== true) return UNEQUAL
    if (this.instance && expected.instance && this.instance === expected.instance) return DEEP_EQUAL
    if (this.tag !== expected.tag || this.ctor !== expected.ctor) return UNEQUAL
    if (this.unwrapped && expected.unwrapped && this.unwrapped.compare(expected.unwrapped) !== DEEP_EQUAL) return UNEQUAL
    return SHALLOW_EQUAL
  }

  format (gutter, indent, innerIndent) {
    return new ComplexFormatter(this, gutter, indent, innerIndent)
  }
}
Object.defineProperty(Complex.prototype, 'isComplex', { value: true })
module.exports = Complex
