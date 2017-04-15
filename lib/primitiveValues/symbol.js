'use strict'

const wellKnownSymbols = require('well-known-symbols')

const constants = require('../constants')
const formatUtils = require('../formatUtils')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function describe (value) {
  let stringCompare = null

  const key = Symbol.keyFor(value)
  if (key !== undefined) {
    stringCompare = key
  } else if (wellKnownSymbols.isWellKnown(value)) {
    stringCompare = wellKnownSymbols.getLabel(value)
  }

  return new SymbolValue({
    stringCompare,
    value
  })
}
exports.describe = describe

function deserialize (state) {
  const stringCompare = state[0]
  const formatted = state[1] || state[0]

  return new DeserializedSymbolValue({
    formatted,
    stringCompare,
    value: null
  })
}
exports.deserialize = deserialize

const tag = Symbol('SymbolValue')
exports.tag = tag

class SymbolValue {
  constructor (props) {
    this.stringCompare = props.stringCompare
    this.value = props.value
  }

  compare (expected) {
    if (expected.tag !== tag) return UNEQUAL

    if (this.stringCompare !== null) {
      return this.stringCompare === expected.stringCompare
        ? DEEP_EQUAL
        : UNEQUAL
    }

    return this.value === expected.value
      ? DEEP_EQUAL
      : UNEQUAL
  }

  format (theme) {
    if (wellKnownSymbols.isWellKnown(this.value)) {
      return formatUtils.wrap(theme.symbol, wellKnownSymbols.getLabel(this.value))
    }

    const key = Symbol.keyFor(this.value)
    if (key !== undefined) return formatUtils.wrap(theme.symbol, `Symbol(${key})`)

    // TODO: Properly indent symbols that stringify to multiple lines
    return formatUtils.wrap(theme.symbol, this.value.toString())
  }

  formatAsKey (theme) {
    return formatUtils.wrap(theme.property.keyBracket, this.format(theme))
  }

  serialize () {
    const formatted = this.format(serializingTheme)
    return this.stringCompare === formatted
      ? [this.stringCompare]
      : [this.stringCompare, formatted]
  }
}
Object.defineProperty(SymbolValue.prototype, 'isPrimitive', { value: true })
Object.defineProperty(SymbolValue.prototype, 'tag', { value: tag })

const serializingTheme = {
  symbol: { open: '', close: '' }
}

class DeserializedSymbolValue extends SymbolValue {
  constructor (props) {
    super(props)
    this.formatted = props.formatted
  }

  compare (expected) {
    if (expected.tag !== tag) return UNEQUAL

    if (this.stringCompare !== null) {
      return this.stringCompare === expected.stringCompare
        ? DEEP_EQUAL
        : UNEQUAL
    }

    // Symbols that are not in the global symbol registry, and are not
    // well-known, cannot be compared when deserialized. Treat symbols are equal
    // if they are formatted the same.
    return this.formatted === expected.format(serializingTheme)
      ? DEEP_EQUAL
      : UNEQUAL
  }

  format (theme) {
    return formatUtils.wrap(theme.symbol, this.formatted)
  }

  serialize () {
    return this.stringCompare === this.formatted
      ? [this.stringCompare]
      : [this.stringCompare, this.formatted]
  }
}
