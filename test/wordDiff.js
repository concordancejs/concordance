const test = require('ava')

const wordDiff = require('../lib/wordDiff')

const deleted = diffs => diffs.filter(([operation]) => operation === -1).map(([, value]) => value).join('')
const inserted = diffs => diffs.filter(([operation]) => operation === 1).map(([, value]) => value).join('')
const unchanged = diffs => diffs.filter(([operation]) => operation === 0).map(([, value]) => value).join('')

function checkReconstruction (t, actual, expected, diffs) {
  t.is(diffs.filter(([operation]) => operation !== 1).map(([, value]) => value).join(''), actual)
  t.is(diffs.filter(([operation]) => operation !== -1).map(([, value]) => value).join(''), expected)
}

test('keeps short changed words intact, including standalone words', t => {
  t.deepEqual(wordDiff('bar', 'baz'), [[-1, 'bar'], [1, 'baz']])
  const diffs = wordDiff('The color is blue', 'The colour is blue')
  t.is(deleted(diffs), 'color')
  t.is(inserted(diffs), 'colour')
})

test('refines long words alongside changed punctuation and whitespace', t => {
  const prefix = 'extraordinarilyLongIdentifierPrefix'
  const actual = `${prefix}A, red`
  const expected = `${prefix}Z;\tbed`
  const diffs = wordDiff(actual, expected)
  checkReconstruction(t, actual, expected, diffs)
  t.true(unchanged(diffs).includes(prefix))
  t.true(deleted(diffs).includes('red'))
  t.true(inserted(diffs).includes('bed'))
  t.false(deleted(diffs).includes(prefix))
  t.false(inserted(diffs).includes(prefix))
})

test('keeps the thirty-code-point boundary and handles astral letters', t => {
  const prefix = '\u{10400}'.repeat(29)
  t.deepEqual(wordDiff(`${prefix}a`, `${prefix}b`), [[-1, `${prefix}a`], [1, `${prefix}b`]])
  const longPrefix = `${prefix}\u{10400}`
  const actual = `${longPrefix}a`
  const expected = `${longPrefix}b`
  const diffs = wordDiff(actual, expected)
  checkReconstruction(t, actual, expected, diffs)
  t.is(unchanged(diffs), longPrefix)
  t.is(deleted(diffs), 'a')
  t.is(inserted(diffs), 'b')
})

test('keeps combining marks attached while refining long words', t => {
  const prefix = 'longIdentifierPrefix'.repeat(2)
  const actual = `${prefix}e\u0301`
  const expected = `${prefix}a\u0301`
  const diffs = wordDiff(actual, expected)
  checkReconstruction(t, actual, expected, diffs)
  t.is(unchanged(diffs), prefix)
  t.is(deleted(diffs), 'e\u0301')
  t.is(inserted(diffs), 'a\u0301')
})

test('preserves combining marks, whitespace, emoji and punctuation', t => {
  const actual = 'cafe\u0301 chaud\t🙂,x'
  const expected = 'caffe\u0300 chaud  🙃;x'
  const diffs = wordDiff(actual, expected)
  checkReconstruction(t, actual, expected, diffs)
  t.true(deleted(diffs).includes('cafe\u0301'))
  t.true(inserted(diffs).includes('caffe\u0300'))
})

test('preserves matching CJK characters instead of replacing whole phrases', t => {
  const actual = '我喜欢苹果'
  const expected = '我喜欢香蕉'
  const diffs = wordDiff(actual, expected)
  checkReconstruction(t, actual, expected, diffs)
  t.is(unchanged(diffs), '我喜欢')
  t.is(deleted(diffs), '苹果')
  t.is(inserted(diffs), '香蕉')
})

test('keeps neighboring Latin words atomic and CJK combining marks intact', t => {
  const latinActual = 'save設定Alpha'
  const latinExpected = 'save設定Beta'
  const mixed = wordDiff(latinActual, latinExpected)
  checkReconstruction(t, latinActual, latinExpected, mixed)
  t.is(unchanged(mixed), 'save設定')
  t.is(deleted(mixed), 'Alpha')
  t.is(inserted(mixed), 'Beta')

  const annotatedActual = '漢\u0301字'
  const annotatedExpected = '漢\u0301語'
  const annotated = wordDiff(annotatedActual, annotatedExpected)
  checkReconstruction(t, annotatedActual, annotatedExpected, annotated)
  t.is(unchanged(annotated), '漢\u0301')
  t.is(deleted(annotated), '字')
  t.is(inserted(annotated), '語')
})

test('keeps emoji modifier and ZWJ families intact as diff atoms', t => {
  const actual = 'Write 👩🏽‍💻 code with 👨‍👩‍👧'
  const expected = 'Write 👨🏽‍💻 code with 👩‍👧‍👦'
  const diffs = wordDiff(actual, expected)
  checkReconstruction(t, actual, expected, diffs)
  t.true(deleted(diffs).includes('👩🏽‍💻'))
  t.true(inserted(diffs).includes('👨🏽‍💻'))
  t.true(deleted(diffs).includes('👨‍👩‍👧'))
  t.true(inserted(diffs).includes('👩‍👧‍👦'))
  t.false(unchanged(diffs).includes('‍'))
})

test('preserves paired regional flag symbols and emoji variation selectors', t => {
  const actual = 'Shipping 🇺🇸 ❤️'
  const expected = 'Shipping 🇨🇦 💔'
  const diffs = wordDiff(actual, expected)
  checkReconstruction(t, actual, expected, diffs)
  t.true(deleted(diffs).includes('🇺🇸'))
  t.true(inserted(diffs).includes('🇨🇦'))
  t.true(deleted(diffs).includes('❤️'))
  t.true(inserted(diffs).includes('💔'))
})

test('keeps emoji subdivision tag sequences intact as diff atoms', t => {
  const england = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}'
  const scotland = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}'
  const diffs = wordDiff(`Regional ${england}`, `Regional ${scotland}`)
  checkReconstruction(t, `Regional ${england}`, `Regional ${scotland}`, diffs)
  t.is(deleted(diffs), england)
  t.is(inserted(diffs), scotland)
  t.false(unchanged(diffs).includes('\u{E0067}'))
})

test('reconstructs empty, equal and inserted lines', t => {
  for (const [actual, expected] of [['', ''], ['', 'hello'], ['hello', ''], ['same', 'same']]) {
    checkReconstruction(t, actual, expected, wordDiff(actual, expected))
  }
})

test('falls back without corrupting inputs when marker space is exhausted', t => {
  const actual = Array.from({ length: 64000 }, (_, index) => `word${index}`).join(' ')
  const expected = `${actual} extra`
  checkReconstruction(t, actual, expected, wordDiff(actual, expected))
})
