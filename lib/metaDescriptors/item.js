'use strict'

const constants = require('../constants')
const formatUtils = require('../formatUtils')
const recursorUtils = require('../recursorUtils')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function describeComplex (index, value) {
  return new ComplexItem(index, value)
}
exports.describeComplex = describeComplex

function deserializeComplex (index, recursor) {
  const value = recursor()
  return new ComplexItem(index, value)
}
exports.deserializeComplex = deserializeComplex

function describePrimitive (index, value) {
  return new PrimitiveItem(index, value)
}
exports.describePrimitive = describePrimitive

function deserializePrimitive (state) {
  const index = state[0]
  const value = state[1]
  return new PrimitiveItem(index, value)
}
exports.deserializePrimitive = deserializePrimitive

const complexTag = Symbol('ComplexItem')
exports.complexTag = complexTag

const primitiveTag = Symbol('PrimitiveItem')
exports.primitiveTag = primitiveTag

class ComplexItem {
  constructor (index, value) {
    this.index = index
    this.value = value
  }

  createRecursor () {
    return recursorUtils.singleValue(this.value)
  }

  compare (expected) {
    return expected.tag === complexTag && this.index === expected.index
      ? this.value.compare(expected.value)
      : UNEQUAL
  }

  formatShallow (theme, indent) {
    const increaseValueIndent = theme.item.increaseValueIndent === true
    return new formatUtils.SingleValueFormatter(theme, value => {
      if (typeof theme.item.customFormat === 'function') {
        return theme.item.customFormat(theme, indent, value)
      }

      return value.withLastPostfixed(theme.item.after)
    }, increaseValueIndent)
  }

  prepareDiff (expected, lhsRecursor, rhsRecursor, compareComplexShape, isCircular) {
    // Circular values cannot be compared. They must be treated as being unequal when diffing.
    if (isCircular(this.value) || isCircular(expected.value)) return { compareResult: UNEQUAL }

    // Try to line up this or remaining items with the expected items.
    const lhsFork = new recursorUtils.Lookahead(lhsRecursor)
    const rhsFork = new recursorUtils.Lookahead(rhsRecursor)
    const initialExpected = expected

    let expectedIsMissing = false
    while (!expectedIsMissing && expected !== null && expected.isItem === true) {
      if (expected.tag === complexTag) {
        expectedIsMissing = compareComplexShape(this.value, expected.value) !== UNEQUAL
      }

      expected = rhsFork.peek()
    }

    let actualIsExtraneous = false
    if (initialExpected.tag === complexTag) {
      let actual = this
      while (!actualIsExtraneous && actual !== null && actual.isItem === true) {
        if (actual.tag === complexTag) {
          actualIsExtraneous = compareComplexShape(actual.value, initialExpected.value) !== UNEQUAL
        }

        actual = lhsFork.peek()
      }
    } else if (initialExpected.tag === primitiveTag) {
      let actual = this
      while (!actualIsExtraneous && actual !== null && actual.isItem === true) {
        if (actual.tag === primitiveTag) {
          actualIsExtraneous = initialExpected.value.compare(actual.value) === DEEP_EQUAL
        }

        actual = lhsFork.peek()
      }
    }

    if (actualIsExtraneous && !expectedIsMissing) {
      return {
        actualIsExtraneous: true,
        lhsRecursor: lhsFork.recursor,
        rhsRecursor: recursorUtils.map(
          recursorUtils.unshift(rhsFork.recursor, initialExpected),
          next => {
            if (next.isItem !== true) return next

            next.index++
            return next
          }),
      }
    }

    if (expectedIsMissing && !actualIsExtraneous) {
      return {
        expectedIsMissing: true,
        lhsRecursor: recursorUtils.map(
          recursorUtils.unshift(lhsFork.recursor, this),
          next => {
            if (next.isItem !== true) return next

            next.index++
            return next
          }),
        rhsRecursor: rhsFork.recursor,
      }
    }

    const mustRecurse = this.tag === complexTag && initialExpected.tag === complexTag &&
      this.value.compare(initialExpected.value) !== UNEQUAL
    return {
      mustRecurse,
      isUnequal: !mustRecurse,
      lhsRecursor: lhsFork.recursor,
      rhsRecursor: rhsFork.recursor,
    }
  }

  serialize () {
    return this.index
  }
}
Object.defineProperty(ComplexItem.prototype, 'isItem', { value: true })
Object.defineProperty(ComplexItem.prototype, 'tag', { value: complexTag })

function ifItem (value) {
  return value !== null && value.isItem === true ? value : null
}

function withIndexIncrement (recurse, offset = 1) {
  return recursorUtils.map(recurse, next => {
    if (next.isItem !== true) return next

    next.index += offset
    return next
  })
}

class PrimitiveItem {
  constructor (index, value) {
    this.index = index
    this.value = value
  }

  compare (expected) {
    return expected.tag === primitiveTag && this.index === expected.index
      ? this.value.compare(expected.value)
      : UNEQUAL
  }

  formatDeep (theme, indent) {
    const increaseValueIndent = theme.item.increaseValueIndent === true
    const valueIndent = increaseValueIndent ? indent.increase() : indent

    // Since the value is formatted directly, modifiers are not applied. Apply
    // modifiers to the item descriptor instead.
    const formatted = this.value.formatDeep(theme, valueIndent)

    if (typeof theme.item.customFormat === 'function') {
      return theme.item.customFormat(theme, indent, formatted)
    }

    return formatted.withLastPostfixed(theme.item.after)
  }

