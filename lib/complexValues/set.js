'use strict'

const constants = require('../constants')
const object = require('./object')

const UNEQUAL = constants.UNEQUAL

function describe (props) {
  return new DescribedSetValue(Object.assign({
    size: props.value.size
  }, props))
}
exports.describe = describe

const tag = Symbol('SetValue')
exports.tag = tag

class SetValue extends object.ObjectValue {
  constructor (props) {
    super(props)
    this.size = props.size
  }

  compare (expected) {
    return this.tag !== expected.tag || this.size !== expected.size
      ? UNEQUAL
      : super.compare(expected)
  }

  compareDiff (expected) {
    return this.tag !== expected.tag
      ? UNEQUAL
      : super.compare(expected)
  }
}
Object.defineProperty(SetValue.prototype, 'tag', { value: tag })

class DescribedSetValue extends object.DescribedMixin(SetValue) {
  createIterableRecursor () {
    const size = this.size

    let index = 0
    let members
    const next = () => {
      if (index === size) return null

      if (!members) {
        members = Array.from(this.value)
      }

      const value = members[index]
      return this.describeItem(index++, value)
    }

    return { size, next }
  }
}
