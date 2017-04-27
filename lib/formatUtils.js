'use strict'

function wrap (fromTheme, value) {
  return fromTheme.open + value + fromTheme.close
}
exports.wrap = wrap

function formatCtorAndStringTag (theme, object) {
  if (!object.ctor) return wrap(theme.object.stringTag, object.stringTag)

  let retval = wrap(theme.object.ctor, object.ctor)
  if (object.stringTag && object.stringTag !== object.ctor && object.stringTag !== 'Object') {
    retval += ' ' + wrap(theme.object.secondaryStringTag, object.stringTag)
  }
  return retval
}
exports.formatCtorAndStringTag = formatCtorAndStringTag

class ObjectFormatter {
  constructor (object, theme, gutter, indent, innerIndent) {
    this.object = object
    this.theme = theme
    this.gutter = gutter
    this.indent = indent
    this.innerIndent = innerIndent

    this.nestInner = true

    this.inner = ''
    this.pendingStats = ''
  }

  buffer (innerGutter, formatted, origin) {
    if (origin.isStats === true) {
      const gutter = innerGutter === '' ? '' : this.theme.gutters.neutral
      this.pendingStats = '\n' + gutter + this.innerIndent + formatted
    } else {
      if (this.pendingStats !== '') {
        if (this.inner !== '') {
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
    return formatCtorAndStringTag(this.theme, this.object) + ' ' +
      wrap(
        this.object.isList ? this.theme.list : this.theme.object,
        this.inner ? this.inner + '\n' + this.gutter + this.indent : '')
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
        return methods.finalize(this.inner)
      }
    }

    return this
  }
}
exports.ObjectFormatter = ObjectFormatter

class SingleValueBuffer {
  constructor (finalizeFn) {
    this.finalizeFn = finalizeFn
    this.hasValue = false
    this.value = undefined
  }

  buffer (_, formatted) {
    if (this.hasValue) throw new Error('Formatter buffer can only take one formatted value.')

    this.hasValue = true
    this.value = formatted
  }

  finalize () {
    if (!this.hasValue) throw new Error('Formatter buffer never received a formatted value.')

    return this.finalizeFn(this.value)
  }
}
exports.SingleValueBuffer = SingleValueBuffer
