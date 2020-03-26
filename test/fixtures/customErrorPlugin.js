'use strict'
let DescribedMixin
let DeserializedMixin
let ObjectValue

class CustomError extends Error {
  constructor (message, code) {
    super(message)
    this.code = code
    this.name = 'CustomError'
  }
}

exports.CustomError = CustomError

exports.setDependencies = function (dependencies) {
  DescribedMixin = dependencies.DescribedMixin
  DeserializedMixin = dependencies.DeserializedMixin
  ObjectValue = dependencies.ObjectValue
}

exports.describe = function (props) {
  const DescribedErrorValue = describe()
  const result = new DescribedErrorValue(props)
  Object.defineProperty(result, 'tag', { value: exports.tag })
  return result
}

exports.tag = Symbol('customError')

function describe () {
  return class DescribedErrorValue extends DescribedMixin(ObjectValue) {
    createPropertyRecursor () {
      let i = 0
      return {
        size: 1,
        next: () => {
          if (i === 1) {
            return null
          }
          i++
          return this.describeProperty('code', this.describeAny(this.value.code))
        },
      }
    }
  }
}

exports.deserialize = function (state, recursor) {
  const Deserializer = DeserializedMixin(ObjectValue)
  const result = new Deserializer(state, recursor)
  Object.defineProperty(result, 'tag', { value: exports.tag })
  return result
}
