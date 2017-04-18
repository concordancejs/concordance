'use strict'

class Circular extends Set {
  add (descriptor) {
    if (descriptor.isItem !== true && descriptor.isMapEntry !== true && descriptor.isProperty !== true) {
      super.add(descriptor)
    }
    return this
  }
}
module.exports = Circular
