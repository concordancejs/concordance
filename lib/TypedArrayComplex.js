'use strict'

const constants = require('./constants')
const Complex = require('./Complex')
const NOOP_RECURSOR = require('./recursorUtils').NOOP_RECURSOR

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

class Bytes {
  constructor (buffer) {
    this.buffer = buffer
  }

  compare (expected) {
    return expected.isBytes === true && this.buffer.equals(expected.buffer)
      ? DEEP_EQUAL
      : UNEQUAL
  }
}
Object.defineProperty(Bytes.prototype, 'isBytes', { value: true })

class TypedArrayComplex extends Complex {
  constructor (
    tag, ctor, array, buffer, pointer,
    describeItem, describeMapEntry, describeProperty,
    instance
  ) {
    // Set isArray and isList so the property recursor excludes the byte accessors
    const isArray = true
    const isIterable = false
    const isList = true

    super(
      tag, ctor, null, pointer, isArray, isIterable, isList,
      describeItem, describeMapEntry, describeProperty,
      instance
    )

    this.array = array
    this.buffer = buffer
  }

  static fromValue (
    instance,
    tag, ctor, unwrapped, pointer,
    describeItem, describeMapEntry, describeProperty
  ) {
    const array = instance
    // Assume at least Node.js 4.5.0, which introduces Buffer.from()
    let buffer = Buffer.from(instance.buffer)
    if (instance.byteLength !== instance.buffer.byteLength) {
      buffer = buffer.slice(instance.byteOffset, instance.byteOffset + instance.byteLength)
    }

    return new this(
      tag, ctor, array, buffer, pointer,
      describeItem, describeMapEntry, describeProperty,
      instance
    )
  }

  // The list isn't recursed. Instead a Bytes instance is returned by the main
  // recursor.
  createListRecursor () {
    return NOOP_RECURSOR
  }

  createPropertyRecursor () {
    const recursor = super.createPropertyRecursor()
    const size = recursor.size + 1

    let done = false
    const next = () => {
      if (done) return null

      const property = recursor.next()
      if (property) return property

      done = true
      return this.describeProperty('byteLength', this.buffer.byteLength)
    }

    return { size, next }
  }

  createRecursor () {
    const recursor = super.createRecursor()

    let emitBytes = true
    return () => {
      if (emitBytes) {
        emitBytes = false
        return new Bytes(this.buffer)
      }

      return recursor()
    }
  }

  compare (expected) {
    return expected.isTypedArrayComplex !== true
      ? UNEQUAL
      : super.compare(expected)
  }
}
Object.defineProperty(TypedArrayComplex.prototype, 'isTypedArrayComplex', { value: true })
module.exports = TypedArrayComplex
