import test from 'ava'
import { DescriptionContext } from '../../../description-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { ArrayBufferViewRepresentation } from '../array-buffer-view.ts'
import { strictlyEqual, unequal, comparable } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { BytesAccessor } from '../../../accessors/bytes.ts'

// Compare method tests
test('compare returns strictlyEqual when comparing the same array buffer view instance', (t) => {
  const context = new DescriptionContext()
  const view = new Uint8Array([1, 2, 3, 4])

  const viewRep1 = context.represent(view) as ArrayBufferViewRepresentation
  const viewRep2 = context.represent(view) as ArrayBufferViewRepresentation

  t.is(viewRep1.compare(viewRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-ArrayBufferViewRepresentation', (t) => {
  const context = new DescriptionContext()
  const view = new Uint8Array([1, 2, 3, 4])
  const obj = {}

  const viewRep = context.represent(view) as ArrayBufferViewRepresentation
  const objRep = context.represent(obj)

  t.is(viewRep.compare(objRep), unequal)
})

test('compare returns unequal when comparing array buffer views with different content', (t) => {
  const context = new DescriptionContext()
  const view1 = new Uint8Array([1, 2, 3, 4])
  const view2 = new Uint8Array([1, 2, 3, 5]) // Different last byte

  const viewRep1 = context.represent(view1) as ArrayBufferViewRepresentation
  const viewRep2 = context.represent(view2) as ArrayBufferViewRepresentation

  t.is(viewRep1.compare(viewRep2), unequal)
})

test('compare considers offset and length within the underlying buffer', (t) => {
  const context = new DescriptionContext()
  const buffer = new ArrayBuffer(8)

  // Fill the buffer with data.
  const fullView = new Uint8Array(buffer)
  fullView.set([1, 2, 3, 4, 5, 6, 7, 8])

  // Create views with different offsets over the same buffer.
  const view1 = new Uint8Array(buffer, 0, 4) // [1, 2, 3, 4]
  const view2 = new Uint8Array(buffer, 4, 4) // [5, 6, 7, 8]

  const viewRep1 = context.represent(view1) as ArrayBufferViewRepresentation
  const viewRep2 = context.represent(view2) as ArrayBufferViewRepresentation

  t.is(viewRep1.compare(viewRep2), unequal)
})

test('compare returns unequal for array buffer views with same content but different types', (t) => {
  const context = new DescriptionContext()

  // Create two different view types on the same content
  const buffer = new ArrayBuffer(4)
  const uint8 = new Uint8Array(buffer)
  uint8.set([1, 0, 0, 0]) // Little-endian representation of 1 as int32

  const uint8Rep = context.represent(uint8) as ArrayBufferViewRepresentation
  const int32Rep = context.represent(new Int32Array(buffer)) as ArrayBufferViewRepresentation

  // They should be unequal because they have different constructors
  t.is(uint8Rep.compare(int32Rep), unequal)
})

test('compare returns comparable when comparing against a deserialized representation', (t) => {
  const originalContext = new DescriptionContext()
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
  t.is(original.compare(deserialized), comparable)
})

test('compare correctly handles empty array buffer views', (t) => {
  const context = new DescriptionContext()

  // Create two different empty views
  const emptyView1 = new Uint8Array(0)
  const emptyView2 = new Uint8Array(0)

  // Create a view with content for comparison
  const nonEmptyView = new Uint8Array([1])

  const emptyRep1 = context.represent(emptyView1) as ArrayBufferViewRepresentation
  const emptyRep2 = context.represent(emptyView2) as ArrayBufferViewRepresentation
  const nonEmptyRep = context.represent(nonEmptyView) as ArrayBufferViewRepresentation

  // Two empty views of the same type should be comparable (but not strictly equal)
  t.is(emptyRep1.compare(emptyRep2), comparable)

  // Empty view should be unequal to non-empty view
  t.is(emptyRep1.compare(nonEmptyRep), unequal)

  // Test serialization and comparison with deserialized empty view
  const encoder = new Encoder()
  emptyRep1.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType()
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ArrayBufferViewRepresentation.deserialize(deserializationContext, decoder)

  // Should be comparable to the original empty view
  t.is(emptyRep1.compare(deserialized), comparable)
})

// iterateArrayLike and iterateIterable tests
test('iterateArrayLike yields no elements for array buffer views', (t) => {
  const context = new DescriptionContext()
  const view = new Uint8Array([1, 2, 3, 4])
  const viewRep = context.represent(view) as ArrayBufferViewRepresentation

  const elements = [...viewRep.iterateArrayLike()]

  t.is(elements.length, 0)
})

test('iterateIterable yields no elements for array buffer views', (t) => {
  const context = new DescriptionContext()
  const view = new Uint8Array([1, 2, 3, 4])
  const viewRep = context.represent(view) as ArrayBufferViewRepresentation

  const iterables = [...viewRep.iterateIterable()]

  t.is(iterables.length, 0)
})

// Serialization tests
test('serialize uses arrayBufferView static type and includes bytes annotation', (t) => {
  const context = new DescriptionContext()
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
