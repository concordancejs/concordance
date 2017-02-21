'use strict'

const Complex = require('./Complex')
const Property = require('./Property')

class ErrorComplex extends Complex {
  getProperties () {
    if (this.cache.properties) return this.cache.properties

    const properties = super.getProperties()
    const existing = new Set(properties.map(p => p.key.value))
    if (!existing.has('name')) {
      const key = this.describeNested('name')
      const value = this.describeNested(this.instance.name)
      // Append, since this is an extra, non-own property.
      properties.push(new Property(key, value))
    }
    if (!existing.has('message')) {
      const key = this.describeNested('message')
      const value = this.describeNested(this.instance.message)
      // Append, since this is an extra, non-own property.
      properties.push(new Property(key, value))
    }
    return properties
  }
}
module.exports = ErrorComplex
