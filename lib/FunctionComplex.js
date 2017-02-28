'use strict'

const constants = require('./constants')
const isEnumerable = require('./isEnumerable')
const NOOP_RECURSOR = require('./recursorUtils').NOOP_RECURSOR
const Complex = require('./Complex')

const AMBIGUOUS = constants.AMBIGUOUS
const UNEQUAL = constants.UNEQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL

class FunctionComplex extends Complex {
  constructor (
    tag, ctor, name, nameIsEnumerable, pointer, isArray, isIterable, isList,
    describeItem, describeMapEntry, describeProperty,
    instance
  ) {
    super(
      tag, ctor, null, pointer, isArray, isIterable, isList,
      describeItem, describeMapEntry, describeProperty,
      instance
    )

    this.name = name
    this.nameIsEnumerable = nameIsEnumerable
  }

  static fromValue (
    instance,
    tag, ctor, unwrapped, pointer,
    describeItem, describeMapEntry, describeProperty
  ) {
    const isArray = false
    const isIterable = false
    const isList = false

    const nameIsEnumerable = isEnumerable(instance, 'name')
    const name = typeof instance.name === 'string'
      ? instance.name
      : null

    return new this(
      tag, ctor, name, nameIsEnumerable, pointer, isArray, isIterable, isList,
      describeItem, describeMapEntry, describeProperty,
      instance
    )
  }

  createPropertyRecursor () {
    const recursor = super.createPropertyRecursor()

    const skipName = this.nameIsEnumerable
    if (!skipName) return recursor

    let size = recursor.size
    if (skipName) {
      size -= 1
    }

    if (size === 0) return NOOP_RECURSOR

    const next = () => {
      const property = recursor.next()
      if (property) {
        if (skipName && property.key.value === 'name') {
          return next()
        }
        return property
      }

      return null
    }

    return { size, next }
  }

  compare (expected) {
    if (expected.isFunctionComplex !== true) return UNEQUAL
    if (this.name !== expected.name) return UNEQUAL

    const result = super.compare(expected)
    // After deserialization functions may not be strictly equal. Calling code
    // needs to decide how to interpret the result.
    return result === SHALLOW_EQUAL
      ? AMBIGUOUS
      : result
  }

  format (indent, innerIndent) {
    let inner = ''
    return {
      buffer (formatted, origin) {
        inner += `\n${innerIndent}${formatted}`
      },
      finalize: () => {
        const prefix = `${this.tag}${this.name ? ` ${this.name}` : ''}`
        if (inner === '') return prefix

        return `${prefix} {${inner}\n${indent}}`
      },
      nestInner: true,
      shouldFormat (subject) {
        return subject.isStats !== true
      }
    }
  }
}
Object.defineProperty(FunctionComplex.prototype, 'isFunctionComplex', { value: true })
module.exports = FunctionComplex
