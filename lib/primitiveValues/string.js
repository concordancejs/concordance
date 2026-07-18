'use strict'

const keyword = require('esutils').keyword
const fastDiff = require('fast-diff')

const constants = require('../constants')
const formatUtils = require('../formatUtils')
const lineBuilder = require('../lineBuilder')

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

const MATCH_SINGLE_QUOTE = /'/g
const MATCH_DOUBLE_QUOTE = /"/g
const MATCH_BACKTICKS = /`/g
function escapeQuotes (line, string) {
  const quote = line.escapeQuote
  if (quote === '\'') return string.replace(MATCH_SINGLE_QUOTE, "\\'")
  if (quote === '"') return string.replace(MATCH_DOUBLE_QUOTE, '\\"')
  if (quote === '`') return string.replace(MATCH_BACKTICKS, '\\`')
  return string
}

function includesLinebreaks (string) {
  return string.includes('\r') || string.includes('\n')
}

const MATCH_WORD_DIFF_TOKEN = /[\p{ID_Continue}]+|\s+|[^\p{ID_Continue}\s]+/gu
const MATCH_WORD_DIFF_WORD = /^[\p{ID_Continue}]+$/u
const MAX_INLINE_WORD_LENGTH = 30

function tokenizeForWordDiff (string) {
  return string.match(MATCH_WORD_DIFF_TOKEN) || []
}

function encodeTokens (actual, expected) {
  const tokenToMarker = new Map()
  const markerToToken = []
  let nextMarker = 1

  function encode (string) {
    let encoded = ''

    for (const token of tokenizeForWordDiff(string)) {
      let marker = tokenToMarker.get(token)
      if (marker === undefined) {
        // Keep markers to a single UTF-16 code unit. Otherwise fast-diff could
        // match one half of a surrogate pair and corrupt the token mapping.
        if (nextMarker === 0xD800) nextMarker = 0xE000
        if (nextMarker > 0xFFFF) return null

        marker = String.fromCharCode(nextMarker++)
        tokenToMarker.set(token, marker)
        markerToToken[marker.charCodeAt(0)] = token
      }

      encoded += marker
    }

    return encoded
  }

  const encodedActual = encode(actual)
  const encodedExpected = encode(expected)
  if (encodedActual === null || encodedExpected === null) return null

  return { actual: encodedActual, expected: encodedExpected, markerToToken }
}

function decodeTokens (encoded, markerToToken) {
  const tokens = []
  for (const marker of encoded) {
    tokens.push(markerToToken[marker.charCodeAt(0)])
  }

  return tokens
}

function diffByWords (actual, expected) {
  const encoded = encodeTokens(actual, expected)
  if (encoded === null) return fastDiff(actual, expected)

  const outcome = fastDiff(encoded.actual, encoded.expected)
  const decoded = []

  for (let index = 0; index < outcome.length; index++) {
    const [operation, value] = outcome[index]
    const tokens = decodeTokens(value, encoded.markerToToken)

    // Short words should be highlighted as a unit. For a one-for-one
    // replacement involving a very long word, refine the replacement so the
    // useful character-level difference remains visible.
    const next = outcome[index + 1]
    if (
      operation === fastDiff.DELETE &&
      next !== undefined &&
      next[0] === fastDiff.INSERT &&
      tokens.length === 1 &&
      MATCH_WORD_DIFF_WORD.test(tokens[0])
    ) {
      const insertedTokens = decodeTokens(next[1], encoded.markerToToken)
      if (
        insertedTokens.length === 1 &&
        MATCH_WORD_DIFF_WORD.test(insertedTokens[0]) &&
        Math.max([...tokens[0]].length, [...insertedTokens[0]].length) > MAX_INLINE_WORD_LENGTH
      ) {
        decoded.push(...fastDiff(tokens[0], insertedTokens[0]))
        index++
        continue
      }
    }

    decoded.push([operation, tokens.join('')])
  }

  return decoded
}

function diffLine (theme, actual, expected, invert) {
  const outcome = diffByWords(actual, expected)

  // TODO: Compute when line is mostly unequal (80%? 90%?) and treat it as being
  // completely unequal.
  const isPartiallyEqual = !(
    (outcome.length === 2 && outcome[0][1] === actual && outcome[1][1] === expected) ||
    // Discount line ending control pictures, which will be equal even when the
    // rest of the line isn't.
    (
      outcome.length === 3 &&
      outcome[2][0] === fastDiff.EQUAL &&
      MATCH_CONTROL_PICTURES.test(outcome[2][1]) &&
      outcome[0][1] + outcome[2][1] === actual &&
      outcome[1][1] + outcome[2][1] === expected
    )
  )

  let stringActual = ''
  let stringExpected = ''

  const noopWrap = { open: '', close: '' }
  let deleteWrap = isPartiallyEqual ? theme.string.diff.delete : noopWrap
  let insertWrap = isPartiallyEqual ? theme.string.diff.insert : noopWrap
  const equalWrap = isPartiallyEqual ? theme.string.diff.equal : noopWrap

  if (invert) {
    [deleteWrap, insertWrap] = [insertWrap, deleteWrap]
  }

  for (const diff of outcome) {
    if (diff[0] === fastDiff.DELETE) {
      stringActual += formatUtils.wrap(deleteWrap, diff[1])
    } else if (diff[0] === fastDiff.INSERT) {
      stringExpected += formatUtils.wrap(insertWrap, diff[1])
    } else {
      const string = formatUtils.wrap(equalWrap, themeControlPictures(theme, equalWrap, diff[1]))
      stringActual += string
      stringExpected += string
    }
  }

  if (!isPartiallyEqual) {
    const deleteLineWrap = invert ? theme.string.diff.insertLine : theme.string.diff.deleteLine
    const insertLineWrap = invert ? theme.string.diff.deleteLine : theme.string.diff.insertLine

    stringActual = formatUtils.wrap(deleteLineWrap, stringActual)
    stringExpected = formatUtils.wrap(insertLineWrap, stringExpected)
  }

  return [stringActual, stringExpected]
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

class StringValue {
  constructor (value) {
    this.value = value
  }

  compare (expected) {
    return expected.tag === tag && this.value === expected.value
      ? DEEP_EQUAL
      : UNEQUAL
  }

  get includesLinebreaks () {
    return includesLinebreaks(this.value)
  }

  formatDeep (theme, indent) {
    // Escape backslashes
    let escaped = basicEscape(this.value)

    if (!this.includesLinebreaks) {
      escaped = escapeQuotes(theme.string.line, escaped)
      return lineBuilder.single(formatUtils.wrap(theme.string.line, formatUtils.wrap(theme.string, escaped)))
    }

    escaped = escapeQuotes(theme.string.multiline, escaped)
    const lineStrings = gatherLines(escaped).map(string => {
      return formatUtils.wrap(theme.string, themeControlPictures(theme, theme.string, string))
    })
    const lastIndex = lineStrings.length - 1
    const indentation = indent
    return lineBuilder.buffer()
      .append(
        lineStrings.map((string, index) => {
          if (index === 0) return lineBuilder.first(theme.string.multiline.start + string)
          if (index === lastIndex) return lineBuilder.last(indentation + string + theme.string.multiline.end)
          return lineBuilder.line(indentation + string)
        }))
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

  diffDeep (expected, theme, indent, invert) {
    if (expected.tag !== tag) return null

    const escapedActual = basicEscape(this.value)
    const escapedExpected = basicEscape(expected.value)

    if (!includesLinebreaks(escapedActual) && !includesLinebreaks(escapedExpected)) {
      const result = diffLine(theme,
        escapeQuotes(theme.string.line, escapedActual),
        escapeQuotes(theme.string.line, escapedExpected),
        invert,
      )

      return lineBuilder.actual.single(formatUtils.wrap(theme.string.line, result[0]))
        .concat(lineBuilder.expected.single(formatUtils.wrap(theme.string.line, result[1])))
    }

    const actualLines = gatherLines(escapeQuotes(theme.string.multiline, escapedActual))
    const expectedLines = gatherLines(escapeQuotes(theme.string.multiline, escapedExpected))

    const indentation = indent
    const lines = lineBuilder.buffer()
    const lastActualIndex = actualLines.length - 1
    const lastExpectedIndex = expectedLines.length - 1

    let actualBuffer = []
    let expectedBuffer = []
    let mustOpenNextExpected = false
    for (let actualIndex = 0, expectedIndex = 0, extraneousOffset = 0; actualIndex < actualLines.length;) {
      if (actualLines[actualIndex] === expectedLines[expectedIndex]) {
        lines.append(actualBuffer)
        lines.append(expectedBuffer)
        actualBuffer = []
        expectedBuffer = []

        let string = actualLines[actualIndex]
        string = themeControlPictures(theme, theme.string.diff.equal, string)
        string = formatUtils.wrap(theme.string.diff.equal, string)

        if (actualIndex === 0) {
          lines.append(lineBuilder.first(theme.string.multiline.start + string))
        } else if (actualIndex === lastActualIndex && expectedIndex === lastExpectedIndex) {
          lines.append(lineBuilder.last(indentation + string + theme.string.multiline.end))
        } else {
          lines.append(lineBuilder.line(indentation + string))
        }

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

      let actualIsExtraneous = (actualIndex - extraneousOffset) > lastExpectedIndex || expectedIndex > lastExpectedIndex
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
        const wrap = invert ? theme.string.diff.insertLine : theme.string.diff.deleteLine
        const string = formatUtils.wrap(wrap, actualLines[actualIndex])

        if (actualIndex === 0) {
          actualBuffer.push(lineBuilder.actual.first(theme.string.multiline.start + string))
          mustOpenNextExpected = true
        } else if (actualIndex === lastActualIndex) {
          actualBuffer.push(lineBuilder.actual.last(indentation + string + theme.string.multiline.end))
        } else {
          actualBuffer.push(lineBuilder.actual.line(indentation + string))
        }

        actualIndex++
        extraneousOffset++
      } else if (expectedIsMissing && !actualIsExtraneous) {
        const wrap = invert ? theme.string.diff.deleteLine : theme.string.diff.insertLine
        const string = formatUtils.wrap(wrap, expectedLines[expectedIndex])

        if (mustOpenNextExpected) {
          expectedBuffer.push(lineBuilder.expected.first(theme.string.multiline.start + string))
          mustOpenNextExpected = false
        } else if (expectedIndex === lastExpectedIndex) {
          expectedBuffer.push(lineBuilder.expected.last(indentation + string + theme.string.multiline.end))
        } else {
          expectedBuffer.push(lineBuilder.expected.line(indentation + string))
        }

        expectedIndex++
      } else {
        const result = diffLine(theme, actualLines[actualIndex], expectedLines[expectedIndex], invert)

        if (actualIndex === 0) {
          actualBuffer.push(lineBuilder.actual.first(theme.string.multiline.start + result[0]))
          mustOpenNextExpected = true
        } else if (actualIndex === lastActualIndex) {
          actualBuffer.push(lineBuilder.actual.last(indentation + result[0] + theme.string.multiline.end))
        } else {
          actualBuffer.push(lineBuilder.actual.line(indentation + result[0]))
        }

        if (mustOpenNextExpected) {
          expectedBuffer.push(lineBuilder.expected.first(theme.string.multiline.start + result[1]))
          mustOpenNextExpected = false
        } else if (expectedIndex === lastExpectedIndex) {
          expectedBuffer.push(lineBuilder.expected.last(indentation + result[1] + theme.string.multiline.end))
        } else {
          expectedBuffer.push(lineBuilder.expected.line(indentation + result[1]))
        }

        actualIndex++
        expectedIndex++
      }
    }

    lines.append(actualBuffer)
    lines.append(expectedBuffer)
    return lines
  }

  serialize () {
    return this.value
  }
}
Object.defineProperty(StringValue.prototype, 'isPrimitive', { value: true })
Object.defineProperty(StringValue.prototype, 'tag', { value: tag })
