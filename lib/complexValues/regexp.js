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

  format (gutter, indent, innerIndent) {
    return super.format(gutter, indent, innerIndent).customize({
      finalize: inner => {
        const ctor = this.ctor || this.stringTag
        const regexp = `/${this.source}/${this.flags}`
        if (ctor !== 'RegExp' || inner !== '') {
          return `${formatUtils.formatCtorAndStringTag(this)} {` +
            '\n' + gutter + innerIndent + regexp +
            (inner === '' ? '' : `\n${gutter}${innerIndent}---` + inner) +
            '\n' + gutter + indent + '}'
        }

        return regexp
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
