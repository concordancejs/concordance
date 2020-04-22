'use strict'
class CustomError extends Error {
  constructor (message, code) {
    super(message)
    this.code = code
    this.name = 'CustomError'
  }
}

exports.CustomError = CustomError

exports.factory = function ({ DescribedMixin, DeserializedMixin, ObjectValue }) {
  const tag = Symbol.for('customError')

  class DescribedErrorValue extends DescribedMixin(ObjectValue) {
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

  Object.defineProperty(DescribedErrorValue.prototype, 'tag', { value: tag })

  const DeserializedErrorValue = DeserializedMixin(ObjectValue)
  Object.defineProperty(DeserializedErrorValue.prototype, 'tag', { value: tag })

  return {
    describe (props) {
      return new DescribedErrorValue(props)
    },
    deserialize (state, recursor) {
      return new DeserializedErrorValue(state, recursor)
    },
    tag,
  }
}
