const test = require('ava')

const { compare, compareDescriptors, describe, deserialize, format, formatDescriptor, serialize } = require('..')

const errorWithCause = cause => Object.defineProperty(new Error('outer'), 'cause', { value: cause })

test('compares non-enumerable error causes recursively', t => {
  t.true(compare(errorWithCause(new Error('inner')), errorWithCause(new Error('inner'))).pass)
  t.false(compare(errorWithCause(new Error('inner')), errorWithCause(new Error('other'))).pass)
  t.false(compare(errorWithCause(new Error('inner')), new Error('outer')).pass)
})

test('compares falsy error causes', t => {
  for (const cause of [null, false, 0, '']) {
    t.true(compare(errorWithCause(cause), errorWithCause(cause)).pass)
    t.false(compare(errorWithCause(cause), new Error('outer')).pass)
  }
})

test('formats non-enumerable error causes', t => {
  t.is(format(errorWithCause(new Error('inner'))), [
    'Error {',
    "  message: 'outer',",
    '  cause: Error {',
    "    message: 'inner',",
    '  },',
    '}',
  ].join('\n'))
})

test('formats enumerable error causes once', t => {
  const error = Object.assign(new Error('outer'), { cause: 'inner' })
  t.is(format(error), [
    'Error {',
    "  cause: 'inner',",
    "  message: 'outer',",
    '}',
  ].join('\n'))
})

test('serializes non-enumerable and circular error causes', t => {
  const circular = new Error('circular')
  Object.defineProperty(circular, 'cause', { value: circular })

  for (const error of [errorWithCause(new Error('inner')), circular]) {
    const original = describe(error)
    const deserialized = deserialize(serialize(original))
    t.true(compareDescriptors(deserialized, original))
    t.is(formatDescriptor(deserialized), formatDescriptor(original))
  }
})
