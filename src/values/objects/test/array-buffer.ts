import test from 'ava'
import { DescriptionContext } from '../../../description-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { ArrayBufferRepresentation } from '../array-buffer.ts'
import type { ArrayBufferViewRepresentation } from '../array-buffer-view.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { NamedPropertyGroup, NamedPropertyAccessor } from '../../../accessors/property.ts'
import type { BytesAccessor } from '../../../accessors/bytes.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

// Deserialize method test
test('deserialize creates a comparable ArrayBufferRepresentation', (t) => {
  const originalContext = new DescriptionContext()
  const buffer = new ArrayBuffer(4)
  new Uint8Array(buffer).set([1, 2, 3, 4])
  const original = originalContext.represent(buffer) as ArrayBufferRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ArrayBufferRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized), comparable)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same array buffer instance', (t) => {
  const context = new DescriptionContext()
  const buffer = new ArrayBuffer(4)

  const bufferRep1 = context.represent(buffer) as ArrayBufferRepresentation
  const bufferRep2 = context.represent(buffer) as ArrayBufferRepresentation

  t.is(bufferRep1.compare(bufferRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-ArrayBufferRepresentation', (t) => {
  const context = new DescriptionContext()
  const buffer = new ArrayBuffer(4)
  const object = {}

  const bufferRep = context.represent(buffer) as ArrayBufferRepresentation
  const objectRep = context.represent(object)

  t.is(bufferRep.compare(objectRep), unequal)
})

test('compare returns unequal when comparing array buffers with different content', (t) => {
  const context = new DescriptionContext()
  const buffer1 = new ArrayBuffer(4)
  new Uint8Array(buffer1).set([1, 2, 3, 4])
  const buffer2 = new ArrayBuffer(4)
  new Uint8Array(buffer2).set([1, 2, 3, 5])

  const bufferRep1 = context.represent(buffer1) as ArrayBufferRepresentation
  const bufferRep2 = context.represent(buffer2) as ArrayBufferRepresentation

  t.is(bufferRep1.compare(bufferRep2), unequal)
})

test('compare returns comparable when comparing different array buffer instances with same content', (t) => {
  const context = new DescriptionContext()
  const buffer1 = new ArrayBuffer(4)
  new Uint8Array(buffer1).set([1, 2, 3, 4])
  const buffer2 = new ArrayBuffer(4)
  new Uint8Array(buffer2).set([1, 2, 3, 4])

  const bufferRep1 = context.represent(buffer1) as ArrayBufferRepresentation
  const bufferRep2 = context.represent(buffer2) as ArrayBufferRepresentation

  // Should be comparable, not strictly equal, as they are different instances
  t.is(bufferRep1.compare(bufferRep2), comparable)
})

test('compare returns unequal when comparing array buffer to array buffer view', (t) => {
  const context = new DescriptionContext()
  const buffer = new ArrayBuffer(4)
  new Uint8Array(buffer).set([1, 2, 3, 4])
  const view = new Uint8Array(buffer)

  const bufferRep = context.represent(buffer) as ArrayBufferRepresentation
  const viewRep = context.represent(view) as ArrayBufferViewRepresentation

  t.is(bufferRep.compare(viewRep), unequal)
})

test('compare correctly handles empty array buffers', (t) => {
  const context = new DescriptionContext()
  const emptyBuffer1 = new ArrayBuffer(0)
  const emptyBuffer2 = new ArrayBuffer(0)
  const nonEmptyBuffer = new ArrayBuffer(1)

  const emptyRep1 = context.represent(emptyBuffer1) as ArrayBufferRepresentation
  const emptyRep2 = context.represent(emptyBuffer2) as ArrayBufferRepresentation
  const nonEmptyRep = context.represent(nonEmptyBuffer) as ArrayBufferRepresentation

  // Two empty buffers should be comparable (but not strictly equal)
  t.is(emptyRep1.compare(emptyRep2), comparable)
  // Empty buffer should be unequal to non-empty buffer
  t.is(emptyRep1.compare(nonEmptyRep), unequal)

  // Test serialization and comparison with deserialized empty buffer
  const encoder = new Encoder()
  emptyRep1.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ArrayBufferRepresentation.deserialize(deserializationContext, decoder)

  // Should be comparable to the original empty buffer
  t.is(emptyRep1.compare(deserialized), comparable)
})

