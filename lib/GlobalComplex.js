'use strict'

const Complex = require('./Complex')

class GlobalComplex extends Complex {
  createRecursor () {
    return () => null
  }

  format () {
    return 'Global {}'
  }
}
module.exports = GlobalComplex
