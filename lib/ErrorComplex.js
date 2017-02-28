'use strict'

const constants = require('./constants')
const isEnumerable = require('./isEnumerable')
const NOOP_RECURSOR = require('./recursorUtils').NOOP_RECURSOR
const Complex = require('./Complex')

const UNEQUAL = constants.UNEQUAL

class ErrorComplex extends Complex {
  constructor (
    tag, ctor, name, nameIsEnumerable, message, messageIsEnumerable, pointer, isArray, isIterable, isList,
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
    this.message = message
    this.messageIsEnumerable = messageIsEnumerable
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
    const name = instance.name
    const messageIsEnumerable = isEnumerable(instance, 'message')
    const message = instance.message

    return new this(
      tag, ctor, name, nameIsEnumerable, message, messageIsEnumerable, pointer, isArray, isIterable, isList,
      describeItem, describeMapEntry, describeProperty,
      instance
    )
  }

  createPropertyRecursor () {
    const recursor = super.createPropertyRecursor()

    let skipName = this.nameIsEnumerable
    let emitMessage = !this.messageIsEnumerable

    let size = recursor.size
    if (skipName && size > 0) {
      size -= 1
    }
    if (emitMessage) {
      size += 1
    }

    if (size === 0) return NOOP_RECURSOR

    let done = false
    const next = () => {
      if (done) return null

      const property = recursor.next()
      if (property) {
        if (skipName && property.key.value === 'name') {
          skipName = false
          return next()
        }
        return property
      }

      if (emitMessage) {
        emitMessage = false
        return this.describeProperty('message', this.message)
      }

      done = true
      return null
    }

    return { size, next }
  }

  compare (expected) {
    return expected.isErrorComplex === true && this.name === expected.name
      ? super.compare(expected)
      : UNEQUAL
  }
}
Object.defineProperty(ErrorComplex.prototype, 'isErrorComplex', { value: true })
module.exports = ErrorComplex
