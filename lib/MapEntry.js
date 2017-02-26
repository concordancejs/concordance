'use strict'

const constants = require('./constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL

class MapEntry {
  constructor (key, value, describePrimitive, describeComplex) {
    const primitiveKey = describePrimitive(key)
    this.keyIsPrimitive = primitiveKey !== null
    this.key = primitiveKey || describeComplex(key)

    const primitiveValue = describePrimitive(value)
    this.valueIsPrimitive = primitiveValue !== null
    this.value = primitiveValue || describeComplex(value)
  }

  createRecursor () {
    let emitKey = true
    let emitValue = true

    return () => {
      if (emitKey) {
        emitKey = false
        return this.key
      }

      if (emitValue) {
        emitValue = false
        return this.value
      }

      return null
    }
  }

  compare (expected) {
    if (expected.isMapEntry !== true) return UNEQUAL
    if (this.keyIsPrimitive !== expected.keyIsPrimitive) return UNEQUAL
    if (this.valueIsPrimitive !== expected.valueIsPrimitive) return UNEQUAL

    if (!this.keyIsPrimitive) return SHALLOW_EQUAL

    const keyResult = this.key.compare(expected.key)
    if (keyResult !== DEEP_EQUAL) return keyResult

    if (!this.valueIsPrimitive) return SHALLOW_EQUAL
    return this.value.compare(expected.value)
  }
}
Object.defineProperty(MapEntry.prototype, 'isMapEntry', { value: true })
module.exports = MapEntry
