'use strict'

const { diffArrays } = require('diff')
const fastDiff = require('fast-diff')

function tokenize (string) {
  const tokens = string.match(/\w+|[^\w]/gu) || []
  return tokens.reduce((result, token) => {
    if (/^\w{31,}$/.test(token)) {
      for (const character of token) result.push(character)
    } else {
      result.push(token)
    }
    return result
  }, [])
}

// Keep short words atomic, but retain precise edits in long identifiers.
module.exports = (actual, expected) => diffArrays(tokenize(actual), tokenize(expected)).map(change => [
  change.added ? fastDiff.INSERT : change.removed ? fastDiff.DELETE : fastDiff.EQUAL,
  change.value.join(''),
])
