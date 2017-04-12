'use strict'

const constants = require('../constants')
const object = require('./object')

const UNEQUAL = constants.UNEQUAL

function describe (props) {
  return new DescribedMapValue(Object.assign({
    size: props.value.size
  }, props))
}
exports.describe = describe

function deserialize (state, recursor) {
  return new DeserializedMapValue(state, recursor)
}
exports.deserialize = deserialize

const tag = Symbol('MapValue')
exports.tag = tag

class MapValue extends object.ObjectValue {
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

  serialize () {
    return [this.size, super.serialize()]
  }
}
Object.defineProperty(MapValue.prototype, 'tag', { value: tag })

class DescribedMapValue extends object.DescribedMixin(MapValue) {
  createIterableRecursor () {
    const size = this.size

    let index = 0
    let entries
    const next = () => {
      if (index === size) return null

      if (!entries) {
        entries = Array.from(this.value)
      }

      const entry = entries[index++]
      return this.describeMapEntry(entry[0], entry[1])
    }

    return { size, next }
  }
}

class DeserializedMapValue extends object.DeserializedMixin(MapValue) {
  constructor (state, recursor) {
    super(state[1], recursor)
    this.size = state[0]
  }
}
