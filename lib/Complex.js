'use strict'

const constants = require('./constants')
const hasLength = require('./hasLength')
const Item = require('./Item')
const Property = require('./Property')

class Complex {
  constructor (tag, ctor, unwrapped, pointer, describeNested, instance, cache) {
    this.tag = tag
    this.ctor = ctor
    this.unwrapped = unwrapped
    this.pointer = pointer

    this.describeNested = describeNested
    this.instance = instance
    this.cache = cache
  }

  static fromValue (instance, tag, ctor, unwrapped, pointer, describeNested) {
    return new this(tag, ctor, unwrapped, pointer, describeNested, instance, {
      properties: null,
      listItems: null,
      iterableItems: null
    })
  }

  getProperties () {
    if (this.cache.properties) return this.cache.properties

    const length = hasLength(this.instance)
      ? this.instance.length
      : -1

    const properties =
      Object.getOwnPropertyNames(this.instance)
        // Reject list item accessors
        .filter(key => !/^\d+$/.test(key) || key >= length)
        .sort() // Property names are never order-sensitive
        .concat(Object.getOwnPropertySymbols(this.instance)) // But symbols are
        .filter(key => {
          const desc = Object.getOwnPropertyDescriptor(this.instance, key)
          return desc.enumerable
        })
        .map(key => {
          const primitive = this.describeNested(key)
          const value = this.describeNested(this.instance[key])
          return new Property(primitive, value)
        })

    this.cache.properties = properties
    return properties
  }

  getListItems () {
    if (this.cache.listItems !== null) return this.cache.listItems

    const list = this.instance
    if (!hasLength(list)) {
      this.cache.listItems = false
      return false
    }

    const items = []
    for (let index = 0; index < list.length; index++) {
      const value = this.describeNested(list[index])
      items.push(new Item(index, value))
    }

    this.cache.listItems = items
    return items
  }

  getIterableItems () {
    if (this.cache.iterableItems !== null) return this.cache.iterableItems

    if (!this.instance[Symbol.iterator]) {
      this.cache.iterableItems = false
      return false
    }

    const items = []
    const ignoreIfAccessor = !!this.getListItems()
    let index = 0
    for (const item of this.instance) {
      if (ignoreIfAccessor && this.instance[index] === item) {
        index++
        continue
      }

      const value = this.describeNested(item)
      items.push(new Item(index, value))
      index++
    }

    this.cache.iterableItems = items
    return items
  }

  *[Symbol.iterator] () {
    for (const p of this.getProperties()) {
      yield p
    }

    const listItems = this.getListItems()
    if (listItems) {
      for (const i of listItems) {
        yield i
      }
    }

    const iterableItems = this.getIterableItems()
    if (iterableItems) {
      for (const i of iterableItems) {
        yield i
      }
    }
  }

  compare (expected) {
    if (!expected.isComplex) return constants.UNEQUAL
    if (this.instance && expected.instance && this.instance === expected.instance) return constants.DEEP_EQUAL
    if (this.tag !== expected.tag || this.ctor !== expected.ctor) return constants.UNEQUAL
    if (this.unwrapped && expected.unwrapped && this.unwrapped.compare(expected.unwrapped) !== constants.DEEP_EQUAL) return constants.UNEQUAL
    return constants.SHALLOW_EQUAL
  }
}
Object.defineProperty(Complex.prototype, 'isComplex', { value: true })
module.exports = Complex