  prepareDiff (expected, lhsRecursor, rhsRecursor, compareComplexShape, isCircular) {
    const compareResult = this.compare(expected)

    // Short-circuit when values are deeply equal.
    if (compareResult === DEEP_EQUAL) return { compareResult }

    // Try to line up this or remaining items with the expected items,
    // zigzagging forward to recover from insertions and/or removals (actual
    // vs. expected+, actual+ vs. expected, actual vs. expected++, actual+ vs.
    // expected+, actual++ vs. expected, etc.):
    //   actual LHS | 0 | 1 | 2 | …
    // expected RHS ===============
    //            0 | X | ⤦ | ⤦ | …
    //            1 | ↗ | ↗ | ↗ | …
    //            2 | ↗ | ↗ | ↗ | …
    //            ⋮ | ⋮ | ⋮ | ⋮ | ⋱
    const lhsBuffer = [this]
    const rhsBuffer = [expected]
    const lhsFork = new recursorUtils.Lookahead(lhsRecursor, lhsBuffer)
    const rhsFork = new recursorUtils.Lookahead(rhsRecursor, rhsBuffer)
    let lhsIdx = 0
    let rhsIdx = 0
    let lhsLen = Infinity
    let rhsLen = Infinity

    do {
      // Advance along the current diagonal, jumping to the next diagonal at its end.
      if (rhsIdx > 0) {
        rhsIdx--
        lhsIdx++
      } else {
        rhsIdx = lhsIdx + 1
        lhsIdx = 0
      }
      const lhs = lhsIdx < lhsLen ? ifItem(lhsFork.peek(lhsIdx)) : null
      const rhs = rhsIdx < rhsLen ? ifItem(rhsFork.peek(rhsIdx)) : null

      // Detect LHS/RHS length.
      if (lhs === null && lhsIdx < lhsLen) lhsLen = lhsIdx
      if (rhs === null && rhsIdx < rhsLen) rhsLen = rhsIdx

      // We can compare lhs and rhs when both are in bounds *or* both are null
      // and minimally out of bounds (to handle differences at final position).
      if ((lhsIdx >= lhsLen) !== (rhsIdx >= rhsLen)) continue
      if (lhs !== rhs && lhs.value.compare(rhs.value) !== DEEP_EQUAL) continue

      // Try to resynchronize with direct sub-diffing when insert/remove counts match.
      if (
        lhsIdx === rhsIdx &&
        expected.tag === primitiveTag &&
        expected.value.tag === this.value.tag &&
        typeof this.value.diffDeep === 'function'
      ) {
        const lhsDescriptors = lhsBuffer.splice(0, lhsIdx)
        const rhsDescriptors = rhsBuffer.splice(0, rhsIdx)
        return {
          compareResult,
          lhsDescriptors,
          rhsDescriptors,
          lhsRecursor: lhsFork.recursor,
          rhsRecursor: rhsFork.recursor,
        }
      }

      // If we resynchronized with lhsIdx at 0, at least one RHS item is missing.
      if (lhsIdx === 0) {
        const missing = rhsBuffer.splice(0, rhsIdx)
        return {
          multipleAreMissing: true,
          descriptors: missing,
          lhsRecursor: withIndexIncrement(lhsFork.recursor, missing.length),
          rhsRecursor: rhsFork.recursor,
        }
      }

      // At least one LHS item is extraneous, but reaching this point means that
      // we found a later match at which to resynchronize.
      lhsLen = lhsIdx + 1
      rhsLen = rhsIdx + 1
      break
    } while (lhsIdx < lhsLen || rhsIdx < rhsLen)

    // There might be missing RHS items, but there is definitely at least one
    // extraneous LHS item. Propagate both lists.
    const extraneousDescriptors = lhsBuffer.splice(0, lhsLen - 1)
    const missingDescriptors = rhsBuffer.splice(0, rhsLen - 1)
    return {
      multipleAreExtraneous: true,
      extraneousDescriptors,
      multipleAreMissing: true,
      missingDescriptors,
      lhsRecursor: withIndexIncrement(lhsFork.recursor, missingDescriptors.length),
      rhsRecursor: withIndexIncrement(rhsFork.recursor, extraneousDescriptors.length),
    }
  }

  diffDeep (expected, theme, indent, invert) {
    // Verify a diff can be returned.
    if (this.tag !== expected.tag || typeof this.value.diffDeep !== 'function') return null

    const increaseValueIndent = theme.property.increaseValueIndent === true
    const valueIndent = increaseValueIndent ? indent.increase() : indent

    // Since the value is diffed directly, modifiers are not applied. Apply
    // modifiers to the item descriptor instead.
    const diff = this.value.diffDeep(expected.value, theme, valueIndent, invert)
    if (diff === null) return null

    if (typeof theme.item.customFormat === 'function') {
      return theme.item.customFormat(theme, indent, diff)
    }

    return diff.withLastPostfixed(theme.item.after)
  }

  serialize () {
    return [this.index, this.value]
  }
}
Object.defineProperty(PrimitiveItem.prototype, 'isItem', { value: true })
Object.defineProperty(PrimitiveItem.prototype, 'tag', { value: primitiveTag })
