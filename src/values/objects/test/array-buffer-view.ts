import test from 'ava'
import { RealValueContext } from '../../../real-value-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { ArrayBufferViewRepresentation } from '../array-buffer-view.ts'
import { strictlyEqual, unequal, comparable } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import type { BytesAccessor } from '../../../accessors/bytes.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

// Compare method tests
test('compare returns strictlyEqual when comparing the same array buffer view instance', (t) => {
  const context = new RealValueContext()
  const view = new Uint8Array([1, 2, 3, 4])

  const viewRep1 = context.represent(view) as ArrayBufferViewRepresentation
  const viewRep2 = context.represent(view) as ArrayBufferViewRepresentation

  t.is(viewRep1.compare(viewRep2, 'comprehensive'), strictlyEqual)
})

test('compare returns unequal when comparing to non-ArrayBufferViewRepresentation', (t) => {
  const context = new RealValueContext()
  const view = new Uint8Array([1, 2, 3, 4])
  const object = {}

  const viewRep = context.represent(view) as ArrayBufferViewRepresentation
  const objectRep = context.represent(object)

  t.is(viewRep.compare(objectRep, 'comprehensive'), unequal)
  t.is(viewRep.compare(objectRep, 'fuzzy'), unequal)
})

test('compare returns unequal when comparing array buffer views with different content', (t) => {
  const context = new RealValueContext()
  const view1 = new Uint8Array([1, 2, 3, 4])
  const view2 = new Uint8Array([1, 2, 3, 5]) // Different last byte

  const viewRep1 = context.represent(view1) as ArrayBufferViewRepresentation
  const viewRep2 = context.represent(view2) as ArrayBufferViewRepresentation

  t.is(viewRep1.compare(viewRep2, 'comprehensive'), unequal)
})

test('compare considers offset and length within the underlying buffer', (t) => {
  const context = new RealValueContext()
  const buffer = new ArrayBuffer(8)

  // Fill the buffer with data.
  const fullView = new Uint8Array(buffer)
  fullView.set([1, 2, 3, 4, 5, 6, 7, 8])

  // Create views with different offsets over the same buffer.
  const view1 = new Uint8Array(buffer, 0, 4) // [1, 2, 3, 4]
  const view2 = new Uint8Array(buffer, 4, 4) // [5, 6, 7, 8]

  const viewRep1 = context.represent(view1) as ArrayBufferViewRepresentation
  const viewRep2 = context.represent(view2) as ArrayBufferViewRepresentation

  t.is(viewRep1.compare(viewRep2, 'comprehensive'), unequal)
})

test('compare returns unequal for array buffer views with same content but different types', (t) => {
  const context = new RealValueContext()

  // Create two different view types on the same content
  const buffer = new ArrayBuffer(4)
  const uint8 = new Uint8Array(buffer)
  uint8.set([1, 0, 0, 0]) // Little-endian representation of 1 as int32

  const uint8Rep = context.represent(uint8) as ArrayBufferViewRepresentation
  const int32Rep = context.represent(new Int32Array(buffer)) as ArrayBufferViewRepresentation

  // They should be unequal because they have different constructors
  t.is(uint8Rep.compare(int32Rep, 'comprehensive'), unequal)
})

test('compare returns comparable for array buffer views with same content but different types, in fuzzy mode', (t) => {
  const context = new RealValueContext()

  // Create two different view types on the same content
  const buffer = new ArrayBuffer(4)
  const uint8 = new Uint8Array(buffer)
  uint8.set([1, 0, 0, 0]) // Little-endian representation of 1 as int32

  const uint8Rep = context.represent(uint8) as ArrayBufferViewRepresentation
  const int32Rep = context.represent(new Int32Array(buffer)) as ArrayBufferViewRepresentation

  // Different constructors are ignored in fuzzy mode
  t.is(uint8Rep.compare(int32Rep, 'fuzzy'), comparable)
})

test('compare returns comparable when comparing against a deserialized representation', (t) => {
  const originalContext = new RealValueContext()
  const view = new Uint8Array([1, 2, 3, 4])
  const original = originalContext.represent(view) as ArrayBufferViewRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType()
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ArrayBufferViewRepresentation.deserialize(deserializationContext, decoder)

  t.true(deserialized instanceof ArrayBufferViewRepresentation)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized, 'comprehensive'), comparable)
})

test('compare correctly handles empty array buffer views', (t) => {
  const context = new RealValueContext()

  // Create two different empty views
  const emptyView1 = new Uint8Array(0)
  const emptyView2 = new Uint8Array(0)

  // Create a view with content for comparison
  const nonEmptyView = new Uint8Array([1])

  const emptyRep1 = context.represent(emptyView1) as ArrayBufferViewRepresentation
  const emptyRep2 = context.represent(emptyView2) as ArrayBufferViewRepresentation
  const nonEmptyRep = context.represent(nonEmptyView) as ArrayBufferViewRepresentation

  // Two empty views of the same type should be comparable (but not strictly equal)
  t.is(emptyRep1.compare(emptyRep2, 'comprehensive'), comparable)

  // Empty view should be unequal to non-empty view
  t.is(emptyRep1.compare(nonEmptyRep, 'comprehensive'), unequal)

  // Test serialization and comparison with deserialized empty view
  const encoder = new Encoder()
  emptyRep1.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType()
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ArrayBufferViewRepresentation.deserialize(deserializationContext, decoder)

  // Should be comparable to the original empty view
  t.is(emptyRep1.compare(deserialized, 'comprehensive'), comparable)
})