// IterateArrayLike and iterateIterable tests
test('iterateArrayLike yields no elements for array buffers', (t) => {
  const context = new DescriptionContext()
  const buffer = new ArrayBuffer(4)
  const bufferRep = context.represent(buffer) as ArrayBufferRepresentation

  const elements = [...bufferRep.iterateArrayLike()]

  t.is(elements.length, 0)
})

test('iterateIterable yields no elements for array buffers', (t) => {
  const context = new DescriptionContext()
  const buffer = new ArrayBuffer(4)
  const bufferRep = context.represent(buffer) as ArrayBufferRepresentation

  const iterables = [...bufferRep.iterateIterable()]

  t.is(iterables.length, 0)
})

// IterateProperties test
test('iterateProperties yields properties for ArrayBuffer instances', (t) => {
  const context = new DescriptionContext()
  const buffer = new ArrayBuffer(4)
  const bufferRep = context.represent(buffer) as ArrayBufferRepresentation

  const propertyGroups = [...bufferRep.iterateProperties()]

  t.is(propertyGroups.length, 1)
  const [namedGroup] = propertyGroups
  t.true(namedGroup instanceof NamedPropertyGroup)

  // ArrayBuffer has 'maxByteLength' and 'resizable' properties
  const properties = [...namedGroup!]
  t.is(properties.length, 2)

  // Create property accessors for expected properties
  const maxByteLengthValue = context.represent(buffer.maxByteLength ?? Number.MAX_SAFE_INTEGER)
  const resizableValue = context.represent(buffer.resizable ?? false)

  const maxByteLengthAccessor = new NamedPropertyAccessor('maxByteLength', maxByteLengthValue)
  const resizableAccessor = new NamedPropertyAccessor('resizable', resizableValue)

  // Find the expected properties
  const maxByteLengthProperty = properties.find((prop) => {
    return maxByteLengthAccessor.compare(prop) === strictlyEqual
  })

  const resizableProperty = properties.find((prop) => {
    return resizableAccessor.compare(prop) === strictlyEqual
  })

  // Verify that both expected properties were found
  t.truthy(maxByteLengthProperty, 'maxByteLength property should be present')
  t.truthy(resizableProperty, 'resizable property should be present')
})

test('iterateProperties yields properties for SharedArrayBuffer instances', (t) => {
  const context = new DescriptionContext()
  const buffer = new SharedArrayBuffer(4)
  const bufferRep = context.represent(buffer) as ArrayBufferRepresentation

  const propertyGroups = [...bufferRep.iterateProperties()]

  t.is(propertyGroups.length, 1)
  const [namedGroup] = propertyGroups
  t.true(namedGroup instanceof NamedPropertyGroup)

  // SharedArrayBuffer has 'maxByteLength' and 'growable' properties
  const properties = [...namedGroup!]
  t.is(properties.length, 2)

  // Create property accessors for expected properties
  const maxByteLengthValue = context.represent(buffer.maxByteLength ?? Number.MAX_SAFE_INTEGER)
  const growableValue = context.represent(buffer.growable ?? false)

  const maxByteLengthAccessor = new NamedPropertyAccessor('maxByteLength', maxByteLengthValue)
  const growableAccessor = new NamedPropertyAccessor('growable', growableValue)

  // Find the expected properties
  const maxByteLengthProperty = properties.find((prop) => {
    return maxByteLengthAccessor.compare(prop) === strictlyEqual
  })

  const growableProperty = properties.find((prop) => {
    return growableAccessor.compare(prop) === strictlyEqual
  })

  // Verify that both expected properties were found
  t.truthy(maxByteLengthProperty, 'maxByteLength property should be present')
  t.truthy(growableProperty, 'growable property should be present')
})

