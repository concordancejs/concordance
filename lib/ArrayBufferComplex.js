'use strict'

const Complex = require('./Complex')
const Item = require('./Item')
const Property = require('./Property')

class ArrayBufferComplex extends Complex {
  getProperties () {
    if (this.cache.properties) return this.cache.properties

    const properties = super.getProperties()
    // For proper ArrayBuffers, `byteLength` is not an own-property, and thus
    // should not be included. Don't bother checking if it actually is.
    const key = this.describeNested('byteLength')
    const value = this.describeNested(this.instance.byteLength)
    // Append, since this is assumed to be an extra, non-own property.
    properties.push(new Property(key, value))
    return properties
  }

  getIterableItems () {
    if (this.cache.iterableItems !== null) return this.cache.iterableItems

    const items = []
    let index = 0
    for (const item of new Uint8Array(this.instance)) {
      const value = this.describeNested(item)
      items.push(new Item(index, value))
      index++
    }

    this.cache.iterableItems = items
    return items
  }
}
module.exports = ArrayBufferComplex
