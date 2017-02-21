'use strict'

const Pointer = require('./Pointer')

class Registry {
  constructor () {
    this.counter = 0
    this.map = new WeakMap()
  }

  has (value) {
    return this.map.has(value)
  }

  get (value) {
    return this.map.get(value)
  }

  add (value) {
    const pointer = this.counter++
    this.map.set(value, new Pointer(pointer))
    return pointer
  }
}
module.exports = Registry
