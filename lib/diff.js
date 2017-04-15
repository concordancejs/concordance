'use strict'

const ExtendableError = require('es6-error')

const constants = require('./constants')
const describe = require('./describe')
const normalizeTheme = require('./normalizeTheme')
const recursorUtils = require('./recursorUtils')
const shouldCompareDeep = require('./shouldCompareDeep')
const symbolProperties = require('./symbolProperties')
const Circular = require('./Circular')

const AMBIGUOUS = constants.AMBIGUOUS
const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL

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
    this.nestInner = false
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
      lhs.isProperty === true && !collectedSymbolProperties &&
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

function diffDescriptors (lhs, rhs, options) {
  const theme = normalizeTheme(options && options.theme)

  const circular = new Circular()
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

  const baseFormatter = new Formatter()
  const formatStack = [{
    formatter: baseFormatter,
    shouldFormat: alwaysFormat
  }]
  let formatIndex = 0

  const shouldDiffDeep = result => {
    if (result === SHALLOW_EQUAL) return true
    if (!shouldCompareDeep(result, lhs, rhs)) return false

    return lhs.isProperty !== true || lhsStack[topIndex].origin.isSymbolPropertiesComparable !== true
  }

  const isCircular = descriptor => circular.has(descriptor)

  const format = (gutter, subject, lookup) => {
    const bottomFormatIndex = formatIndex
    if (!formatStack[bottomFormatIndex].shouldFormat(subject)) return

    do {
      if (subject.isComplex === true) {
        lookup.set(subject.pointer, subject)
      }

      if (subject.isPointer === true) {
        subject = lookup.get(subject.pointer)
      }

      let formatted
      if (circular.has(subject)) {
        formatted = theme.circular
      } else if (subject.format) {
        formatted = subject.format(theme, gutter, indent, innerIndent)
      }

      if (typeof formatted === 'string') {
        formatStack[formatIndex].formatter.buffer(gutter, formatted, subject)
      } else {
        const record = {
          formatter: formatted,
          origin: subject,
          recursor: subject.createRecursor
            ? subject.createRecursor()
            : null,
          restoreLevel: level,
          shouldFormat: formatted.shouldFormat || alwaysFormat
        }

        if (record.formatter.nestInner) setLevel(level + 1)
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

        const formattedRecord = record.formatter.finalize()
        if (formattedRecord !== null) {
          formatStack[formatIndex].formatter.buffer(gutter, formattedRecord, record.origin)
        }
      }
    } while (formatIndex > bottomFormatIndex)
  }

  let retval
  while (retval === undefined) {
    let result

    if (lhs.isComplex === true) {
      lhsLookup.set(lhs.pointer, lhs)
    }
    if (rhs.isComplex === true) {
      rhsLookup.set(rhs.pointer, rhs)
    }

    if (lhs.isPointer === true) {
      if (rhs.isPointer === true && lhs.compare(rhs) === DEEP_EQUAL) {
        result = DEEP_EQUAL
      } else {
        lhs = lhsLookup.get(lhs.pointer)
      }
    }
    if (rhs.isPointer === true) {
      rhs = rhsLookup.get(rhs.pointer)
    }

    if (!result) {
      result = lhs.compareDiff
        ? lhs.compareDiff(rhs, isCircular)
        : lhs.compare(rhs)
    }

    let diffDeep = false
    if (result === DEEP_EQUAL) {
      format(theme.gutters.neutral, lhs, lhsLookup)
    } else if (result === UNEQUAL || !shouldDiffDeep(result)) {
      const custom = lhs.formatDiff
        ? lhs.formatDiff(theme, rhs, indent)
        : null

      const rebalanced = custom === null && lhs.rebalanceDiff
        ? lhs.rebalanceDiff(lhsStack[topIndex].recursor, rhsStack[topIndex].recursor, rhs, compareComplexShape, isCircular)
        : null

      if (custom) {
        formatStack[formatIndex].formatter.buffer(theme.gutters.neutral, custom, lhs)
      } else if (rebalanced) {
        lhsStack[topIndex].recursor = rebalanced.recursor
        rhsStack[topIndex].recursor = rebalanced.expectedRecursor
        if (rebalanced.actualIsExtraneous === true) {
          format(theme.gutters.actualIsExtraneous, lhs, lhsLookup)
        } else if (rebalanced.multipleAreExtraneous === true) {
          for (const extraneous of rebalanced.descriptors) {
            format(theme.gutters.actualIsExtraneous, extraneous, lhsLookup)
          }
        } else if (rebalanced.expectedIsMissing === true) {
          format(theme.gutters.expectedIsMissing, rhs, rhsLookup)
        } else if (rebalanced.multipleAreMissing === true) {
          for (const missing of rebalanced.descriptors) {
            format(theme.gutters.expectedIsMissing, missing, rhsLookup)
          }
        } else if (rebalanced.isSimplyInequal === true) {
          format(theme.gutters.actualIsWrong, lhs, lhsLookup)
          format(theme.gutters.wasExpected, rhs, rhsLookup)
        } else if (rebalanced.isDeeplyInequal === true) {
          diffDeep = true
        }
      } else {
        format(theme.gutters.actualIsWrong, lhs, lhsLookup)
        format(theme.gutters.wasExpected, rhs, rhsLookup)
      }
    } else {
      diffDeep = true
    }

    if (diffDeep) {
      if (result === AMBIGUOUS && lhs.isProperty === true) {
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
        const formatted = lhs.format(theme, theme.gutters.neutral, indent, innerIndent)
        if (typeof formatted === 'string') {
          // lhs only shallow-equals rhs. The formatter must be an object so
          // differences detected while recursing can be included.
          throw new BadFormatError(lhs, rhs, formatted)
        }

        const record = {
          formatter: formatted,
          origin: lhs,
          restoreLevel: level,
          shouldFormat: formatted.shouldFormat || alwaysFormat
        }

        if (record.formatter.nestInner) setLevel(level + 1)
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
        retval = baseFormatter.finalize()
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

          const formatted = record.formatter.finalize()
          if (formatted !== null) {
            formatStack[formatIndex].formatter.buffer(theme.gutters.neutral, formatted, record.origin)
          }
        }

        if (topIndex === -1) {
          retval = baseFormatter.finalize()
        }
      } else {
        let gutter, lookup, stack, subject
        if (lhs === null) {
          gutter = theme.gutters.expectedIsMissing
          lookup = rhsLookup
          stack = rhsStack
          subject = rhs
        } else {
          gutter = theme.gutters.actualIsExtraneous
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

function diff (actual, expected, options) {
  return diffDescriptors(describe(actual), describe(expected), options)
}
exports.diff = diff
