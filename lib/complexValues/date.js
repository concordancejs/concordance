'use strict'

const formatUtils = require('../formatUtils')
const object = require('./object')

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
  format (gutter, indent, innerIndent) {
    return super.format(gutter, indent, innerIndent).customize({
      finalize: inner => {
        const prefix = `${formatUtils.formatCtorAndStringTag(this)} ${this.value.toISOString()}`
        if (inner === '') return prefix

        return `${prefix} {${gutter}${inner}\n${indent}}`
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
