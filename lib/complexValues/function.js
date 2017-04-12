'use strict'

const constants = require('../constants')
const getStringTag = require('../getStringTag')
const isEnumerable = require('../isEnumerable')
const NOOP_RECURSOR = require('../recursorUtils').NOOP_RECURSOR
const object = require('./object')

const UNEQUAL = constants.UNEQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL

// Node.js 4 provides Function, more recent versions use GeneratorFunction
const generatorsHaveGeneratorTag = getStringTag(function * () {}) === 'GeneratorFunction'

function describe (props) {
  const fn = props.value
  return new DescribedFunctionValue(Object.assign({
    nameIsEnumerable: isEnumerable(fn, 'name'),
    name: typeof fn.name === 'string' ? fn.name : null
  }, props))
}
exports.describe = describe

function deserialize (state, recursor) {
  return new DeserializedFunctionValue(state, recursor)
}
exports.deserialize = deserialize

const tag = Symbol('FunctionValue')
exports.tag = tag

class FunctionValue extends object.ObjectValue {
  constructor (props) {
    super(props)
    this.name = props.name
  }

  format (gutter, indent, innerIndent) {
    return super.format(gutter, indent, innerIndent).customize({
      finalize: inner => {
        const prefix = `${this.stringTag}${this.name ? ` ${this.name}` : ''}`
        if (inner === '') return prefix

        return `${prefix} {${inner}\n${gutter}${indent}}`
      },

      shouldFormat (subject) {
        return subject.isStats !== true
      }
    })
  }

  serialize () {
    return [this.name, generatorsHaveGeneratorTag, super.serialize()]
  }
}
Object.defineProperty(FunctionValue.prototype, 'tag', { value: tag })

class DescribedFunctionValue extends object.DescribedMixin(FunctionValue) {
  constructor (props) {
    super(props)
    this.nameIsEnumerable = props.nameIsEnumerable
  }

  compare (expected) {
    if (this.tag !== expected.tag) return UNEQUAL
    if (this.name !== expected.name) return UNEQUAL
    if (this.value && expected.value && this.value !== expected.value) return UNEQUAL

    return super.compare(expected)
  }

  createPropertyRecursor () {
    const recursor = super.createPropertyRecursor()

    const skipName = this.nameIsEnumerable
    if (!skipName) return recursor

    let size = recursor.size
    if (skipName) {
      size -= 1
    }

    if (size === 0) return NOOP_RECURSOR

    const next = () => {
      const property = recursor.next()
      if (property) {
        if (skipName && property.key.value === 'name') {
          return next()
        }
        return property
      }

      return null
    }

    return { size, next }
  }
}

class DeserializedFunctionValue extends object.DeserializedMixin(FunctionValue) {
  constructor (state, recursor) {
    super(state[2], recursor)
    this.name = state[0]
    this.trustStringTag = state[1]
  }

  compare (expected) {
    if (this.tag !== expected.tag) return UNEQUAL
    if (this.name !== expected.name) return UNEQUAL

    // Assume `stringTag` is either 'Function' or 'GeneratorFunction', and that
    // it always equals `ctor`. Since Node.js 4 only provides 'Function', even
    // for generator functions, only compare `stringTag` if the serialized value
    // legitimately would have been `Function`, and the expected `stringTag` can
    // reliably be inferred.
    if (this.trustStringTag && generatorsHaveGeneratorTag && this.stringTag !== expected.stringTag) return UNEQUAL

    return SHALLOW_EQUAL
  }
}
