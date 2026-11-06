const test = require('ava')

const { diff } = require('../lib/diff')
const diffWords = require('../lib/diffWords')
const { theme } = require('./_instrumentedTheme')

test('short words are atomic up to the suggested threshold', t => {
  for (const length of [1, 2, 29, 30]) {
    const actual = 'a'.repeat(length)
    const expected = 'a'.repeat(length - 1) + 'b'
    t.deepEqual(diffWords(actual, expected), [[-1, actual], [1, expected]])
  }
})

test('long identifiers retain precise edits', t => {
  const prefix = 'a'.repeat(30)
  t.deepEqual(diffWords(prefix + 'b', prefix + 'c'), [[0, prefix], [-1, 'b'], [1, 'c']])
})

test('punctuation separates words without whitespace', t => {
  t.deepEqual(diffWords('foo.cat', 'foo.car'), [[0, 'foo.'], [-1, 'cat'], [1, 'car']])
})

test('underscores and digits remain part of short words', t => {
  t.deepEqual(diffWords('foo_12', 'foo_13'), [[-1, 'foo_12'], [1, 'foo_13']])
})

test('diffs reconstruct both inputs including escapes and Unicode', t => {
  const values = [
    '', 'cat', 'car', 'cat cat', 'car cat', 'a.b', 'a_b', 'a\r\nb', "a'b", 'a\\b',
    '\uD83D\uDE00cat', '\u00E9clair', 'x'.repeat(35),
  ]
  for (const actual of values) {
    for (const expected of values) {
      const changes = diffWords(actual, expected)
      t.is(changes.filter(([operation]) => operation !== 1).map(([, text]) => text).join(''), actual)
      t.is(changes.filter(([operation]) => operation !== -1).map(([, text]) => text).join(''), expected)
    }
  }
})

test('very long identical identifiers do not overflow argument limits', t => {
  const actual = 'a'.repeat(150000)
  t.deepEqual(diffWords(actual, actual), [[0, actual]])
})

test('multiline and inverted diffs preserve whole words', t => {
  const result = diff('same\ncat\nend', 'same\ncar\nend', { theme })
  t.true(result.includes('cat'))
  t.true(result.includes('car'))
  const inverted = diff('the cat sleeps', 'the car sleeps', { theme, invert: true })
  t.true(inverted.includes('%string.diff.insert.open%cat%string.diff.insert.close%'))
  t.true(inverted.includes('%string.diff.delete.open%car%string.diff.delete.close%'))
})

test('short replacement words are not split into equal letters', t => {
  const result = diff('the cat sleeps', 'the car sleeps', { theme })
  t.true(result.includes('%string.diff.delete.open%cat%string.diff.delete.close%'))
  t.true(result.includes('%string.diff.insert.open%car%string.diff.insert.close%'))
})
