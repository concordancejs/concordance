'use strict'

const fastDiff = require('fast-diff')
const keyword = require('esutils').keyword

const constants = require('../constants')
const formatUtils = require('../formatUtils')

const DEEP_EQUAL = constants.DEEP_EQUAL
const UNEQUAL = constants.UNEQUAL

function describe (value) {
  return new StringValue(value)
}
exports.describe = describe

exports.deserialize = describe

const tag = Symbol('StringValue')
exports.tag = tag

// TODO: Escape invisible characters (e.g. zero-width joiner, non-breaking space),
// ambiguous characters (other kinds of spaces, combining characters). Use
// http://graphemica.com/blocks/control-pictures where applicable.
function basicEscape (string) {
  return string.replace(/\\/g, '\\\\')
}

const CRLF_CONTROL_PICTURE = '\u240D\u240A'
const LF_CONTROL_PICTURE = '\u240A'
const CR_CONTROL_PICTURE = '\u240D'

const MATCH_CONTROL_PICTURES = new RegExp(`${CR_CONTROL_PICTURE}|${LF_CONTROL_PICTURE}|${CR_CONTROL_PICTURE}`, 'g')

function escapeLinebreak (string) {
  if (string === '\r\n') return CRLF_CONTROL_PICTURE
  if (string === '\n') return LF_CONTROL_PICTURE
  if (string === '\r') return CR_CONTROL_PICTURE
  return string
}

function themeControlPictures (theme, resetWrap, str) {
  return str.replace(MATCH_CONTROL_PICTURES, picture => {
    return resetWrap.close + formatUtils.wrap(theme.string.controlPicture, picture) + resetWrap.open
  })
}

function escapeBackticks (string) {
  return string.replace(/`/g, '\\`')
}

const MATCH_SINGLE_QUOTE = /'/g
const MATCH_DOUBLE_QUOTE = /"/g
function escapeQuotes (theme, string) {
  const quote = theme.string.line.escapeQuote
  const regexp = quote === '\''
    ? MATCH_SINGLE_QUOTE
    : MATCH_DOUBLE_QUOTE
  return string.replace(regexp, '\\' + quote)
}

function includesLinebreaks (string) {
  return string.includes('\r') || string.includes('\n')
}

function diffLine (theme, actualString, expectedString, lastOfActual, lastOfExpected) {
  const outcome = fastDiff(actualString, expectedString)

  // TODO: Compute when line is mostly unequal (80%? 90%?) and treat it as being
  // completely unequal.
  const isPartiallyEqual = !(
    (outcome.length === 2 && outcome[0][1] === actualString && outcome[1][1] === expectedString) ||
    // Discount line ending control pictures, which will be equal even when the
    // rest of the line isn't.
    (
      outcome.length === 3 &&
      outcome[2][0] === fastDiff.EQUAL &&
      MATCH_CONTROL_PICTURES.test(outcome[2][1]) &&
      outcome[0][1] + outcome[2][1] === actualString &&
      outcome[1][1] + outcome[2][1] === expectedString
    )
  )

  const actual = {
    isActual: true,
    isLast: lastOfActual,
    gutter: theme.gutters.actualIsWrong,
    formatted: ''
  }
  const expected = {
    isExpected: true,
    isLast: lastOfExpected,
    gutter: theme.gutters.wasExpected,
    formatted: ''
  }

  const noopWrap = { open: '', close: '' }
  const deleteWrap = isPartiallyEqual ? theme.string.diff.delete : noopWrap
  const insertWrap = isPartiallyEqual ? theme.string.diff.insert : noopWrap
  const equalWrap = isPartiallyEqual ? theme.string.diff.equal : noopWrap
  for (const diff of outcome) {
    if (diff[0] === fastDiff.DELETE) {
      actual.formatted += formatUtils.wrap(deleteWrap, diff[1])
    } else if (diff[0] === fastDiff.INSERT) {
      expected.formatted += formatUtils.wrap(insertWrap, diff[1])
    } else {
      const str = formatUtils.wrap(equalWrap, themeControlPictures(theme, equalWrap, diff[1]))
      actual.formatted += str
      expected.formatted += str
    }
  }

  if (!isPartiallyEqual) {
    actual.formatted = formatUtils.wrap(theme.string.diff.deleteLine, actual.formatted)
    expected.formatted = formatUtils.wrap(theme.string.diff.insertLine, expected.formatted)
  }

  return { actual, expected }
}

const LINEBREAKS = /\r\n|\r|\n/g

function gatherLines (string) {
  const lines = []
  let prevIndex = 0
  for (let match; (match = LINEBREAKS.exec(string)); prevIndex = match.index + match[0].length) {
    lines.push(string.slice(prevIndex, match.index) + escapeLinebreak(match[0]))
  }
  lines.push(string.slice(prevIndex))
  return lines
}

function groupLines (theme, indent, lines) {
  const actualLines = []
  const expectedLines = []
  const otherLines = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (line.isActual === true) {
      actualLines.push({ index, line })
    } else if (line.isExpected === true) {
      expectedLines.push({ index, line })
    } else {
      otherLines.push({ index, line })
    }
  }

  const grouped = []
  do {
    for (const potential of [actualLines, expectedLines]) {
      const stopAt = otherLines.length === 0
        ? Infinity
        : otherLines[0].index
      while (potential.length > 0 && potential[0].index < stopAt) {
        const line = potential.shift().line
        grouped.push(line)
      }
    }

    while (otherLines.length > 0) {
      const current = otherLines.shift()
      grouped.push(current.line)

      if (otherLines[0] && otherLines[0].index - current.index !== 1) {
        break
      }
    }
  } while (otherLines.length > 0 || actualLines.length > 0 || expectedLines.length > 0)

  grouped[0].formatted = theme.string.multiline.open + grouped[0].formatted
  let mustPrefixExpected = grouped[0].isActual === true
  for (const line of grouped) {
    if (mustPrefixExpected && line.isExpected === true) {
      line.formatted = theme.string.multiline.open + line.formatted
      mustPrefixExpected = false
    }

    if (line.isLast === true) {
      line.formatted += theme.string.multiline.close
    }
  }
  return grouped
}

