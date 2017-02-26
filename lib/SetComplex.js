'use strict'

const constants = require('./constants')
const Complex = require('./Complex')

const UNEQUAL = constants.UNEQUAL

class SetComplex extends Complex {
  createIterableRecursor () {
    const size = this.instance.size

    let index = 0
    let members
    const next = () => {
      if (index === size) return null

      if (!members) {
        members = Array.from(this.instance)
      }

      const value = members[index]
      return this.describeItem(index++, value)
    }

    return { size, next }
  }

  compare (expected) {
    return expected.isSetComplex !== true || this.size !== expected.size
      ? UNEQUAL
      : super.compare(expected)
  }
}
Object.defineProperty(SetComplex.prototype, 'isSetComplex', { value: true })
module.exports = SetComplex
