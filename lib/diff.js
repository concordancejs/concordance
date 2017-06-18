'use strict'

const constants = require('./constants')
const describe = require('./describe')
const lineBuilder = require('./lineBuilder')
const recursorUtils = require('./recursorUtils')
const shouldCompareDeep = require('./shouldCompareDeep')
const symbolProperties = require('./symbolProperties')
const themeUtils = require('./themeUtils')
const Circular = require('./Circular')
const Indenter = require('./Indenter')

const AMBIGUOUS = constants.AMBIGUOUS
const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL
const SHALLOW_EQUAL = constants.SHALLOW_EQUAL
const NOOP = Symbol('NOOP')

const alwaysFormat = () => true

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
  const theme = themeUtils.normalize(options)
  const invert = options ? options.invert === true : false

  const circular = new Circular()
  const lhsLookup = new Map()
  const rhsLookup = new Map()
  const maxDepth = (options && options.maxDepth) || 0

  let indent = new Indenter(0, '  ')

  const lhsStack = []
  const rhsStack = []
  let topIndex = -1

  const buffer = lineBuilder.buffer()
  const diffStack = []
  let diffIndex = -1

  const isCircular = descriptor => circular.has(descriptor)

  const format = (builder, subject, lookup) => {
    if (diffIndex >= 0 && !diffStack[diffIndex].shouldFormat(subject)) return

    if (circular.has(subject)) {
      diffStack[diffIndex].formatter.append(builder.single(theme.circular))
      return
    }

    const formatStack = []
    let formatIndex = -1

    do {
      if (subject.isComplex === true) {
        lookup.set(subject.pointer, subject)
      }

      const origin = subject
      if (subject.isPointer === true) {
        subject = lookup.get(subject.pointer)
      }

      if (circular.has(subject)) {
        formatStack[formatIndex].formatter.append(builder.single(theme.circular), origin)
      } else {
        let didFormat = false
        if (typeof subject.formatDeep === 'function') {
          let formatted = subject.formatDeep(themeUtils.applyModifiers(subject, theme), indent)
          if (formatted !== null) {
            didFormat = true

            if (formatIndex === -1) {
              formatted = builder.setDefaultGutter(formatted)
              if (diffIndex === -1) {
                buffer.append(formatted)
              } else {
                diffStack[diffIndex].formatter.append(formatted, origin)
              }
            } else {
              formatStack[formatIndex].formatter.append(formatted, origin)
            }
          }
        }

        if (!didFormat && typeof subject.formatShallow === 'function') {
          const formatter = subject.formatShallow(themeUtils.applyModifiers(subject, theme), indent)
          const recursor = subject.createRecursor()

          if (formatter.increaseIndent && maxDepth > 0 && indent.level === maxDepth) {
            const isEmpty = recursor() === null
            let formatted = !isEmpty && typeof formatter.maxDepth === 'function'
              ? formatter.maxDepth()
              : formatter.finalize()

            if (formatIndex === -1) {
              formatted = builder.setDefaultGutter(formatted)
              diffStack[diffIndex].formatter.append(formatted, origin)
            } else {
              formatStack[formatIndex].formatter.append(formatted, origin)
            }
          } else {
            formatStack.push({
              formatter,
              origin,
              recursor,
              decreaseIndent: formatter.increaseIndent,
              shouldFormat: formatter.shouldFormat || alwaysFormat,
              subject
            })
            formatIndex++

            if (formatter.increaseIndent) indent = indent.increase()
            circular.add(subject)
          }
        }
      }

      while (formatIndex >= 0) {
        do {
          subject = formatStack[formatIndex].recursor()
        } while (subject && !formatStack[formatIndex].shouldFormat(subject))

        if (subject) {
          break
        }

        const record = formatStack.pop()
        formatIndex--
        if (record.decreaseIndent) indent = indent.decrease()
        circular.delete(record.subject)

        let formatted = record.formatter.finalize()
        if (formatIndex === -1) {
          formatted = builder.setDefaultGutter(formatted)
          if (diffIndex === -1) {
            buffer.append(formatted)
          } else {
            diffStack[diffIndex].formatter.append(formatted, record.origin)
          }
        } else {
          formatStack[formatIndex].formatter.append(formatted, record.origin)
        }
      }
    } while (formatIndex >= 0)
  }

  do {
    if (lhs.isComplex === true) {
      lhsLookup.set(lhs.pointer, lhs)
    }
    if (rhs.isComplex === true) {
      rhsLookup.set(rhs.pointer, rhs)
    }

    let equalPointers = false
    const lhsOrigin = lhs
    if (lhs.isPointer === true) {
      if (rhs.isPointer === true && lhs.compare(rhs) === DEEP_EQUAL) {
        equalPointers = true
      } else {
        lhs = lhsLookup.get(lhs.pointer)
      }
    }
    if (rhs.isPointer === true) {
      rhs = rhsLookup.get(rhs.pointer)
    }

    let compareResult = NOOP

    let firstPassSymbolProperty = false
    if (lhs.isProperty === true) {
      compareResult = lhs.compare(rhs)
      if (compareResult === AMBIGUOUS) {
        const parent = lhsStack[topIndex].subject
        firstPassSymbolProperty = parent.isSymbolPropertiesCollector !== true && parent.isSymbolPropertiesComparable !== true
      }
    }

    let didFormat = false
    let mustRecurse = false
    if (!equalPointers && !firstPassSymbolProperty && typeof lhs.prepareDiff === 'function') {
      const lhsRecursor = topIndex === -1 ? null : lhsStack[topIndex].recursor
      const rhsRecursor = topIndex === -1 ? null : rhsStack[topIndex].recursor

      const instructions = lhs.prepareDiff(
        rhs,
        lhsRecursor,
        rhsRecursor,
        compareComplexShape,
        isCircular)

      if (instructions !== null) {
        if (topIndex >= 0) {
          if (typeof instructions.lhsRecursor === 'function') {
            lhsStack[topIndex].recursor = instructions.lhsRecursor
          }
          if (typeof instructions.rhsRecursor === 'function') {
            rhsStack[topIndex].recursor = instructions.rhsRecursor
          }
        }

        if (instructions.compareResult) {
          compareResult = instructions.compareResult
        }
        if (instructions.mustRecurse === true) {
          mustRecurse = true
        } else {
          if (instructions.actualIsExtraneous === true) {
            format(lineBuilder.actual, lhs, lhsLookup)
            didFormat = true
          } else if (instructions.multipleAreExtraneous === true) {
            for (const extraneous of instructions.descriptors) {
              format(lineBuilder.actual, extraneous, lhsLookup)
            }
            didFormat = true
          } else if (instructions.expectedIsMissing === true) {
            format(lineBuilder.expected, rhs, rhsLookup)
            didFormat = true
          } else if (instructions.multipleAreMissing === true) {
            for (const missing of instructions.descriptors) {
              format(lineBuilder.expected, missing, rhsLookup)
            }
            didFormat = true
          } else if (instructions.isUnequal === true) {
            format(lineBuilder.actual, lhs, lhsLookup)
            format(lineBuilder.expected, rhs, rhsLookup)
            didFormat = true
          } else if (!instructions.compareResult) {
            // TODO: Throw a useful, custom error
            throw new Error('Illegal result of prepareDiff()')
          }
        }
      }
    }

    if (!didFormat) {
      if (compareResult === NOOP) {
        compareResult = equalPointers
          ? DEEP_EQUAL
          : lhs.compare(rhs)
      }

      if (!mustRecurse) {
        mustRecurse = shouldCompareDeep(compareResult, lhs, rhs)
      }

      if (compareResult === DEEP_EQUAL) {
        format(lineBuilder, lhs, lhsLookup)
      } else if (mustRecurse) {
        if (compareResult === AMBIGUOUS && lhs.isProperty === true) {
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

        if (typeof lhs.diffShallow === 'function') {
          const formatter = lhs.diffShallow(rhs, themeUtils.applyModifiers(lhs, theme), indent)
          diffStack.push({
            formatter,
            origin: lhsOrigin,
            decreaseIndent: formatter.increaseIndent,
            exceedsMaxDepth: formatter.increaseIndent && maxDepth > 0 && indent.level >= maxDepth,
            shouldFormat: formatter.shouldFormat || alwaysFormat
          })
          diffIndex++

          if (formatter.increaseIndent) indent = indent.increase()
        } else if (typeof lhs.formatShallow === 'function') {
          const formatter = lhs.formatShallow(themeUtils.applyModifiers(lhs, theme), indent)
          diffStack.push({
            formatter,
            origin: lhsOrigin,
            decreaseIndent: formatter.increaseIndent,
            exceedsMaxDepth: formatter.increaseIndent && maxDepth > 0 && indent.level >= maxDepth,
            shouldFormat: formatter.shouldFormat || alwaysFormat
          })
          diffIndex++

          if (formatter.increaseIndent) indent = indent.increase()
        }

        circular.add(lhs)
        circular.add(rhs)

        lhsStack.push({ diffIndex, subject: lhs, recursor: lhs.createRecursor() })
        rhsStack.push({ diffIndex, subject: rhs, recursor: rhs.createRecursor() })
        topIndex++
      } else {
        const diffed = typeof lhs.diffDeep === 'function'
          ? lhs.diffDeep(rhs, themeUtils.applyModifiers(lhs, theme), indent)
          : null

        if (diffed === null) {
          format(lineBuilder.actual, lhs, lhsLookup)
          format(lineBuilder.expected, rhs, rhsLookup)
        } else {
          if (diffIndex === -1) {
            buffer.append(diffed)
          } else {
            diffStack[diffIndex].formatter.append(diffed, lhsOrigin)
          }
        }
      }
    }

    while (topIndex >= 0) {
      lhs = lhsStack[topIndex].recursor()
      rhs = rhsStack[topIndex].recursor()

      if (lhs !== null && rhs !== null) {
        break
      }

      if (lhs === null && rhs === null) {
        const lhsRecord = lhsStack.pop()
        const rhsRecord = rhsStack.pop()
        circular.delete(lhsRecord.subject)
        circular.delete(rhsRecord.subject)
        topIndex--

        if (lhsRecord.diffIndex === diffIndex) {
          const record = diffStack.pop()
          diffIndex--
          if (record.decreaseIndent) indent = indent.decrease()

          let formatted = record.formatter.finalize()
          if (record.exceedsMaxDepth && !formatted.hasGutter) {
            // The record exceeds the max depth, but contains no actual dif.
            // Discard the potentially deep formatting and format just the
            // original subject.
            const subject = lhsRecord.subject
            const formatter = subject.formatShallow(themeUtils.applyModifiers(subject, theme), indent)
            const isEmpty = subject.createRecursor()() === null
            formatted = !isEmpty && typeof formatter.maxDepth === 'function'
              ? formatter.maxDepth()
              : formatter.finalize()
          }

          if (diffIndex === -1) {
            buffer.append(formatted)
          } else {
            diffStack[diffIndex].formatter.append(formatted, record.origin)
          }
        }
      } else {
        let builder, lookup, stack, subject
        if (lhs === null) {
          builder = lineBuilder.expected
          lookup = rhsLookup
          stack = rhsStack
          subject = rhs
        } else {
          builder = lineBuilder.actual
          lookup = lhsLookup
          stack = lhsStack
          subject = lhs
        }

        do {
          format(builder, subject, lookup)
          subject = stack[topIndex].recursor()
        } while (subject !== null)
      }
    }
  } while (topIndex >= 0)

  return buffer.toString({diff: true, invert, theme})
}
exports.diffDescriptors = diffDescriptors

function diff (actual, expected, options) {
  return diffDescriptors(describe(actual, options), describe(expected, options), options)
}
exports.diff = diff
