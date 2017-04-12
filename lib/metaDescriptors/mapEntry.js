'use strict'

const constants = require('../constants')
const recursorUtils = require('../recursorUtils')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL

function describe (key, value, describePrimitive, describeComplex) {
  const primitiveKey = describePrimitive(key)
  const keyIsPrimitive = primitiveKey !== null
  const keyDescriptor = primitiveKey || describeComplex(key)

  const primitiveValue = describePrimitive(value)
  const valueIsPrimitive = primitiveValue !== null
  const valueDescriptor = primitiveValue || describeComplex(value)

  return new MapEntry(keyDescriptor, valueDescriptor, keyIsPrimitive, valueIsPrimitive)
}
exports.describe = describe

function deserialize (state, recursor) {
  const keyIsPrimitive = state[0]
  const valueIsPrimitive = state[1]
  const keyDescriptor = recursor()
  const valueDescriptor = recursor()

  return new MapEntry(keyDescriptor, valueDescriptor, keyIsPrimitive, valueIsPrimitive)
}
exports.deserialize = deserialize

const tag = Symbol('MapEntry')
exports.tag = tag

function stripKeyGutter (keyLines, gutter) {
  // There is no gutter on the first line.
  if (keyLines.length === 1) return keyLines

  const offset = gutter.length
  return keyLines.slice(1).reduce((acc, line) => {
    acc.push(line.slice(offset))
    return acc
  }, [keyLines[0]])
}

function prefixMultilineKey (keyLines, group) {
  const gutter = group.gutter
  const value = group.formatted
  let formatted = keyLines[0]
  for (let index = 1; index < keyLines.length; index++) {
    formatted += `\n${gutter}${keyLines[index]}`
  }
  formatted += ` => ${value}`
  return { gutter, formatted }
}

function prefixValueDiff (keyLines, valueDiff) {
  // Keys can be primitives and complex objects. Either can contain line
  // breaks (think primitive strings or objects with properties). Prefix the
  // value diff with the entire key.
  return [
    prefixMultilineKey(keyLines, valueDiff[0]),
    prefixMultilineKey(keyLines, valueDiff[1])
  ]
}

class MapEntry {
  constructor (key, value, keyIsPrimitive, valueIsPrimitive) {
    this.key = key
    this.value = value
    this.keyIsPrimitive = keyIsPrimitive
    this.valueIsPrimitive = valueIsPrimitive
  }

  createRecursor () {
    let emitKey = true
    let emitValue = true

    return () => {
      if (emitKey) {
        emitKey = false
        return this.key
      }

      if (emitValue) {
        emitValue = false
        return this.value
      }

      return null
    }
  }

  compare (expected) {
    if (this.tag !== expected.tag) return UNEQUAL
    if (this.keyIsPrimitive !== expected.keyIsPrimitive) return UNEQUAL
    if (this.valueIsPrimitive !== expected.valueIsPrimitive) return UNEQUAL

    if (!this.keyIsPrimitive) return SHALLOW_EQUAL

    const keyResult = this.key.compare(expected.key)
    if (keyResult !== DEEP_EQUAL) return keyResult

    if (!this.valueIsPrimitive) return SHALLOW_EQUAL
    return this.value.compare(expected.value)
  }

  compareDiff (expected) {
    if (this.tag !== expected.tag) return UNEQUAL
    // Primitive keys can be compared without recursion. Avoid having to
    // rebalance entries with the same primitive key.
    if (this.keyIsPrimitive && expected.keyIsPrimitive) return this.compare(expected)

    // Force the entries to be compared through rebalancing.
    return UNEQUAL
  }

