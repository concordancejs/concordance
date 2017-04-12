'use strict'

const constants = require('../constants')
const isEnumerable = require('../isEnumerable')
const NOOP_RECURSOR = require('../recursorUtils').NOOP_RECURSOR
const object = require('./object')

const UNEQUAL = constants.UNEQUAL

function describe (props) {
  const error = props.value
  return new DescribedErrorValue(Object.assign({
    nameIsEnumerable: isEnumerable(error, 'name'),
    name: error.name,
    messageIsEnumerable: isEnumerable(error, 'message'),
    message: error.message
  }, props))
}
exports.describe = describe

function deserialize (state, recursor) {
  return new DeserializedErrorValue(state, recursor)
}
exports.deserialize = deserialize

const tag = Symbol('ErrorValue')
exports.tag = tag

class ErrorValue extends object.ObjectValue {
  constructor (props) {
    super(props)
    this.name = props.name
  }

  compare (expected) {
    return this.tag === expected.tag && this.name === expected.name
      ? super.compare(expected)
      : UNEQUAL
  }

  format (gutter, indent, innerIndent) {
    return super.format(gutter, indent, innerIndent).customize({
      finalize: inner => {
        let prefix = ''
        const name = this.name || this.ctor
        if (name) {
          prefix += this.name
          if (this.ctor && this.ctor !== name) {
            prefix += ` (${this.ctor})`
          }
          if (this.stringTag && !this.name.includes(this.stringTag)) {
            prefix += ` @${this.stringTag}`
          }
        } else {
          prefix += this.stringTag
        }
        if (inner === '') return prefix + ' {}'

        return `${prefix} {${inner}\n${gutter}${indent}}`
      },

      shouldFormat (subject) {
        return subject.isStats !== true
      }
    })
  }

  serialize () {
    return [this.name, super.serialize()]
  }
}
Object.defineProperty(ErrorValue.prototype, 'tag', { value: tag })

class DescribedErrorValue extends object.DescribedMixin(ErrorValue) {
  constructor (props) {
    super(props)
    this.nameIsEnumerable = props.nameIsEnumerable
    this.messageIsEnumerable = props.messageIsEnumerable
    this.message = props.message
  }

  createPropertyRecursor () {
    const recursor = super.createPropertyRecursor()

    let skipName = this.nameIsEnumerable
    let emitMessage = !this.messageIsEnumerable

    let size = recursor.size
    if (skipName && size > 0) {
      size -= 1
    }
    if (emitMessage) {
      size += 1
    }

    if (size === 0) return NOOP_RECURSOR

    let done = false
    const next = () => {
      if (done) return null

      const property = recursor.next()
      if (property) {
        if (skipName && property.key.value === 'name') {
          skipName = false
          return next()
        }
        return property
      }

      if (emitMessage) {
        emitMessage = false
        return this.describeProperty('message', this.message)
      }

      done = true
      return null
    }

    return { size, next }
  }
}

class DeserializedErrorValue extends object.DeserializedMixin(ErrorValue) {
  constructor (state, recursor) {
    super(state[1], recursor)
    this.name = state[0]
  }
}
