import { Buffer } from 'node:buffer'
import test from 'ava'
import { UnsupportedVersion, deserialize, fullyDeserialize } from '../deserialize.ts'
import { serialize } from '../serialize.ts'
import { representValue } from '../represent.ts'
import { compareRepresentations } from '../compare.ts'
import { staticTypeTable, version } from '../serialization-types.ts'
import { Decoder } from '../decoder.ts'
import { DeserializationContext } from '../deserialization-context.ts'
import { StringRepresentation } from '../values/primitives/string.ts'
import { strictlyEqual } from '../comparison.ts'
import { Encoder } from '../encoder.ts'

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
test('bigint', serde, 42n)
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
  object.self = object

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

// Test fullyDeserialize
// Helper to create sequential encoded data with nested structure followed by a simple value
function createSequentialEncodedData() {
  const encoder = new Encoder()

  // First value: Complex nested object that requires full deserialization
  encoder
    .staticType(staticTypeTable.object)
    .annotations({ p: 1 })
    // Named property: 'nested'
    .staticType(staticTypeTable.namedPropertyAspect)
    .string('nested')
    // Value: Another object
    .staticType(staticTypeTable.object)
    .annotations({ p: 2 })
    // Named property: 'items'
    .staticType(staticTypeTable.namedPropertyAspect)
    .string('items')
    // Value: Array with multiple elements
    .staticType(staticTypeTable.array)
    .annotations({ p: 3 })
    // Element 0
    .staticType(staticTypeTable.elementAspect)
    .staticType(staticTypeTable.string)
    .string('first')
    // Element 1
    .staticType(staticTypeTable.elementAspect)
    .staticType(staticTypeTable.string)
    .string('second')
    .staticType(staticTypeTable.terminator) // End array
    .staticType(staticTypeTable.terminator) // End nested object
    .staticType(staticTypeTable.terminator) // End root object

  // Second value: Simple string that should only be readable after full deserialization
  encoder.staticType(staticTypeTable.string).string('MARKER_AFTER_NESTED')

  // Third value: Another marker to test WeakSet behavior
  encoder.staticType(staticTypeTable.string).string('SECOND_MARKER')

  return encoder.bytes
}

test('fullyDeserialize advances decoder to next value in sequence', (t) => {
  const bytes = createSequentialEncodedData()
  const decoder = new Decoder(bytes)
  const context = new DeserializationContext(decoder)

  // Read the first complex nested object but don't fully deserialize it yet
  const nestedRepresentation = context.next()!
  t.true(nestedRepresentation.deserialized, 'Should be deserialized')

  // At this point, decoder should NOT be able to read the marker string
  // because it hasn't fully processed the nested structure
  t.true(decoder.hasNext(), 'Decoder should have more data')

  // Now fully deserialize the nested representation
  // This should cause the decoder to process all nested children
  fullyDeserialize(nestedRepresentation)

  // After full deserialization, decoder should be positioned at the marker
  t.true(decoder.hasNext(), 'Decoder should still have data after full deserialization')

  const markerRepresentation = context.next()!
  // The marker can only be read if fullyDeserialize processed all nested data
  const expectedMarker = new StringRepresentation('MARKER_AFTER_NESTED')
  t.is(
    markerRepresentation.compare(expectedMarker, 'comprehensive'),
    strictlyEqual,
    'Next value should be the marker string',
  )
})

test('fullyDeserialize returns the input representation', (t) => {
  const bytes = createSequentialEncodedData()
  const decoder = new Decoder(bytes)
  const context = new DeserializationContext(decoder)
  const representation = context.next()!
  t.is(fullyDeserialize(representation), representation, 'fullyDeserialize should return the input representation')
})

test('fullyDeserialize handles circular references without infinite loops', (t) => {
  // Create a complex object with circular reference manually in CBOR
  const encoder = new Encoder()

  // Root object with circular reference
  encoder
    .staticType(staticTypeTable.object)
    .annotations({ p: 1 })
    // Property 'name'
    .staticType(staticTypeTable.namedPropertyAspect)
    .string('name')
    .staticType(staticTypeTable.string)
    .string('root')
    // Property 'self' - this will be a pointer back to the root object
    .staticType(staticTypeTable.namedPropertyAspect)
    .string('self')
    .staticType(staticTypeTable.pointer)
    .int(1) // Points back to the root object (pointer 1)
    .staticType(staticTypeTable.terminator) // End root object

  // Add marker string
  encoder.staticType(staticTypeTable.string).string('CIRCULAR_HANDLED')

  const decoder = new Decoder(encoder.bytes)
  const context = new DeserializationContext(decoder)

  const circularRepresentation = context.next()!

  // This should not throw or hang due to circular references - the stack protects against infinite loops
  t.notThrows(() => {
    fullyDeserialize(circularRepresentation)
  })

  // Decoder should be positioned at marker
  const markerRepresentation = context.next()!
  const expectedMarker = new StringRepresentation('CIRCULAR_HANDLED')
  t.is(
    markerRepresentation.compare(expectedMarker, 'comprehensive'),
    strictlyEqual,
    'Circular reference was handled correctly',
  )
})

test('fullyDeserialize does not reprocess same representation', (t) => {
  // Test that second call to fullyDeserialize on same representation doesn't advance decoder further
  const bytes = createSequentialEncodedData()
  const decoder = new Decoder(bytes)
  const context = new DeserializationContext(decoder)

  const representation = context.next()!

  // First call should process everything and advance decoder to first marker
  fullyDeserialize(representation)

  // Verify decoder advanced to first marker
  const marker1 = context.next()!
  const expectedMarker1 = new StringRepresentation('MARKER_AFTER_NESTED')
  t.is(marker1.compare(expectedMarker1, 'comprehensive'), strictlyEqual)

  // Second call to fullyDeserialize on SAME representation should use WeakSet early return
  // and NOT advance the decoder further
  fullyDeserialize(representation)

  // Decoder should still be positioned at the second marker (not advanced)
  const marker2 = context.next()!
  const expectedMarker2 = new StringRepresentation('SECOND_MARKER')
  t.is(
    marker2.compare(expectedMarker2, 'comprehensive'),
    strictlyEqual,
    'Second fullyDeserialize call should not advance decoder',
  )
})
