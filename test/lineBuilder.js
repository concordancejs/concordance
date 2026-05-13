const test = require('ava')

const lineBuilder = require('../lib/lineBuilder')

const theme = {
  diffGutters: {
    actual: '- ',
    expected: '+ ',
    padding: '  ',
  },
}

const stringify = (lines, invert = false) => lines.toString({
  diff: true,
  invert,
  theme,
})

test('inverts gutter order when stringifying collections', t => {
  const lines = lineBuilder.buffer()
    .append(lineBuilder.actual.line('actual'))
    .append(lineBuilder.expected.line('expected'))
    .append(lineBuilder.line('same'))

  t.is(stringify(lines), '- actual\n+ expected\n  same')
  t.is(stringify(lines, true), '- expected\n+ actual\n  same')
})

test('merges multiline collections with an infix', t => {
  const actual = lineBuilder.actual.first('actual start')
    .append(lineBuilder.actual.last('actual end'))
  const expected = lineBuilder.expected.first('expected start')
    .append(lineBuilder.expected.last('expected end'))

  const merged = actual.mergeWithInfix(' -> ', expected)

  t.is(
    stringify(merged),
    '- actual start\n+ actual end -> expected start\n+ expected end',
  )
})

test('throws when merging from an empty collection', t => {
  const error = t.throws(() => {
    lineBuilder.single('value').mergeWithInfix(' -> ', lineBuilder.buffer())
  })

  t.is(error.message, 'Cannot merge, `from` is empty.')
})

test('throws when merging from lines without a first line', t => {
  const source = lineBuilder.buffer().append(lineBuilder.line('middle'))
  const error = t.throws(() => {
    lineBuilder.single('value').mergeWithInfix(' -> ', source)
  })

  t.is(error.message, 'Cannot merge, `from` has no first line.')
})

test('throws when merging after the last line has already been seen', t => {
  const target = lineBuilder.buffer()
    .append(lineBuilder.last('end'))
    .append(lineBuilder.line('after end'))
  const source = lineBuilder.single('source')

  const error = t.throws(() => {
    target.mergeWithInfix(' -> ', source)
  })

  t.is(error.message, 'Cannot merge line, the last line has already been seen.')
})

test('decomposes actual and expected first and last lines', t => {
  const lines = lineBuilder.buffer()
    .append(lineBuilder.actual.first('actual first'))
    .append(lineBuilder.expected.first('expected first'))
    .append(lineBuilder.actual.line('actual middle'))
    .append(lineBuilder.expected.line('expected middle'))
    .append(lineBuilder.actual.last('actual last'))
    .append(lineBuilder.expected.last('expected last'))

  const { first, last, remaining } = lines.decompose()

  t.is(stringify(first.actual), '- actual first')
  t.is(stringify(first.expected), '+ expected first')
  t.is(stringify(last.actual), '- actual last')
  t.is(stringify(last.expected), '+ expected last')
  t.is(stringify(remaining), '- actual middle\n+ expected middle')
})
