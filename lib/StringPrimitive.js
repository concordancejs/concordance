'use strict'

const style = require('ansi-styles')
const fastDiff = require('fast-diff')
const keyword = require('esutils').keyword

const constants = require('./constants')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

// TODO: Escape invisible characters (e.g. zero-width joiner, non-breaking space),
// ambiguous characters (other kinds of spaces, combining characters). Use
// http://graphemica.com/blocks/control-pictures where applicable.
function basicEscape (string) {
  return string.replace(/\\/g, '\\\\')
}

// TODO: Add color codes to deemphasize the linebreak
function escapeLinebreak (string) {
  if (string === '\r\n') return '\u240D\u240A'
  if (string === '\n') return '\u240A'
  if (string === '\r') return '\u240D'
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

function diffLine (actual, expected, gutters, open, close) {
  const diffResults = fastDiff(actual, expected)
  // Don't highlight if the entire line is wrong
  if (
    diffResults.length === 4 &&
    diffResults[0][0] === fastDiff.EQUAL &&
    diffResults[3][0] === fastDiff.EQUAL &&
    (open === '' || diffResults[0][1] === open) &&
    (close === '' || diffResults[3][1] === close)
  ) {
    return [
      { gutter: gutters.actualIsWrong, formatted: actual },
      { gutter: gutters.wasExpected, formatted: expected }
    ]
  }

  return diffResults.reduce((acc, result) => {
    if (result[0] === fastDiff.INSERT) {
      acc[1].formatted += style.underline.open + result[1] + style.underline.close
    } else if (result[0] === fastDiff.DELETE) {
      acc[0].formatted += style.underline.open + result[1] + style.underline.close
    } else {
      acc[0].formatted += result[1]
      acc[1].formatted += result[1]
    }
    return acc
  }, [
    { gutter: gutters.actualIsWrong, formatted: '' },
    { gutter: gutters.wasExpected, formatted: '' }
  ])
}

const LINEBREAKS = /\r\n|\r|\n/g

function gatherLines (string) {
  const lines = []
  let prevIndex = 0
  for (let match; (match = LINEBREAKS.exec(string)); prevIndex = match.index + match[0].length) {
    lines.push(string.slice(prevIndex, match.index) + escapeLinebreak(match[0]))
  }
  lines[0] = '`' + lines[0]
  lines.push(string.slice(prevIndex) + '`')
  return lines
}

function groupLines (indent, lines) {
  const actualLines = []
  const expectedLines = []
  const otherLines = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (line.actual) {
      actualLines.push({ index, line })
    } else if (line.expected) {
      expectedLines.push({ index, line })
    } else {
      otherLines.push({ index, line })
    }
  }

  const groups = []
  let remainderGroup
  do {
    for (const potential of [actualLines, expectedLines]) {
      const stopAt = otherLines.length === 0
        ? Infinity
        : otherLines[0].index
      let group = remainderGroup
      while (potential.length > 0 && potential[0].index < stopAt) {
        const line = potential.shift().line
        if (!group) {
          group = { gutter: line.gutter, formatted: line.formatted }
          groups.push(group)
        } else {
          group.formatted += `\n${line.gutter}${indent}${line.formatted}`
        }
      }
    }

    if (!remainderGroup) {
      if (groups.length <= 1) {
        const line = otherLines.shift().line
        groups.push({ gutter: line.gutter, formatted: line.formatted })
      }
      remainderGroup = groups[1] || groups[0]
    } else {
      while (otherLines.length > 0) {
        const current = otherLines.shift()
        remainderGroup.formatted += `\n${current.line.gutter}${indent}${current.line.formatted}`

        if (otherLines[0] && otherLines[0].index - current.index !== 1) {
          break
        }
      }
    }
  } while (otherLines.length > 0 || actualLines.length > 0 || expectedLines.length > 0)
  return groups
}

class StringPrimitive {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    return expected.isStringPrimitive === true && this.value === expected.value
      ? DEEP_EQUAL
      : UNEQUAL
  }

  format (gutter, indent) {
    // Escape backslashes
    let escaped = basicEscape(this.value)

    if (!includesLinebreaks(escaped)) return formatWithoutLinebreaks(escaped)

    // Use a template literal if the value contains line breaks
    escaped = escapeBackticks(escaped)

    let inner = '`'
    let prevIndex = 0
    for (let match; (match = LINEBREAKS.exec(escaped)); prevIndex = match.index + match[0].length) {
      inner += escaped.slice(prevIndex, match.index) + escapeLinebreak(match[0]) + '\n' + gutter + indent
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

  formatDiff (expected, gutters, indent) {
    if (expected.isStringPrimitive !== true) return null

    const escapedActual = basicEscape(this.value)
    const escapedExpected = basicEscape(expected.value)

    if (!includesLinebreaks(escapedActual) && !includesLinebreaks(escapedExpected)) {
      return diffLine(formatWithoutLinebreaks(escapedActual), formatWithoutLinebreaks(escapedExpected), gutters, '\'', '\'')
    }

    const actualLines = gatherLines(escapeBackticks(escapedActual), indent)
    const expectedLines = gatherLines(escapeBackticks(escapedExpected), indent)

    const lines = []
    const lastActualIndex = actualLines.length - 1
    const lastExpectedIndex = expectedLines.length - 1
    for (let actualIndex = 0, expectedIndex = 0, extraneousOffset = 0; actualIndex < actualLines.length;) {
      if (actualLines[actualIndex] === expectedLines[expectedIndex]) {
        lines.push({ gutter: gutters.neutral, formatted: actualLines[actualIndex] })
        actualIndex++
        expectedIndex++
        continue
      }

      let expectedIsMissing = false
      {
        const compare = actualLines[actualIndex]
        for (let index = expectedIndex; !expectedIsMissing && index < expectedLines.length; index++) {
          expectedIsMissing = compare === expectedLines[index]
        }
      }

      let actualIsExtraneous = (actualIndex - extraneousOffset) > lastExpectedIndex
      if (!actualIsExtraneous) {
        const compare = expectedLines[expectedIndex]
        for (let index = actualIndex; !actualIsExtraneous && index < actualLines.length; index++) {
          actualIsExtraneous = compare === actualLines[index]
        }

        if (!actualIsExtraneous && (actualIndex - extraneousOffset) === lastExpectedIndex && actualIndex < lastActualIndex) {
          actualIsExtraneous = true
        }
      }

      if (actualIsExtraneous && !expectedIsMissing) {
        lines.push({ actual: true, gutter: gutters.actualIsExtraneous, formatted: actualLines[actualIndex] })
        actualIndex++
        extraneousOffset++
      } else if (expectedIsMissing && !actualIsExtraneous) {
        lines.push({ expected: true, gutter: gutters.expectedIsMissing, formatted: expectedLines[expectedIndex] })
        expectedIndex++
      } else {
        const difference = diffLine(
          actualLines[actualIndex],
          expectedLines[expectedIndex],
          gutters,
          actualIndex === 0 ? '`' : '',
          expectedIndex === lastExpectedIndex ? '`' : ''
        )
        difference[0].actual = true
        difference[1].expected = true
        lines.push(difference[0], difference[1])
        actualIndex++
        expectedIndex++
      }
    }

    return groupLines(indent, lines)
  }
}
Object.defineProperty(StringPrimitive.prototype, 'isPrimitive', { value: true })
Object.defineProperty(StringPrimitive.prototype, 'isStringPrimitive', { value: true })
module.exports = StringPrimitive
