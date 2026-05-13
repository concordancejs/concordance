const test = require('ava')

const encoder = require('../lib/encoder')

test('encode rejects unsupported state values', t => {
  const error = t.throws(() => {
    encoder.encode(1, {
      children: [],
      id: 1,
      pluginIndex: 0,
      state: {},
    }, new Map())
  }, { instanceOf: TypeError })

  t.is(error.message, 'Unexpected value with type 0xOBJECT')
})

test('decodePlugins rejects unsupported value types', t => {
  const error = t.throws(() => {
    encoder.decodePlugins(Buffer.from([0xFF]))
  }, { instanceOf: TypeError })

  t.is(error.message, 'Could not decode type 0xFF')
})
