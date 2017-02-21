'use strict'

const constants = require('./constants')
const Complex = require('./Complex')
const Property = require('./Property')

class FunctionComplex extends Complex {
  getProperties () {
    if (this.cache.properties) return this.cache.properties

    const properties = super.getProperties()
    const existing = new Set(properties.map(p => p.key.value))
    if (!existing.has('name')) {
      const key = this.describeNested('name')
      // Guard against edge cases such as the function being a class constructor
      // with a static name() method.
      if (typeof this.instance.name === 'string') {
        const value = this.describeNested(this.instance.name)
        // Append, since this is an extra, non-own property.
        properties.push(new Property(key, value))
      }
    }
    return properties
  }

  compare (expected) {
    const result = super.compare(expected)

    // After deserialization functions may not be strictly equal. Calling code
    // needs to decide how to interpret the result.
    if (result === constants.SHALLOW_EQUAL) return constants.AMBIGUOUS

    return result
  }
}
module.exports = FunctionComplex
