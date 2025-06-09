import { Buffer } from 'node:buffer'
import test from 'ava'
import { UnsupportedVersion, deserialize } from '../deserialize.ts'
import { serialize } from '../serialize.ts'
import { representValue } from '../represent.ts'
import { compareRepresentations } from '../compare.ts'
import { version } from '../serialization-types.ts'

test('deserialize throws for incorrect version', (t) => {
  // Create a byte array with wrong version
  const wrongVersionBuffer = new Uint8Array([3, ...serialize(representValue(42)).slice(1)])

  const error = t.throws(() => deserialize(wrongVersionBuffer), {
    instanceOf: UnsupportedVersion,
    name: 'UnsupportedVersion',
  })
  t.is(error?.serializerVersion, 3)

  // Create a byte array where the first byte is not a CBOR integer
  const invalidBuffer = new Uint8Array([0xff, ...serialize(representValue(42)).slice(1)])
  const error2 = t.throws(() => deserialize(invalidBuffer), {
    instanceOf: UnsupportedVersion,
    name: 'UnsupportedVersion',
  })
  t.is(error2?.serializerVersion, 0xff)
})

test('deserialize handles empty byte array correctly', (t) => {
  // Should throw because there's no data
  t.throws(() => deserialize(new Uint8Array([])), { name: 'AssertionError', message: 'Bytes must not be empty' })
})

test('deserialize throws when no value is deserialized', (t) => {
  // Create a valid version byte but nothing else
  const invalidBuffer = new Uint8Array([version])
  t.throws(() => deserialize(invalidBuffer), {
    name: 'AssertionError',
    message: 'No value was deserialized',
  })
})

const serde = test.macro({
  title: (desc, value) => `deserialized ${(desc ?? '') || String(value)} is equivalent to the original`,
  exec(t, value: unknown) {
    const original = representValue(value)
    const serialized = serialize(original)
    const deserialized = deserialize(serialized)
    t.true(compareRepresentations(deserialized, original), 'the deserialized representation equals the original')

    const redeserialized = deserialize(serialize(deserialized))
    t.true(
      compareRepresentations(redeserialized, original),
      'after serializing and deserializing it again, the deserialized representation equals the original',
    )
    t.true(compareRepresentations(redeserialized, deserialized), 'deserialized representations equal each other')
  },
})

// Booleans
test('boolean true', serde, true)
test('boolean false', serde, false)

// Null
test('null', serde, null)

// Numbers
test('integer', serde, 42)
test('negative zero', serde, -0)

// String
test('string', serde, 'hello')
test('empty string', serde, '')
test('emoji string', serde, '👋🌍')

// Symbols
test('well-known symbol', serde, Symbol.iterator)
test('local symbol', serde, Symbol('test'))
test('registered symbol', serde, Symbol.for('registered'))

// Undefined
test('undefined', serde, undefined)

// BigInt
test('bigint', serde, BigInt(42))
test('large bigint', serde, 1_234_567_890_123_456_789_012_345_678_901_234_567_890n)
test('large negative bigint', serde, -1_234_567_890_123_456_789_012_345_678_901_234_567_890n)

// Edge case number values (consolidating duplicate tests)
test('NaN', serde, Number.NaN)
test('Infinity', serde, Infinity)
test('-Infinity', serde, -Infinity)
test('-0x80 (int8)', serde, -0x80)
test('0x7F (int8)', serde, 0x7f)
test('-0x8000000000 (int40)', serde, -0x80_00_00_00_00)
test('0x7FFFFFFFFF (int40)', serde, 0x7f_ff_ff_ff_ff)
test('Number.MIN_VALUE', serde, Number.MIN_VALUE)
test('Number.MAX_VALUE', serde, Number.MAX_VALUE)
test('0.1 + 0.2 (float)', serde, 0.1 + 0.2)

// Collections
test('empty array', serde, [])
test('empty object', serde, {})
test('sparse array', serde, [1, , 3]) // eslint-disable-line no-sparse-arrays
test('map with complex key and value', serde, new Map([[{}, {}]]))
test('set with complex value', serde, new Set([{}]))

// Test objects with symbol keys
test('object with well known symbol key', serde, { [Symbol.unscopables]: 'bar' })
test('object with registered symbol key', serde, { [Symbol.for('foo')]: 'bar' })
test('object with arbitrary symbol key', serde, { [Symbol('foo')]: 'bar' })

// Date objects
test('date object', serde, new Date())

// Error objects
test('error object', serde, new Error('test error'))
test('type error', serde, new TypeError('type error'))

// Test circular references
test('object with pointer to itself', (t) => {
  const object: Record<string, unknown> = {}
  object['self'] = object

  const serialized = serialize(representValue(object))
  const deserialized = deserialize(serialized)

  t.true(compareRepresentations(deserialized, representValue(object)))
})

// Test binary data
test('binary data types are preserved', (t) => {
  const buffer = Buffer.from('decafbad'.repeat(4), 'hex')
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

  // Test several ArrayBuffer views
  const testCases: Array<[string, ArrayBuffer | ArrayBufferView]> = [
    ['ArrayBuffer', arrayBuffer],
    ['Buffer', buffer],
    ['DataView', new DataView(arrayBuffer)],
    ['Uint8Array', new Uint8Array(arrayBuffer)],
    ['Int32Array', new Int32Array(arrayBuffer)],
  ]

  for (const [name, value] of testCases) {
    const serialized = serialize(representValue(value))
    const deserialized = deserialize(serialized)

    t.true(
      compareRepresentations(deserialized, representValue(value)),
      `${name} should be preserved during serialization/deserialization`,
    )
  }
})

// Test symbol property reordering
test('symbol properties are reordered despite serialization', (t) => {
  const s1 = Symbol('s1')
  const s2 = Symbol('s2')
  const original = representValue({ [s1]: 1, [s2]: 2 })
  const expected = representValue({ [s2]: 2, [s1]: 1 })

  t.true(compareRepresentations(deserialize(serialize(original)), expected))
  t.true(compareRepresentations(deserialize(serialize(original)), deserialize(serialize(expected))))
})

// Test function representation
// eslint-disable-next-line func-names
test('function serialization', serde, function foo() {
  return 42
})

// Regular expressions
test('regexp serialization', serde, /test[a-z]+/gi)
