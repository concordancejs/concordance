'use strict'

const constants = require('./constants')
const Complex = require('./Complex')

const UNEQUAL = constants.UNEQUAL

function getSortedFlags (regexp) {
  const flags = regexp.flags || String(regexp).slice(regexp.source.length + 2)
  return flags.split('').sort().join('')
}

class RegExpComplex extends Complex {
  constructor (tag, ctor, flags, source, pointer, describeItem, describeProperty, instance) {
    super(tag, ctor, null, pointer, describeItem, describeProperty, instance)
    this.flags = flags
    this.source = source
  }

  static fromValue (instance, tag, ctor, unwrapped, pointer, describeItem, describeProperty) {
    return new this(tag, ctor, getSortedFlags(instance), instance.source, pointer, describeItem, describeProperty, instance)
  }

  compare (expected) {
    return expected.isRegExpComplex === true && this.flags === expected.flags && this.source === expected.source
      ? super.compare(expected)
      : UNEQUAL
  }
}
Object.defineProperty(RegExpComplex.prototype, 'isRegExpComplex', { value: true })
module.exports = RegExpComplex