  format (_, indent) {
    let key, keyGutter
    const values = []
    return {
      buffer: (innerGutter, formatted, origin) => {
        if (origin === this.key) {
          key = formatted
          keyGutter = innerGutter
        } else {
          values.push({ gutter: innerGutter, formatted })
        }
      },
      finalize () {
        if (values.length === 1) return `${key} => ${values[0].formatted},`

        // Entries may have equal (complex) keys, but unequal complex values.
        // This may result in both the actual and the expected formatted values
        // being buffered. The gutter for each value needs to be placed before
        // the key. Unfortunately that needs to happen in MapValue. Prefix
        // each value with the key, then rely on MapValue to correctly format
        // both occurrences of the entry with the appropriate gutter.
        //
        // Multi-line keys may include gutters. Strip them first.
        const keyLines = stripKeyGutter(key.split('\n'), keyGutter)
        const prefixed = prefixValueDiff(keyLines, values)
        prefixed[0].formatted += ','
        prefixed[1].formatted += ','
        return prefixed
      }
    }
  }

  formatDiff (expected, gutters, indent) {
    // Verify a diff can be formatted.
    if (this.tag !== expected.tag) return null
    if (!this.value.formatDiff) return null
    if (!this.keyIsPrimitive || !expected.keyIsPrimitive || this.key.compare(expected.key) !== DEEP_EQUAL) {
      return null
    }

    const valueDiff = this.value.formatDiff(expected.value, gutters, indent)
    if (!valueDiff) return null

    const keyLines = this.key.format('', indent, '').split('\n')
    const prefixed = prefixValueDiff(keyLines, valueDiff)
    prefixed[1].formatted += ','
    return prefixed
  }

  rebalanceDiff (recursor, expectedRecursor, expected, compareComplexShape) {
    const actualFork = recursorUtils.fork(recursor)
    const expectedFork = recursorUtils.fork(expectedRecursor)
    const initialExpected = expected

    let expectedIsMissing = false
    while (!expectedIsMissing && expected !== null && this.tag === expected.tag) {
      if (expected.keyIsPrimitive) {
        expectedIsMissing = this.key.compare(expected.key) !== UNEQUAL
      } else {
        expectedIsMissing = compareComplexShape(this.key, expected.key) !== UNEQUAL
      }

      expected = expectedFork.shared()
    }

    let actualIsExtraneous = false
    if (this.tag === initialExpected.tag) {
      if (initialExpected.keyIsPrimitive) {
        let actual = this
        while (!actualIsExtraneous && actual !== null && this.tag === actual.tag) {
          if (actual.keyIsPrimitive) {
            actualIsExtraneous = initialExpected.key.compare(actual.key) === DEEP_EQUAL
          }

          actual = actualFork.shared()
        }
      } else {
        let actual = this
        while (!actualIsExtraneous && actual !== null && this.tag === actual.tag) {
          if (!actual.keyIsPrimitive) {
            actualIsExtraneous = compareComplexShape(actual.key, initialExpected.key) !== UNEQUAL
          }

          actual = actualFork.shared()
        }
      }
    }

    if (actualIsExtraneous && !expectedIsMissing) {
      return {
        actualIsExtraneous: true,
        recursor: actualFork.recursor,
        expectedRecursor: recursorUtils.unshift(expectedFork.recursor, initialExpected)
      }
    }

    if (expectedIsMissing && !actualIsExtraneous) {
      return {
        expectedIsMissing: true,
        recursor: recursorUtils.unshift(actualFork.recursor, this),
        expectedRecursor: expectedFork.recursor
      }
    }

    let isDeeplyInequal = false
    if (!this.keyIsPrimitive && !initialExpected.keyIsPrimitive) {
      if (this.valueIsPrimitive || initialExpected.valueIsPrimitive) {
        isDeeplyInequal = this.value.compare(initialExpected.value) !== UNEQUAL
      } else {
        isDeeplyInequal = compareComplexShape(this.value, initialExpected.value) !== UNEQUAL
      }
    }

    return {
      isDeeplyInequal,
      isSimplyInequal: !isDeeplyInequal,
      recursor: actualFork.recursor,
      expectedRecursor: expectedFork.recursor
    }
  }

  serialize () {
    return [this.keyIsPrimitive, this.valueIsPrimitive]
  }
}
Object.defineProperty(MapEntry.prototype, 'tag', { value: tag })
