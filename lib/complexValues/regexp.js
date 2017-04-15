'use strict'

const constants = require('../constants')
const formatUtils = require('../formatUtils')
const object = require('./object')

const UNEQUAL = constants.UNEQUAL

function describe (props) {
  const regexp = props.value
  return new DescribedRegexpValue(Object.assign({
    flags: getSortedFlags(regexp),
    source: regexp.source
  }, props))
}
exports.describe = describe

function deserialize (state, recursor) {
  return new DeserializedRegexpValue(state, recursor)
}
exports.deserialize = deserialize

const tag = Symbol('RegexpValue')
exports.tag = tag

function getSortedFlags (regexp) {
  const flags = regexp.flags || String(regexp).slice(regexp.source.length + 2)
  return flags.split('').sort().join('')
}

class RegexpValue extends object.ObjectValue {
  constructor (props) {
    super(props)
    this.flags = props.flags
    this.source = props.source
  }

  compare (expected) {
    return this.tag === expected.tag && this.flags === expected.flags && this.source === expected.source
      ? super.compare(expected)
      : UNEQUAL
  }

  format (theme, gutter, indent, innerIndent) {
    return super.format(theme, gutter, indent, innerIndent).customize({
      finalize: inner => {
        const ctor = this.ctor || this.stringTag
        const regexp = formatUtils.wrap(theme.regexp.source, this.source) + formatUtils.wrap(theme.regexp.flags, this.flags)
        if (ctor === 'RegExp' && inner === '') return regexp

        return formatUtils.formatCtorAndStringTag(theme, this) + ' ' +
          formatUtils.wrap(theme.object,
            '\n' + gutter + innerIndent + regexp + '\n' +
            (inner === '' ? '' : gutter + innerIndent + theme.regexp.separator + inner + '\n') +
            gutter + indent)
      },

      shouldFormat (subject) {
        return subject.isStats !== true
      }
    })
  }

  serialize () {
    return [this.flags, this.source, super.serialize()]
  }
}
Object.defineProperty(RegexpValue.prototype, 'tag', { value: tag })

const DescribedRegexpValue = object.DescribedMixin(RegexpValue)

class DeserializedRegexpValue extends object.DeserializedMixin(RegexpValue) {
  constructor (state, recursor) {
    super(state[2], recursor)
    this.flags = state[0]
    this.source = state[1]
  }
}
