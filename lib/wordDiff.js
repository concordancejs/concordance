'use strict'

const fastDiff = require('fast-diff')

const MATCH_TOKEN = /[\p{ID_Continue}]+|[^\p{ID_Continue}]/gu
const IDEOGRAPHIC = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const MARK = /\p{Mark}/u
const MAX_WORD_LENGTH = 30
const EMOJI_MODIFIER = /^[\u{1F3FB}-\u{1F3FF}]$/u
const REGIONAL_INDICATOR = /^[\u{1F1E6}-\u{1F1FF}]$/u
const EMOJI_VARIATION_OR_KEYCAP = /^[\uFE0E\uFE0F\u20E3]$/u
const EMOJI_TAG = /^[\u{E0020}-\u{E007F}]$/u

// A visible emoji can span several code points, including modifier + ZWJ
// chains and two regional indicators. Do not render a diff that deletes only
// half of a single displayed grapheme. No Intl.Segmenter dependency: the
// published engine range includes Node 10, where Segmenter is unavailable.
function groupEmojiAtoms (tokens) {
  const grouped = []
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    const last = grouped[grouped.length - 1]
    if (last && (
      EMOJI_MODIFIER.test(token) ||
      EMOJI_VARIATION_OR_KEYCAP.test(token) ||
      EMOJI_TAG.test(token) ||
      (token === '\u200D' && index + 1 < tokens.length) ||
      last.endsWith('\u200D') ||
      (REGIONAL_INDICATOR.test(last) && REGIONAL_INDICATOR.test(token))
    )) {
      grouped[grouped.length - 1] += token
    } else {
      grouped.push(token)
    }
  }
  return grouped
}

function tokenize (string) {
  const tokens = []

  function emitWord (word) {
    if (!word) return
    const characters = Array.from(word)
    if (characters.length > MAX_WORD_LENGTH) {
      // Long identifier runs retain character-sensitive edits, but combining
      // marks stay attached to their base so the diff cannot split a grapheme.
      const atoms = []
      for (const character of characters) {
        if (MARK.test(character) && atoms.length) {
          atoms[atoms.length - 1] += character
        } else {
          atoms.push(character)
        }
      }
      for (const atom of atoms) tokens.push(atom)
    } else {
      tokens.push(word)
    }
  }

  for (const token of string.match(MATCH_TOKEN) || []) {
    if (!IDEOGRAPHIC.test(token)) {
      emitWord(token)
      continue
    }

    // Unlike space-delimited Latin words, short CJK sentences normally have
    // no word separators. Treat each ideograph/syllable as an atom rather than
    // deleting the entire sentence when one character changes. Preserve
    // adjacent Latin words and attach combining marks to the preceding atom.
    let word = ''
    for (const character of Array.from(token)) {
      if (IDEOGRAPHIC.test(character)) {
        emitWord(word)
        word = ''
        tokens.push(character)
      } else if (MARK.test(character) && !word && tokens.length &&
                 IDEOGRAPHIC.test(tokens[tokens.length - 1])) {
        tokens[tokens.length - 1] += character
      } else {
        word += character
      }
    }
    emitWord(word)
  }
  return groupEmojiAtoms(tokens)
}

module.exports = function wordDiff (actual, expected) {
  if (actual === expected) return fastDiff(actual, expected)

  const markers = new Map()
  const tokens = []
  let nextMarker = 1

  function encode (string) {
    let encoded = ''
    for (const token of tokenize(string)) {
      let marker = markers.get(token)
      if (marker === undefined) {
        // fast-diff operates on UTF-16: never encode an atom as a surrogate.
        if (nextMarker === 0xD800) nextMarker = 0xE000
        if (nextMarker > 0xFFFF) return null
        marker = String.fromCharCode(nextMarker++)
        markers.set(token, marker)
        tokens[marker.charCodeAt(0)] = token
      }
      encoded += marker
    }
    return encoded
  }

  const encodedActual = encode(actual)
  const encodedExpected = encode(expected)
  // Preserve a valid diff even when a line exhausts the single-unit alphabet.
  if (encodedActual === null || encodedExpected === null) return fastDiff(actual, expected)

  return fastDiff(encodedActual, encodedExpected).map(([operation, encoded]) => {
    let decoded = ''
    for (const marker of encoded) decoded += tokens[marker.charCodeAt(0)]
    return [operation, decoded]
  })
}
