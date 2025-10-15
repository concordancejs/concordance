'use strict'

const constants = require('../constants')
const ObjectFormatter = require('../formatUtils').ObjectFormatter
const getObjectKeys = require('../getObjectKeys')
const hasLength = require('../hasLength')
const stats = require('../metaDescriptors/stats')
const recursorUtils = require('../recursorUtils')

const DEEP_EQUAL = constants.DEEP_EQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL
const UNEQUAL = constants.UNEQUAL

function describe (props) {
  const isArray = props.stringTag === 'Array'
  const object = props.value
  return new DescribedObjectValue(Object.assign({
    isArray,
    isIterable: object[Symbol.iterator] !== undefined,
    isList: isArray || hasLength(object),
  }, props))
}
exports.describe = describe

function deserialize (state, recursor) {
  return new DeserializedObjectValue(state, recursor)
}
exports.deserialize = deserialize

const tag = Symbol('ObjectValue')
exports.tag = tag

class ObjectValue {
  constructor (props) {
    this.ctor = props.ctor
    this.pointer = props.pointer
    this.stringTag = props.stringTag

    this.isArray = props.isArray === true
    this.isIterable = props.isIterable === true
    this.isList = props.isList === true
  }

  compare (expected) {
    if (this.tag !== expected.tag) return UNEQUAL
    if (this.stringTag !== expected.stringTag || !this.hasSameCtor(expected)) return UNEQUAL
    return SHALLOW_EQUAL
  }

  hasSameCtor (expected) {
    return this.ctor === expected.ctor
  }

  formatShallow (theme, indent) {
    return new ObjectFormatter(this, theme, indent)
  }

  serialize () {
    return [
      this.ctor, this.pointer, this.stringTag,
      this.isArray, this.isIterable, this.isList,
    ]
  }
}
Object.defineProperty(ObjectValue.prototype, 'isComplex', { value: true })
Object.defineProperty(ObjectValue.prototype, 'tag', { value: tag })
exports.ObjectValue = ObjectValue

const DescribedObjectValue = DescribedMixin(ObjectValue)
const DeserializedObjectValue = DeserializedMixin(ObjectValue)

const recursorQueue = [
  // Prioritize recursing lists
  function createListRecursor (desc) {
    const replay = recursorUtils.replay(desc.listState, () => desc.createListRecursor())
    desc.listState = replay.state
    const recursor = replay.recursor
    if (recursor === recursorUtils.NOOP_RECURSOR) return [null, null]
    return [recursor, stats.describeListRecursor(recursor)]
  },
  function createPropertyRecursor (desc) {
    const replay = recursorUtils.replay(desc.propertyState, () => desc.createPropertyRecursor())
    desc.propertyState = replay.state
    const recursor = replay.recursor
    if (recursor === recursorUtils.NOOP_RECURSOR) return [null, null]
    return [recursor, stats.describePropertyRecursor(recursor)]
  },
  function createIterableRecursor (desc) {
    const replay = recursorUtils.replay(desc.iterableState, () => desc.createIterableRecursor())
    desc.iterableState = replay.state
    const recursor = replay.recursor
    if (recursor === recursorUtils.NOOP_RECURSOR) return [null, null]
    return [recursor, stats.describeIterableRecursor(recursor)]
  },
]

function DescribedMixin (base) {
  return class extends base {
    constructor (props) {
      super(props)

      this.value = props.value
      this.describeAny = props.describeAny
      this.describeItem = props.describeItem
      this.describeMapEntry = props.describeMapEntry
      this.describeProperty = props.describeProperty

      this.iterableState = null
      this.listState = null
      this.propertyState = null
    }

    compare (expected) {
      return this.value === expected.value
        ? DEEP_EQUAL
        : super.compare(expected)
    }

    createPropertyRecursor () {
      const objectKeys = getObjectKeys(this.value, this.isList ? this.value.length : 0)
      const size = objectKeys.size
      if (size === 0) return recursorUtils.NOOP_RECURSOR

      let index = 0
      const next = () => {
        if (index === size) return null

        const key = objectKeys.keys[index++]
        return this.describeProperty(key, this.describeAny(this.value[key]))
      }

      return { size, next }
    }

    createListRecursor () {
      if (!this.isList) return recursorUtils.NOOP_RECURSOR

      const size = this.value.length
      if (size === 0) return recursorUtils.NOOP_RECURSOR

      let index = 0
      const next = () => {
        if (index === size) return null

        const current = index
        index++
        return this.describeItem(current, this.describeAny(this.value[current]))
      }

      return { size, next }
    }

    createIterableRecursor () {
      if (this.isArray || !this.isIterable) return recursorUtils.NOOP_RECURSOR

      const iterator = this.value[Symbol.iterator]()
      let first = iterator.next()

      let done = false
      let size = -1
      if (first.done) {
        if (first.value === undefined) {
          size = 0
          done = true
        } else {
          size = 1
        }
      }

      let index = 0
      const next = () => {
        if (done) return null

        while (!done) {
          const current = first || iterator.next()
          if (current === first) {
            first = null
          }
          if (current.done) {
            done = true
          }

          const item = current.value
          if (done && item === undefined) return null

          if (this.isList && this.value[index] === item) {
            index++
          } else {
            return this.describeItem(index++, this.describeAny(item))
          }
        }
      }

      return { size, next }
    }

    createRecursor () {
      let recursor = null
      let i = 0
      const nextFromObject = () => {
        const nextFromRecursor = recursor !== null ? recursor.next() : null
        if (nextFromRecursor !== null) return nextFromRecursor
        recursor = null

        while (i < recursorQueue.length) {
          const advanceRecursor = recursorQueue[i++]
          const result = advanceRecursor(this)
          recursor = result[0]
          if (recursor !== null) return result[1]
        }

        return null
      }
      return nextFromObject
    }
  }
}
exports.DescribedMixin = DescribedMixin

function DeserializedMixin (base) {
  return class extends base {
    constructor (state, recursor) {
      super({
        ctor: state[0],
        pointer: state[1],
        stringTag: state[2],
        isArray: state[3],
        isIterable: state[4],
        isList: state[5],
      })

      this.deserializedRecursor = recursor
      this.replayState = null
    }

    createRecursor () {
      if (!this.deserializedRecursor) return () => null

      const replay = recursorUtils.replay(this.replayState, () => ({ size: -1, next: this.deserializedRecursor }))
      this.replayState = replay.state
      return replay.recursor.next
    }

    hasSameCtor (expected) {
      return this.ctor === expected.ctor
    }
  }
}
exports.DeserializedMixin = DeserializedMixin
