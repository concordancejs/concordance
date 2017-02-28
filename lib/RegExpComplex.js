'use strict'

const constants = require('./constants')
const formatUtils = require('./formatUtils')
const Complex = require('./Complex')

const UNEQUAL = constants.UNEQUAL

function getSortedFlags (regexp) {
  const flags = regexp.flags || String(regexp).slice(regexp.source.length + 2)
  return flags.split('').sort().join('')
}

class RegExpComplex extends Complex {
  constructor (
    tag, ctor, flags, source, pointer, isArray, isIterable, isList,
    describeItem, describeMapEntry, describeProperty,
    instance
  ) {
    super(
      tag, ctor, null, pointer, isArray, isIterable, isList,
      describeItem, describeMapEntry, describeProperty,
      instance
    )

    this.flags = flags
    this.source = source
  }

  static fromValue (
    instance,
    tag, ctor, unwrapped, pointer,
    describeItem, describeMapEntry, describeProperty
  ) {
    const isArray = false
    const isIterable = false
    const isList = false

    const flags = getSortedFlags(instance)
    const source = instance.source

    return new this(
      tag, ctor, flags, source, pointer, isArray, isIterable, isList,
      describeItem, describeMapEntry, describeProperty,
      instance
    )
  }

  compare (expected) {
    return expected.isRegExpComplex === true && this.flags === expected.flags && this.source === expected.source
      ? super.compare(expected)
      : UNEQUAL
  }

  format (indent, innerIndent) {
    let inner = ''
    return {
      buffer (formatted, origin) {
        inner += `\n${innerIndent}${formatted}`
      },
      finalize: () => {
        const ctor = this.ctor || this.tag
        const regexp = `/${this.source}/${this.flags}`
        if (ctor !== 'RegExp' || inner !== '') {
          return `${formatUtils.formatCtorAndTag(this)} {\n${innerIndent}${regexp}${inner}\n${indent}}`
        }

        return regexp
      },
      nestInner: true
    }
  }
}
Object.defineProperty(RegExpComplex.prototype, 'isRegExpComplex', { value: true })
module.exports = RegExpComplex
