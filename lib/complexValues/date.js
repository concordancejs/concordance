'use strict'

const formatUtils = require('../formatUtils')
const object = require('./object')

function describe (props) {
  return new DescribedDateValue(props)
}
exports.describe = describe

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
}
Object.defineProperty(DateValue.prototype, 'tag', { value: tag })

const DescribedDateValue = object.DescribedMixin(DateValue)
