'use strict'

const constants = require('./constants')
const formatUtils = require('./formatUtils')
const Complex = require('./Complex')

const UNEQUAL = constants.UNEQUAL

class DateComplex extends Complex {
  static fromValue (
    instance,
    tag, ctor, unwrapped, pointer,
    describeItem, describeMapEntry, describeProperty
  ) {
    const isArray = false
    const isIterable = false
    const isList = false

    return new this(
      tag, ctor, unwrapped, pointer, isArray, isIterable, isList,
      describeItem, describeMapEntry, describeProperty,
      instance
    )
  }

  compare (expected) {
    return expected.isDateComplex !== true
      ? UNEQUAL
      : super.compare(expected)
  }

  format (indent, innerIndent) {
    let inner = ''
    return {
      buffer (formatted, origin) {
        inner += `\n${innerIndent}${formatted}`
      },
      finalize: () => {
        const prefix = `${formatUtils.formatCtorAndTag(this)} ${this.instance.toISOString()}`
        if (inner === '') return prefix

        return `${prefix} {${inner}\n${indent}}`
      },
      shouldFormat (subject) {
        return subject.isStats !== true
      }
    }
  }
}
Object.defineProperty(DateComplex.prototype, 'isDateComplex', { value: true })
module.exports = DateComplex
