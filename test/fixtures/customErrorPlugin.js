'use strict'
let DescribedMixin
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
  ObjectValue = dependencies.ObjectValue
}

exports.describe = function (props) {
  const DescribedErrorValue = describe()
  return new DescribedErrorValue(props)
}

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
          return this.describeProperty('code', this.describeAny(this.value['code']))
        }
      }
    }
  }
}
