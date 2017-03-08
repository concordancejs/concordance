'use strict'

const ExtendableError = require('es6-error')

const constants = require('./constants')
const describe = require('./describe')
const recursorUtils = require('./recursorUtils')
const shouldCompareDeep = require('./shouldCompareDeep')
const symbolProperties = require('./symbolProperties')

const AMBIGUOUS = constants.AMBIGUOUS
const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL

const GUTTER_ACTUAL = '- '
const GUTTER_EXPECTED = '+ '
const GUTTER_EXTRANEOUS = '- '
const GUTTER_MISSING = '+ '
const GUTTER_NEUTRAL = '  '

const GUTTERS = {
  actualIsExtraneous: GUTTER_EXTRANEOUS,
  actualIsWrong: GUTTER_ACTUAL,
  expectedIsMissing: GUTTER_MISSING,
  neutral: GUTTER_NEUTRAL,
  wasExpected: GUTTER_EXPECTED
}

const alwaysFormat = () => true

class BadFormatError extends ExtendableError {
  constructor (lhs, rhs, formatted) {
    super('Cannot generate diff: expected left-hand-side subject to return a formatter object')
    this.lhs = lhs
    this.rhs = rhs
    this.formatted = formatted
  }
}

class Formatter {
  constructor () {
    this.inner = ''
  }

  buffer (gutter, formatted) {
    if (typeof formatted === 'string') {
      if (this.inner !== '') {
        this.inner += '\n'
      }
      this.inner += gutter + formatted
    } else {
      for (const value of formatted) {
        if (this.inner !== '') {
          this.inner += '\n'
        }
        this.inner += value.gutter + value.formatted
      }
    }
  }

  finalize () {
    return this.inner
  }

  shouldFormat () {
    return alwaysFormat()
  }
}

function compareComplexShape (lhs, rhs) {
  let result = lhs.compare(rhs)
  if (result === DEEP_EQUAL) return DEEP_EQUAL
  if (result === UNEQUAL || !shouldCompareDeep(result, lhs, rhs)) return UNEQUAL

  let collectedSymbolProperties = false
  let lhsRecursor = lhs.createRecursor()
  let rhsRecursor = rhs.createRecursor()

  do {
    lhs = lhsRecursor()
    rhs = rhsRecursor()

    if (lhs === null && rhs === null) return SHALLOW_EQUAL
    if (lhs === null || rhs === null) return UNEQUAL

    result = lhs.compare(rhs)
    if (result === UNEQUAL) return UNEQUAL
    if (
      result === AMBIGUOUS &&
      lhs.isProperty && !collectedSymbolProperties &&
      shouldCompareDeep(result, lhs, rhs)
    ) {
      collectedSymbolProperties = true
      const lhsCollector = new symbolProperties.Collector(lhs, lhsRecursor)
      const rhsCollector = new symbolProperties.Collector(rhs, rhsRecursor)

      lhsRecursor = recursorUtils.sequence(
        lhsCollector.createRecursor(),
        recursorUtils.unshift(lhsRecursor, lhsCollector.collectAll()))
      rhsRecursor = recursorUtils.sequence(
        rhsCollector.createRecursor(),
        recursorUtils.unshift(rhsRecursor, rhsCollector.collectAll()))
    }
  } while (true)
}

