'use strict'

const constants = require('../constants')
const formatUtils = require('../formatUtils')
const isEnumerable = require('../isEnumerable')
const lineBuilder = require('../lineBuilder')
const object = require('./object')

const UNEQUAL = constants.UNEQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL

function describe (props) {
  const fn = props.value
  return new DescribedFunctionValue(Object.assign({
    nameIsEnumerable: isEnumerable(fn, 'name'),
    name: typeof fn.name === 'string' ? fn.name : null,
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

  formatShallow (theme, indent) {
    const string = formatUtils.wrap(theme.function.stringTag, this.stringTag) +
      (this.name ? ' ' + formatUtils.wrap(theme.function.name, this.name) : '') +
      ' ' + theme.object.openBracket

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
      },
    })
  }
}
Object.defineProperty(FunctionValue.prototype, 'tag', { value: tag })

class DescribedFunctionValue extends object.DescribedMixin(FunctionValue) {
  compare (expected) {
    if (this.tag !== expected.tag) return UNEQUAL
    if (this.name !== expected.name) return UNEQUAL
    if (this.value && expected.value && this.value !== expected.value) return UNEQUAL

    return super.compare(expected)
  }

  serialize () {
    return [this.name, super.serialize()]
  }
}

class DeserializedFunctionValue extends object.DeserializedMixin(FunctionValue) {
  constructor (state, recursor) {
    super(state[1], recursor)
    this.name = state[0]
  }

  compare (expected) {
    if (this.tag !== expected.tag) return UNEQUAL
    if (this.name !== expected.name) return UNEQUAL
    if (this.stringTag !== expected.stringTag) return UNEQUAL

    return SHALLOW_EQUAL
  }

  serialize () {
    return [this.name, super.serialize()]
  }
}