// IterateArrayLike and iterateIterable tests
test('iterateArrayLike yields no elements for array buffer views', (t) => {
  const context = new RealValueContext()
  const view = new Uint8Array([1, 2, 3, 4])
  const viewRep = context.represent(view) as ArrayBufferViewRepresentation

  const elements = [...viewRep.iterateArrayLike()]

  t.is(elements.length, 0)
})

test('iterateIterable yields no elements for array buffer views', (t) => {
  const context = new RealValueContext()
  const view = new Uint8Array([1, 2, 3, 4])
  const viewRep = context.represent(view) as ArrayBufferViewRepresentation

  const iterables = [...viewRep.iterateIterable()]

  t.is(iterables.length, 0)
})

// Serialization tests
test('serialize uses arrayBufferView static type and includes bytes annotation', (t) => {
  const context = new RealValueContext()
  const view = new Uint8Array([1, 2, 3, 4])
  const viewRep = context.represent(view) as ArrayBufferViewRepresentation

  const encoder = new Encoder()
  viewRep.serialize(encoder)

  // Check that the serialized data contains the bytes
  snapshotEncoded(t, encoder, 'array buffer view serialization')

  // Ensure the correct static type was used
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.arrayBufferView)

  // Check that the bytes annotation is included
  const annotations = decoder.annotations<{ b: BytesAccessor }>()
  t.truthy(annotations.b, 'Bytes annotation "b" should exist')
})

// Formatter tests
test('preformat appends formatted bytes', (t) => {
  const context = new RealValueContext()
  const view = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
  const viewRep = context.represent(view) as ArrayBufferViewRepresentation

  const formatter = new Formatter(deriveTheme())
  viewRep.preformat(formatter)

  const rendered = formatter.close().render()
  t.true(rendered.includes('deadbeef'), 'Should contain formatted bytes')
  t.snapshot(rendered, 'bytes formatter content')
})

test('finalFormat uses array brackets and no disambiguation hint by default', (t) => {
  const context = new RealValueContext()
  const view = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
  const viewRep = context.represent(view) as ArrayBufferViewRepresentation

  const formatter = new Formatter(deriveTheme())
  viewRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use array brackets
  t.true(rendered.includes('['))
  t.true(rendered.includes(']'))

  // Should not include disambiguation hint by default
  t.false(rendered.includes('ArrayBufferView'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'array buffer view default format')
})

test('finalFormat shows disambiguation hint when options.disambiguationHint is true', (t) => {
  const context = new RealValueContext()
  const view = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
  const viewRep = context.represent(view) as ArrayBufferViewRepresentation

  const formatter = new Formatter(deriveTheme())
  viewRep.finalFormat(formatter, { disambiguationHint: true })

  const rendered = formatter.render()

  // Should use array brackets
  t.true(rendered.includes('['))
  t.true(rendered.includes(']'))

  // Should include the disambiguation hint when options.disambiguationHint is true
  t.true(rendered.includes('ArrayBufferView'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'array buffer view with disambiguation hint')
})

test('integration of preformat and finalFormat produces correct output', (t) => {
  const context = new RealValueContext()
  const view = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
  const viewRep = context.represent(view) as ArrayBufferViewRepresentation

  const formatter = new Formatter(deriveTheme())

  viewRep.preformat(formatter)
  viewRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should contain both bytes and array brackets
  t.true(rendered.includes('['))
  t.true(rendered.includes(']'))
  t.true(rendered.includes('deadbeef')) // Should contain byte values

  // Snapshot the complete rendering
  t.snapshot(rendered, 'complete array buffer view rendering')
})

test('preformat followed by finalFormat handles different typed array types correctly', (t) => {
  const context = new RealValueContext()
  const views = [
    new Uint8Array([1, 2, 3, 4]),
    new Int8Array([1, 2, -3, -4]),
    new Uint16Array([1, 2, 3, 4]),
    new Int16Array([1, 2, -3, -4]),
    new Uint32Array([1, 2]),
    new Float32Array([1.1, 2.2]),
    new Float64Array([1.1, 2.2]),
  ]

  for (const view of views) {
    const viewRep = context.represent(view) as ArrayBufferViewRepresentation

    const formatter = new Formatter(deriveTheme())

    viewRep.preformat(formatter)
    viewRep.finalFormat(formatter)

    const rendered = formatter.render()

    // Should include constructor name and brackets
    t.true(rendered.includes(view.constructor.name))
    t.true(rendered.includes('['))
    t.true(rendered.includes(']'))

    // Snapshot with constructor name to differentiate
    t.snapshot(rendered, `${view.constructor.name} rendering`)
  }
})
