'use strict'

const constants = require('../constants')
const formatUtils = require('../formatUtils')
const lineBuilder = require('../lineBuilder')
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

  formatShallow (theme, indent) {
    const string = formatUtils.formatCtorAndStringTag(theme, this) + ' ' +
      formatUtils.wrap(theme.date.value, this.value.toISOString()) + ' ' +
      theme.object.openBracket

    return super.formatShallow(theme, indent).customize({
      finalize (innerLines) {
        return innerLines.isEmpty
          ? lineBuilder.single(string + theme.object.closeBracket)
          : lineBuilder.first(string)
              .concat(innerLines.withFirstPrefixed(indent.increase()).stripFlags())
              .append(lineBuilder.last(indent + theme.object.closeBracket))
      },

      maxDepth () {
        return lineBuilder.single(string + ' ' + theme.maxDepth + ' ' + theme.object.closeBracket)
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
