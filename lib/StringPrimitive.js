'use strict'

const keyword = require('esutils').keyword

const constants = require('./constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

// TODO: Escape invisible characters (e.g. zero-width joiner, non-breaking space),
// ambiguous characters (other kinds of spaces, combining characters).
function basicEscape (string) {
  return string.replace(/\\/g, '\\\\')
}

// TODO: Add color codes to deemphasize the linebreak
function escapeLinebreak (string) {
  if (string === '\r\n') return '<CR><LF>'
  if (string === '\n') return '<LF>'
  if (string === '\r') return '<CR>'
  return string
}

function escapeBackticks (string) {
  return string.replace(/`/g, '\\`')
}

function includesLinebreaks (string) {
  return string.includes('\r') || string.includes('\n')
}

function formatWithoutLinebreaks (string) {
  // Use a template literal if the value contains single quotes
  if (string.includes("'")) {
    return `\`${escapeBackticks(string)}\``
  }

  return `'${string}'`
}

const LINEBREAKS = /\r\n|\r|\n/g

class StringPrimitive {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    return expected.isStringPrimitive === true && this.value === expected.value
      ? DEEP_EQUAL
      : UNEQUAL
  }

  format (indent) {
    // Escape backslashes
    let escaped = basicEscape(this.value)

    if (!includesLinebreaks(escaped)) return formatWithoutLinebreaks(escaped)

    // Use a template literal if the value contains line breaks
    escaped = escapeBackticks(escaped)

    let inner = '`'
    let prevIndex = 0
    for (let match; (match = LINEBREAKS.exec(escaped)); prevIndex = match.index + match[0].length) {
      inner += escaped.slice(prevIndex, match.index) + escapeLinebreak(match[0]) + '\n' + indent
    }
    inner += escaped.slice(prevIndex) + '`'
    return inner
  }

  formatAsKey () {
    const key = this.value
    if (keyword.isIdentifierNameES6(key, true) || String(parseInt(key, 10)) === key) {
      return key
    }

    const escaped = basicEscape(key)
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/'/g, "\\'")
    return `'${escaped}'`
  }
}
Object.defineProperty(StringPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(StringPrimitive.prototype, 'isStringPrimitive', { value: true })
module.exports = StringPrimitive
