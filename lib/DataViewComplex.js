'use strict'

const constants = require('./constants')
const TypedArrayComplex = require('./TypedArrayComplex')

const UNEQUAL = constants.UNEQUAL

// DataViews can be represented as regular Buffers, allowing them to be treated
// as TypedArrays for the purposes of this package.
class DataViewComplex extends TypedArrayComplex {
  static fromValue (
    instance,
    tag, ctor, unwrapped, pointer,
    describeItem, describeMapEntry, describeProperty
  ) {
    // Assume at least Node.js 4.5.0, which introduces Buffer.from()
    let buffer = Buffer.from(instance.buffer)
    if (instance.byteLength !== instance.buffer.byteLength) {
      buffer = buffer.slice(instance.byteOffset, instance.byteOffset + instance.byteLength)
    }

    return new this(
      tag, ctor, buffer, buffer, pointer,
      describeItem, describeMapEntry, describeProperty,
      instance
    )
  }

  compare (expected) {
    return expected.isDataViewComplex !== true
      ? UNEQUAL
      : super.compare(expected)
  }
}
Object.defineProperty(DataViewComplex.prototype, 'isDataViewComplex', { value: true })
module.exports = DataViewComplex
