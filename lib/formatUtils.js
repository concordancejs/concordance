'use strict'

const stringPrimitive = require('./primitiveValues/string').tag

function formatCtorAndStringTag (object) {
  if (!object.ctor) return object.stringTag

  let retval = object.ctor
  if (object.stringTag && object.stringTag !== object.ctor && object.stringTag !== 'Object') {
    retval += ` @${object.stringTag}`
  }
  return retval
}
exports.formatCtorAndStringTag = formatCtorAndStringTag

class ObjectFormatter {
  constructor (object, gutter, indent, innerIndent) {
    this.object = object
    this.gutter = gutter
    this.indent = indent
    this.innerIndent = innerIndent

    this.nestInner = true

    this.inner = ''
    this.pendingStats = ''

    // Format booleans and numbers. Because they have a length, string objects will be treated as lists.
    this.unwrapped = object.unwrapped && object.unwrapped.tag !== stringPrimitive
      ? object.unwrapped.format('', indent, innerIndent)
      : ''
  }

  buffer (innerGutter, formatted, origin) {
    if (origin.isStats === true) {
      this.pendingStats = '\n' + innerGutter + this.innerIndent + formatted
    } else {
      if (this.pendingStats !== '') {
        if (this.inner !== '' || this.unwrapped !== '') {
          this.inner += this.pendingStats
        }
        this.pendingStats = ''
      }
      if (typeof formatted === 'string') {
        this.inner += '\n' + innerGutter + this.innerIndent + formatted
      } else {
        for (const value of formatted) {
          this.inner += '\n' + value.gutter + this.innerIndent + value.formatted
        }
      }
    }
  }

  finalize () {
    const prefix = formatCtorAndStringTag(this.object) + (this.object.isList ? ' [' : ' {')
    const close = this.object.isList ? ']' : '}'

    if (this.inner === '' && !this.unwrapped) return prefix + close
    if (this.unwrapped) {
      this.inner = '\n' + this.gutter + this.innerIndent + this.unwrapped + this.inner
    }

    return prefix + this.inner + '\n' + this.gutter + this.indent + close
  }

  shouldFormat () {
    return true
  }

  customize (methods) {
    if (methods.shouldFormat) {
      this.shouldFormat = methods.shouldFormat
    }

    if (methods.finalize) {
      this.finalize = () => {
        return methods.finalize(this.inner, this.unwrapped)
      }
    }

    return this
  }
}
exports.ObjectFormatter = ObjectFormatter