// Serialization tests
test('serialize uses arrayBuffer static type and includes bytes annotation', (t) => {
  const context = new DescriptionContext()
  const buffer = new ArrayBuffer(4)
  const bytes = new Uint8Array(buffer)
  bytes.set([0xde, 0xad, 0xbe, 0xef])
  const bufferRep = context.represent(buffer) as ArrayBufferRepresentation

  const encoder = new Encoder()
  bufferRep.serialize(encoder)

  // Check the overall structure and type
  snapshotEncoded(t, encoder, 'array buffer serialization')

  // Verify the static type and annotations manually
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.arrayBuffer)
  const annotations = decoder.annotations<{ b: BytesAccessor }>()
  t.truthy(annotations.b, 'Bytes annotation "b" should exist')
})

// Formatter tests
test('preformat appends formatted bytes', (t) => {
  const context = new DescriptionContext()
  const view = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
  const bufferRep = context.represent(view.buffer) as ArrayBufferRepresentation

  const formatter = new Formatter(deriveTheme())
  bufferRep.preformat(formatter)

  const rendered = formatter.close().render()
  t.true(rendered.includes('deadbeef'), 'Should contain formatted bytes')
  t.snapshot(rendered, 'bytes formatter content')
})

test('finalFormat uses array brackets and no disambiguation hint by default', (t) => {
  const context = new DescriptionContext()
  const view = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
  const bufferRep = context.represent(view.buffer) as ArrayBufferRepresentation

  const formatter = new Formatter(deriveTheme())
  bufferRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use array brackets
  t.true(rendered.includes('['))
  t.true(rendered.includes(']'))

  // Should not include disambiguation hint by default
  t.false(rendered.includes('// ArrayBuffer'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'array buffer view default format')
})

test('finalFormat shows disambiguation hint when options.disambiguationHint is true', (t) => {
  const context = new DescriptionContext()
  const view = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
  const bufferRep = context.represent(view.buffer) as ArrayBufferRepresentation

  const formatter = new Formatter(deriveTheme())
  bufferRep.finalFormat(formatter, { disambiguationHint: true })

  const rendered = formatter.render()

  // Should use array brackets
  t.true(rendered.includes('['))
  t.true(rendered.includes(']'))

  // Should include the disambiguation hint when options.disambiguationHint is true
  t.true(rendered.includes('// ArrayBuffer'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'array buffer view with disambiguation hint')
})

test('integration of preformat and finalFormat produces correct output', (t) => {
  const context = new DescriptionContext()
  const view = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
  const bufferRep = context.represent(view.buffer) as ArrayBufferRepresentation

  const formatter = new Formatter(deriveTheme())

  bufferRep.preformat(formatter)
  bufferRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should contain both bytes and array brackets
  t.true(rendered.includes('['))
  t.true(rendered.includes(']'))
  t.true(rendered.includes('deadbeef')) // Should contain byte values

  // Snapshot the complete rendering
  t.snapshot(rendered, 'complete array buffer view rendering')
})

test('preformat followed by finalFormat handles different buffer types correctly', (t) => {
  const context = new DescriptionContext()
  const shared = new SharedArrayBuffer(4)
  const uint8 = new Uint8Array(shared)
  uint8.set([0xde, 0xad, 0xbe, 0xef])
  const buffers = [new Uint8Array([1, 2, 3, 4]).buffer, shared]

  for (const buffer of buffers) {
    const bufferRep = context.represent(buffer) as ArrayBufferRepresentation

    const formatter = new Formatter(deriveTheme())

    bufferRep.preformat(formatter)
    bufferRep.finalFormat(formatter)

    const rendered = formatter.render()

    // Should include constructor name and brackets
    t.true(rendered.includes(buffer.constructor.name))
    t.true(rendered.includes('['))
    t.true(rendered.includes(']'))

    // Snapshot with constructor name to differentiate
    t.snapshot(rendered, `${buffer.constructor.name} rendering`)
  }
})
