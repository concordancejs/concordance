'use strict'

const describe = require('./describe')
const Circular = require('./Circular')

const alwaysFormat = () => true

function formatDescriptor (subject) {
  if (subject.isPrimitive === true) return subject.format('', '', '')

  const circular = new Circular()
  const lookup = new Map()

  let level
  let indent
  let innerIndent
  const setLevel = newLevel => {
    level = newLevel
    indent = '  '.repeat(level)
    innerIndent = indent + '  '
  }
  setLevel(0)

  const stack = []
  let topIndex = -1

  let retval
  while (retval === undefined) {
    if (subject.isComplex === true) {
      lookup.set(subject.pointer, subject)
    }

    if (subject.isPointer === true) {
      subject = lookup.get(subject.pointer)
    }

    let formatted
    if (circular.has(subject)) {
      formatted = '[Circular]'
    } else if (subject.format) {
      formatted = subject.format('', indent, innerIndent)
    }

    if (typeof formatted === 'string') {
      if (topIndex === -1) {
        retval = formatted
      } else {
        stack[topIndex].formatter.buffer('', formatted, subject)
      }
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
      stack.push(record)
      topIndex++
    }

    while (retval === undefined && topIndex >= 0) {
      do {
        subject = stack[topIndex].recursor()
      } while (subject && !stack[topIndex].shouldFormat(subject))

      if (subject) {
        break
      }

      const record = stack.pop()
      topIndex--
      setLevel(record.restoreLevel)
      circular.delete(record.origin)

      const formattedRecord = record.formatter.finalize()
      if (formattedRecord !== null) {
        if (topIndex === -1) {
          retval = formattedRecord
        } else {
          stack[topIndex].formatter.buffer('', formattedRecord, record.origin)
        }
      } else {
        retval = null
      }
    }
  }

  return retval
}
exports.formatDescriptor = formatDescriptor

function format (value) {
  return formatDescriptor(describe(value))
}
exports.format = format
