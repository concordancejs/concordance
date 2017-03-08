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

  format (gutter, indent, innerIndent) {
    let inner = ''
    return {
      buffer (innerGutter, formatted, origin) {
        if (typeof formatted === 'string') {
          inner += `\n${innerGutter}${innerIndent}${formatted}`
        } else {
          for (const value of formatted) {
            inner += `\n${value.gutter}${innerIndent}${value.formatted}`
          }
        }
      },
      finalize: () => {
        const prefix = `${formatUtils.formatCtorAndTag(this)} ${this.instance.toISOString()}`
        if (inner === '') return prefix

        return `${prefix} {${gutter}${inner}\n${indent}}`
      },
      shouldFormat (subject) {
        return subject.isStats !== true
      }
    }
  }
}
Object.defineProperty(DateComplex.prototype, 'isDateComplex', { value: true })
module.exports = DateComplex
