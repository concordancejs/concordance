'use strict'

const constants = require('../constants')
const recursorUtils = require('../recursorUtils')
const propertyStatsTag = require('../metaDescriptors/stats').propertyTag
const object = require('./object')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function getBuffer (value) {
  // Assume at least Node.js 4.5.0, which introduces Buffer.from()
  const buffer = Buffer.from(value.buffer)
  return value.byteLength !== value.buffer.byteLength
    ? buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
    : buffer
}
exports.getBuffer = getBuffer

function describe (props) {
  return new DescribedTypedArrayValue(Object.assign({
    buffer: getBuffer(props.value),
    // Set isArray and isList so the property recursor excludes the byte accessors
    isArray: true,
    isList: true
  }, props))
}
exports.describe = describe

function deserialize (state, recursor) {
  return new DeserializedTypedArrayValue(state, recursor)
}
exports.deserialize = deserialize

function deserializeBytes (buffer) {
  return new Bytes(buffer)
}
exports.deserializeBytes = deserializeBytes

const bytesTag = Symbol('Bytes')
exports.bytesTag = bytesTag

const tag = Symbol('TypedArrayValue')
exports.tag = tag

class Bytes {
  constructor (buffer) {
    this.buffer = buffer
  }

  compare (expected) {
    return expected.tag === bytesTag && this.buffer.equals(expected.buffer)
      ? DEEP_EQUAL
      : UNEQUAL
  }

  format (gutter, indent) {
    let formatted = ''

    // Display 4-byte words, 8 per line
    for (let offset = 0; offset < this.buffer.length; offset += 4) {
      if (offset > 0) {
        if (offset % 32 === 0) {
          formatted += `\n${indent}`
        } else {
          formatted += ' '
        }
      }
      formatted += this.buffer.toString('hex', offset, offset + 4)
    }

    return formatted
  }

  serialize () {
    return this.buffer
  }
}
Object.defineProperty(Bytes.prototype, 'tag', { value: bytesTag })

class TypedArrayValue extends object.ObjectValue {
  constructor (props) {
    super(props)
    this.buffer = props.buffer
  }

  format (gutter, indent, innerIndent) {
    return super.format(gutter, indent, innerIndent).customize({
      shouldFormat (subject) {
        if (subject.tag === propertyStatsTag) return subject.size > 1
        if (subject.isProperty === true) return subject.key.value !== 'byteLength'
        if (subject.tag === bytesTag) return subject.buffer.byteLength > 0
        return true
      }
    })
  }
}
Object.defineProperty(TypedArrayValue.prototype, 'tag', { value: tag })
exports.TypedArrayValue = TypedArrayValue

function DescribedMixin (base) {
  return class extends object.DescribedMixin(base) {
    // The list isn't recursed. Instead a Bytes instance is returned by the main
    // recursor.
    createListRecursor () {
      return recursorUtils.NOOP_RECURSOR
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
      return recursorUtils.unshift(super.createRecursor(), new Bytes(this.buffer))
    }
  }
}
exports.DescribedMixin = DescribedMixin

const DescribedTypedArrayValue = DescribedMixin(TypedArrayValue)

function DeserializedMixin (base) {
  return class extends object.DeserializedMixin(base) {
    constructor (state, recursor) {
      super(state, recursor)

      // Get the Bytes descriptor from the recursor. It contains the buffer.
      const bytesDescriptor = this.createRecursor()()
      this.buffer = bytesDescriptor.buffer
    }
  }
}
exports.DeserializedMixin = DeserializedMixin

const DeserializedTypedArrayValue = DeserializedMixin(TypedArrayValue)
