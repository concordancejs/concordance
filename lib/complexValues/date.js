'use strict'

const constants = require('../constants')
const formatUtils = require('../formatUtils')
const object = require('./object')

const SHALLOW_EQUAL = constants.SHALLOW_EQUAL
const UNEQUAL = constants.UNEQUAL

function describe (props) {
  return new DescribedDateValue(props)
}
exports.describe = describe

function deserialize (state, recursor) {
  return new DeserializedDateValue(state, recursor)
}
exports.deserialize = deserialize

const tag = Symbol('DateValue')
exports.tag = tag

class DateValue extends object.ObjectValue {
  compare (expected) {
    const result = super.compare(expected)
    if (result !== SHALLOW_EQUAL) return result

    return Object.is(this.value.getTime(), expected.value.getTime())
      ? SHALLOW_EQUAL
      : UNEQUAL
  }

  format (theme, gutter, indent, innerIndent) {
    return super.format(theme, gutter, indent, innerIndent).customize({
      finalize: inner => {
        return formatUtils.formatCtorAndStringTag(theme, this) + ' ' +
          formatUtils.wrap(theme.date.value, this.value.toISOString()) + ' ' +
          formatUtils.wrap(theme.object, inner === '' ? '' : inner + '\n' + gutter + indent)
      },

      shouldFormat (subject) {
        return subject.isStats !== true
      }
    })
  }

  serialize () {
    return [this.value.toISOString(), super.serialize()]
  }
}
Object.defineProperty(DateValue.prototype, 'tag', { value: tag })

const DescribedDateValue = object.DescribedMixin(DateValue)

class DeserializedDateValue extends object.DeserializedMixin(DateValue) {
  constructor (state, recursor) {
    super(state[1], recursor)
    this.value = new Date(state[0])
  }
}