class StringValue {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    return expected.tag === tag && this.value === expected.value
      ? DEEP_EQUAL
      : UNEQUAL
  }

  format (theme, gutter, indent) {
    // Escape backslashes
    let escaped = basicEscape(this.value)

    if (!includesLinebreaks(escaped)) {
      escaped = escapeQuotes(theme, escaped)
      return formatUtils.wrap(theme.string.line, formatUtils.wrap(theme.string, escaped))
    }

    // Use a template literal if the value contains line breaks
    escaped = escapeBackticks(escaped)

    let inner = ''
    let prevIndex = 0
    for (let match; (match = LINEBREAKS.exec(escaped)); prevIndex = match.index + match[0].length) {
      inner += escaped.slice(prevIndex, match.index) + escapeLinebreak(match[0]) + '\n' + gutter + indent
    }
    inner += escaped.slice(prevIndex)
    return formatUtils.wrap(
      theme.string.multiline,
      formatUtils.wrap(
        theme.string,
        themeControlPictures(theme, theme.string, inner)))
  }

  formatAsKey (theme) {
    const key = this.value
    if (keyword.isIdentifierNameES6(key, true) || String(parseInt(key, 10)) === key) {
      return key
    }

    const escaped = basicEscape(key)
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/'/g, "\\'")
    return formatUtils.wrap(theme.string.line, formatUtils.wrap(theme.string, escaped))
  }

  formatDiff (theme, expected, indent) {
    if (expected.tag !== tag) return null

    const escapedActual = basicEscape(this.value)
    const escapedExpected = basicEscape(expected.value)

    if (!includesLinebreaks(escapedActual) && !includesLinebreaks(escapedExpected)) {
      const result = diffLine(theme, escapeQuotes(theme, escapedActual), escapeQuotes(theme, escapedExpected), true, true)
      result.actual.formatted = formatUtils.wrap(theme.string.line, result.actual.formatted)
      result.expected.formatted = formatUtils.wrap(theme.string.line, result.expected.formatted)
      return [result.actual, result.expected]
    }

    const actualLines = gatherLines(escapeBackticks(escapedActual), indent)
    const expectedLines = gatherLines(escapeBackticks(escapedExpected), indent)

    const lines = []
    const lastActualIndex = actualLines.length - 1
    const lastExpectedIndex = expectedLines.length - 1
    for (let actualIndex = 0, expectedIndex = 0, extraneousOffset = 0; actualIndex < actualLines.length;) {
      if (actualLines[actualIndex] === expectedLines[expectedIndex]) {
        lines.push({
          isNeutral: true,
          isLast: actualIndex === lastActualIndex && expectedIndex === lastExpectedIndex,
          gutter: theme.gutters.neutral,
          formatted: formatUtils.wrap(
            theme.string.diff.equal,
            themeControlPictures(theme, theme.string.diff.equal, actualLines[actualIndex]))
        })
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
        lines.push({
          isActual: true,
          isLast: actualIndex === lastActualIndex,
          gutter: theme.gutters.actualIsExtraneous,
          formatted: formatUtils.wrap(theme.string.diff.deleteLine, actualLines[actualIndex])
        })
        actualIndex++
        extraneousOffset++
      } else if (expectedIsMissing && !actualIsExtraneous) {
        lines.push({
          isExpected: true,
          isLast: expectedIndex === lastExpectedIndex,
          gutter: theme.gutters.expectedIsMissing,
          formatted: formatUtils.wrap(theme.string.diff.insertLine, expectedLines[expectedIndex])
        })
        expectedIndex++
      } else {
        const result = diffLine(
          theme,
          actualLines[actualIndex],
          expectedLines[expectedIndex],
          actualIndex === lastActualIndex,
          expectedIndex === lastExpectedIndex
        )
        lines.push(result.actual, result.expected)
        actualIndex++
        expectedIndex++
      }
    }

    return groupLines(theme, indent, lines)
  }

  serialize () {
    return this.value
  }
}
Object.defineProperty(StringValue.prototype, 'isPrimitive', { value: true })
Object.defineProperty(StringValue.prototype, 'tag', { value: tag })
