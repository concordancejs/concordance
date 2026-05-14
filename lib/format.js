'use strict'

const Circular = require('./Circular')
const Indenter = require('./Indenter')
const describe = require('./describe')
const formatLimits = require('./formatLimits')
const lineBuilder = require('./lineBuilder')
const themeUtils = require('./themeUtils')

const alwaysFormat = () => true
const fixedIndent = new Indenter(0, '  ')

function formatDescriptor (subject, options) {
  const theme = themeUtils.normalize(options)
  if (subject.isPrimitive === true) {
    const formatted = subject.formatDeep(themeUtils.applyModifiers(subject, theme), fixedIndent)
    return formatted.toString({ diff: false })
  }

  const circular = new Circular()
  const maxDepth = (options && options.maxDepth) || 0
  const limits = formatLimits.createLimits(options)

  let indent = fixedIndent

  const buffer = lineBuilder.buffer()
  const stack = []
  let topIndex = -1

  do {
    if (circular.has(subject)) {
      formatLimits.append(stack[topIndex], lineBuilder.single(theme.circular), subject, theme, limits)
    } else {
      let didFormat = false
      if (typeof subject.formatDeep === 'function') {
        const formatted = subject.formatDeep(themeUtils.applyModifiers(subject, theme), indent)
        if (formatted !== null) {
          didFormat = true
          if (topIndex === -1) {
            buffer.append(formatted)
          } else {
            formatLimits.append(stack[topIndex], formatted, subject, theme, limits)
          }
        }
      }

      if (!didFormat && typeof subject.formatShallow === 'function') {
        const formatter = subject.formatShallow(themeUtils.applyModifiers(subject, theme), indent)
        const recursor = subject.createRecursor()

        if (formatter.increaseIndent && maxDepth > 0 && indent.level === maxDepth) {
          const isEmpty = recursor() === null
          const formatted = !isEmpty && typeof formatter.maxDepth === 'function'
            ? formatter.maxDepth()
            : formatter.finalize()
          formatLimits.append(stack[topIndex], formatted, subject, theme, limits)
        } else {
          stack.push({
            formatter,
            recursor,
            decreaseIndent: formatter.increaseIndent,
            shouldFormat: formatter.shouldFormat || alwaysFormat,
            limitState: formatLimits.createState(),
            subject,
          })
          topIndex++

          if (formatter.increaseIndent) indent = indent.increase()
          circular.add(subject)
        }
      }
    }

    while (topIndex >= 0) {
      do {
        subject = stack[topIndex].recursor()
      } while (subject && !stack[topIndex].shouldFormat(subject))

      if (subject) {
        break
      }

      const record = stack.pop()
      topIndex--
      if (record.decreaseIndent) indent = indent.decrease()
      circular.delete(record.subject)

      const formatted = record.formatter.finalize()
      if (topIndex === -1) {
        buffer.append(formatted)
      } else {
        formatLimits.append(stack[topIndex], formatted, record.subject, theme, limits)
      }
    }
  } while (topIndex >= 0)

  return buffer.toString({ diff: false })
}
exports.formatDescriptor = formatDescriptor

function format (value, options) {
  return formatDescriptor(describe(value, options), options)
}
exports.format = format