function diffDescriptors (lhs, rhs) {
  const circular = new Set()
  const lhsLookup = new Map()
  const rhsLookup = new Map()

  let level
  let indent
  let innerIndent
  const setLevel = newLevel => {
    level = newLevel
    indent = '  '.repeat(level)
    innerIndent = indent + '  '
  }
  setLevel(0)

  const lhsStack = []
  const rhsStack = []
  let topIndex = -1

  const formatStack = [new Formatter()]
  let formatIndex = 0

  const shouldDiffDeep = result => {
    if (result === SHALLOW_EQUAL) return true
    if (!shouldCompareDeep(result, lhs, rhs)) return false

    return lhs.isProperty !== true || lhsStack[topIndex].origin.isSymbolPropertiesComparable !== true
  }

  const format = (gutter, subject, lookup) => {
    const bottomFormatIndex = formatIndex
    if (!formatStack[bottomFormatIndex].shouldFormat(subject)) return

    do {
      if (subject.isComplex) {
        lookup.set(subject.pointer, subject)
      }

      if (subject.isPointer) {
        subject = lookup.get(subject.pointer)
      }

      let formatted = null
      if (circular.has(subject)) {
        formatted = '[Circular]'
      } else if (subject.format) {
        formatted = subject.format(gutter, indent, innerIndent)
      }

      if (typeof formatted === 'string') {
        formatStack[formatIndex].buffer(gutter, formatted, subject)
      } else if (formatted !== null) {
        const record = Object.assign({ shouldFormat: alwaysFormat }, formatted, {
          origin: subject,
          recursor: subject.createRecursor
            ? subject.createRecursor()
            : null,
          restoreLevel: level
        })

        if (record.nestInner) setLevel(level + 1)
        circular.add(subject)
        formatStack.push(record)
        formatIndex++
      }

      while (formatIndex > bottomFormatIndex) {
        do {
          subject = formatStack[formatIndex].recursor()
        } while (subject && !formatStack[formatIndex].shouldFormat(subject))

        if (subject) {
          break
        }

        const record = formatStack.pop()
        formatIndex--
        setLevel(record.restoreLevel)
        circular.delete(record.origin)

        const formattedRecord = record.finalize()
        if (formattedRecord !== null) {
          formatStack[formatIndex].buffer(gutter, formattedRecord, record.origin)
        }
      }
    } while (formatIndex > bottomFormatIndex)
  }

  let retval
  while (retval === undefined) {
    let result

    if (lhs.isComplex) {
      lhsLookup.set(lhs.pointer, lhs)
    }
    if (rhs.isComplex) {
      rhsLookup.set(rhs.pointer, rhs)
    }

    if (lhs.isPointer) {
      if (rhs.isPointer && lhs.compare(rhs) === DEEP_EQUAL) {
        result = DEEP_EQUAL
      } else {
        lhs = lhsLookup.get(lhs.pointer)
      }
    }
    if (rhs.isPointer) {
      rhs = rhsLookup.get(rhs.pointer)
    }

    if (!result) {
      result = lhs.compareDiff
        ? lhs.compareDiff(rhs)
        : lhs.compare(rhs)
    }

    let diffDeep = false
    if (result === DEEP_EQUAL) {
      format(GUTTER_NEUTRAL, lhs, lhsLookup)
    } else if (result === UNEQUAL || !shouldDiffDeep(result)) {
      const custom = lhs.formatDiff
        ? lhs.formatDiff(rhs, GUTTERS, indent)
        : null

      const rebalanced = custom === null && lhs.rebalanceDiff
        ? lhs.rebalanceDiff(lhsStack[topIndex].recursor, rhsStack[topIndex].recursor, rhs, compareComplexShape)
        : null

      if (custom) {
        formatStack[formatIndex].buffer(GUTTER_NEUTRAL, custom, lhs)
      } else if (rebalanced) {
        lhsStack[topIndex].recursor = rebalanced.recursor
        rhsStack[topIndex].recursor = rebalanced.expectedRecursor
        if (rebalanced.actualIsExtraneous) {
          format(GUTTERS.actualIsExtraneous, lhs, lhsLookup)
        } else if (rebalanced.expectedIsMissing) {
          format(GUTTERS.expectedIsMissing, rhs, rhsLookup)
        } else if (rebalanced.isSimplyInequal) {
          format(GUTTER_ACTUAL, lhs, lhsLookup)
          format(GUTTER_EXPECTED, rhs, rhsLookup)
        } else if (rebalanced.isDeeplyInequal) {
          diffDeep = true
        }
      } else {
        format(GUTTER_ACTUAL, lhs, lhsLookup)
        format(GUTTER_EXPECTED, rhs, rhsLookup)
      }
    } else {
      diffDeep = true
    }

    if (diffDeep) {
      if (result === AMBIGUOUS && lhs.isProperty) {
        // Replace both sides by a pseudo-descriptor which collects symbol
        // properties instead.
        lhs = new symbolProperties.Collector(lhs, lhsStack[topIndex].recursor)
        rhs = new symbolProperties.Collector(rhs, rhsStack[topIndex].recursor)
        // Replace the current recursors so they can continue correctly after
        // the collectors have been "compared". This is necessary since the
        // collectors eat the first value after the last symbol property.
        lhsStack[topIndex].recursor = recursorUtils.unshift(lhsStack[topIndex].recursor, lhs.collectAll())
        rhsStack[topIndex].recursor = recursorUtils.unshift(rhsStack[topIndex].recursor, rhs.collectAll())
      }

      if (lhs.format) {
        const formatted = lhs.format(GUTTER_NEUTRAL, indent, innerIndent)
        if (formatted === null || typeof formatted === 'string') {
          // lhs only shallow-equals rhs. The formatter must be an object so
          // differences detected while recursing can be included.
          throw new BadFormatError(lhs, rhs, formatted)
        }

        const record = Object.assign({ shouldFormat: alwaysFormat }, formatted, {
          origin: lhs,
          restoreLevel: level
        })

        if (record.nestInner) setLevel(level + 1)
        formatStack.push(record)
        formatIndex++
      }

      circular.add(lhs)
      circular.add(rhs)

      lhsStack.push({ formatIndex, origin: lhs, recursor: lhs.createRecursor() })
      rhsStack.push({ formatIndex, origin: rhs, recursor: rhs.createRecursor() })
      topIndex++
    }

    do {
      if (topIndex === -1) {
        retval = formatStack[0].finalize()
        break
      }

      lhs = lhsStack[topIndex].recursor()
      rhs = rhsStack[topIndex].recursor()

      if (lhs !== null && rhs !== null) {
        break
      }

      if (lhs === null && rhs === null) {
        const lhsRecord = lhsStack.pop()
        const rhsRecord = rhsStack.pop()
        circular.delete(lhsRecord.origin)
        circular.delete(rhsRecord.origin)
        topIndex--

        if (lhsRecord.formatIndex === formatIndex) {
          const record = formatStack.pop()
          formatIndex--
          setLevel(record.restoreLevel)

          const formatted = record.finalize()
          if (formatted !== null) {
            formatStack[formatIndex].buffer(GUTTER_NEUTRAL, formatted, record.origin)
          }
        }

        if (topIndex === -1) {
          retval = formatStack[0].finalize()
        }
      } else {
        let gutter, lookup, stack, subject
        if (lhs === null) {
          gutter = GUTTER_MISSING
          lookup = rhsLookup
          stack = rhsStack
          subject = rhs
        } else {
          gutter = GUTTER_EXTRANEOUS
          lookup = lhsLookup
          stack = lhsStack
          subject = lhs
        }

        do {
          format(gutter, subject, lookup)
          subject = stack[topIndex].recursor()
        } while (subject !== null)
      }
    } while (retval === undefined && topIndex >= 0)
  }

  return retval
}
exports.diffDescriptors = diffDescriptors

function diff (actual, expected) {
  return diffDescriptors(describe(actual), describe(expected))
}
exports.diff = diff
