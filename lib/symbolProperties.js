'use strict'

const constants = require('./constants')

class Comparable {
  constructor (symbols, values) {
    this.symbols = symbols
    this.values = values
    this.ordered = new Array(symbols.size)
  }

  createRecursor () {
    const length = this.ordered.length
    let index = 0
    return () => {
      if (index === length) return null

      return this.values.get(this.ordered[index++])
    }
  }

  compare (expected) {
    if (this.symbols.size !== expected.symbols.size) return constants.UNEQUAL

    let index = 0
    for (const symbol of this.symbols) {
      if (!expected.symbols.has(symbol)) return constants.UNEQUAL

      this.ordered[index] = expected.ordered[index] = symbol
      index++
    }

    return constants.SHALLOW_EQUAL
  }
}
Object.defineProperty(Comparable.prototype, 'isSymbolPropertiesComparable', { value: true })
exports.Comparable = Comparable

class Collector {
  constructor (firstProperty, recursor) {
    this.symbols = new Set()
    this.values = new Map()
    this.recursor = recursor
    this.remainder = null

    this.collect(firstProperty)
  }

  collect (property) {
    const symbol = property.key.value
    this.symbols.add(symbol)
    this.values.set(symbol, property)
  }

  collectAll () {
    do {
      const next = this.recursor()
      if (next && next.isProperty) { // All properties will have symbol keys
        this.collect(next)
      } else {
        return next
      }
    } while (true)
  }

  createRecursor () {
    let done = false
    return () => {
      if (done) return null
      done = true
      return new Comparable(this.symbols, this.values)
    }
  }
}
Object.defineProperty(Collector.prototype, 'isSymbolPropertiesCollector', { value: true })
exports.Collector = Collector
