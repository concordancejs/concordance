import stringEscape from 'js-string-escape'
import wellKnownSymbols from 'well-known-symbols'

import { DEEP_EQUAL, UNEQUAL } from '../constants.js'
import * as formatUtils from '../formatUtils.js'
import lineBuilder from '../lineBuilder.js'

export function describe (value) {
  let stringCompare = null

  const key = Symbol.keyFor(value)
  if (key !== undefined) {
    stringCompare = `Symbol.for(${stringEscape(key)})`
  } else if (wellKnownSymbols.isWellKnown(value)) {
    stringCompare = wellKnownSymbols.getLabel(value)
  }

  return new SymbolValue({
    stringCompare,
    value,
  })
}

export function deserialize (state) {
  const stringCompare = state[0]
  const string = state[1] || state[0]

  return new DeserializedSymbolValue({
    string,
    stringCompare,
    value: null,
  })
}

export const tag = Symbol('SymbolValue')

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

  formatString () {
    if (this.stringCompare !== null) return this.stringCompare
    return stringEscape(this.value.toString())
  }

  formatDeep (theme) {
    return lineBuilder.single(formatUtils.wrap(theme.symbol, this.formatString()))
  }

  formatAsKey (theme) {
    return formatUtils.wrap(theme.property.keyBracket, formatUtils.wrap(theme.symbol, this.formatString()))
  }

  serialize () {
    const string = this.formatString()
    return this.stringCompare === string
      ? [this.stringCompare]
      : [this.stringCompare, string]
  }

  isPrimitive = true

  tag = tag
}

class DeserializedSymbolValue extends SymbolValue {
  constructor (props) {
    super(props)
    this.string = props.string
  }

  compare (expected) {
    if (expected.tag !== tag) return UNEQUAL

    if (this.stringCompare !== null) {
      return this.stringCompare === expected.stringCompare
        ? DEEP_EQUAL
        : UNEQUAL
    }

    // Symbols that are not in the global symbol registry, and are not
    // well-known, cannot be compared when deserialized. Treat symbols
    // as equal if they are formatted the same.
    return this.string === expected.formatString()
      ? DEEP_EQUAL
      : UNEQUAL
  }

  formatString () {
    return this.string
  }
}
