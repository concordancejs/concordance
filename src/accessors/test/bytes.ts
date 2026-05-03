import test from 'ava'
import { BytesAccessor } from '../bytes.ts'
import { ElementAccessor } from '../element.ts'
import { strictlyEqual, unequal } from '../../comparison.ts'
import { Encoder } from '../../encoder.ts'
import { finished } from '../../serialization-result.ts'
import { deriveTheme } from '../../theme.ts'
import { Formatter } from '../../formatter.ts'
import { StringRepresentation } from '../../values/primitives/string.ts'
import type { ValueRepresentation } from '../../value.d.ts'

// Test constructor and basic properties
test('constructs with correct byte length', (t) => {
  const buffer = new ArrayBuffer(10)
  const accessor = new BytesAccessor(buffer, 2, 4)

  // Access private field indirectly by serializing and checking length
  const encoder = new Encoder()
  accessor.serializeShallow(encoder)

  // Expect 4 bytes to be written, plus 1 byte to mark the CBOR ByteString
  t.is(encoder.bytes.length, 5)
})

test('constructs view with correct offset and length', (t) => {
  const buffer = new ArrayBuffer(10)
  const view = new Uint8Array(buffer)

  // Fill buffer with values
  for (let i = 0; i < 10; i++) {
    view[i] = i
  }

  // Create accessor with offset 3, length 4
  const accessor = new BytesAccessor(buffer, 3, 4)

  // Serialize and check that we got bytes 3, 4, 5, 6
  const encoder = new Encoder()
  accessor.serializeShallow(encoder)

  t.deepEqual([...encoder.bytes].slice(1), [3, 4, 5, 6])
})

// Test comparison
test('compare returns strictlyEqual for identical bytes', (t) => {
  const buffer1 = new ArrayBuffer(4)
  const view1 = new Uint8Array(buffer1)
  view1.set([10, 20, 30, 40])

  const buffer2 = new ArrayBuffer(4)
  const view2 = new Uint8Array(buffer2)
  view2.set([10, 20, 30, 40])

  const accessor1 = new BytesAccessor(buffer1, 0, 4)
  const accessor2 = new BytesAccessor(buffer2, 0, 4)

  t.is(accessor1.compare(accessor2), strictlyEqual)
})

test('compare returns unequal for non-BytesAccessor', (t) => {
  const buffer = new ArrayBuffer(4)
  const accessor = new BytesAccessor(buffer, 0, 4)

  const nonAccessor = {
    compare: () => strictlyEqual,
    serialize: () => finished,
    *[Symbol.iterator]() {
      yield null
    },
  }

  t.is(accessor.compare(nonAccessor as unknown as ValueRepresentation), unequal)
})

test('compare returns unequal for different byte lengths', (t) => {
  const buffer1 = new ArrayBuffer(4)
  const buffer2 = new ArrayBuffer(6)

  const accessor1 = new BytesAccessor(buffer1, 0, 4)
  const accessor2 = new BytesAccessor(buffer2, 0, 6)

  t.is(accessor1.compare(accessor2), unequal)
})

test('compare returns unequal if any byte differs', (t) => {
  const buffer1 = new ArrayBuffer(4)
  const view1 = new Uint8Array(buffer1)
  view1.set([10, 20, 30, 40])

  const buffer2 = new ArrayBuffer(4)
  const view2 = new Uint8Array(buffer2)
  view2.set([10, 20, 31, 40]) // One byte is different

  const accessor1 = new BytesAccessor(buffer1, 0, 4)
  const accessor2 = new BytesAccessor(buffer2, 0, 4)

  t.is(accessor1.compare(accessor2), unequal)
})

test('compare handles different buffer but same content', (t) => {
  const buffer1 = new ArrayBuffer(8)
  const view1 = new Uint8Array(buffer1)
  view1.set([1, 2, 3, 4, 5, 6, 7, 8])

  const buffer2 = new ArrayBuffer(5)
  const view2 = new Uint8Array(buffer2)
  view2.set([3, 4, 5])

  // Get bytes 2-5 from buffer1
  const accessor1 = new BytesAccessor(buffer1, 2, 3)
  // Get bytes 0-3 from buffer2
  const accessor2 = new BytesAccessor(buffer2, 0, 3)

  // Both should contain [3, 4, 5]
  t.is(accessor1.compare(accessor2), strictlyEqual)
})

test('acceptsComparisonFrom returns true for BytesAccessor', (t) => {
  const buffer1 = new ArrayBuffer(4)
  const buffer2 = new ArrayBuffer(4)
  const accessor1 = new BytesAccessor(buffer1, 0, 4)
  const accessor2 = new BytesAccessor(buffer2, 0, 4)

  t.true(accessor1.acceptsComparisonFrom(accessor2))
})

test('acceptsComparisonFrom returns false for non-BytesAccessor', (t) => {
  const buffer = new ArrayBuffer(4)
  const accessor = new BytesAccessor(buffer, 0, 4)
  const stringValue = new StringRepresentation('test')
  const elementAccessor = new ElementAccessor(0, stringValue)

  t.false(accessor.acceptsComparisonFrom(elementAccessor))
})

// Test is static method
test('is correctly identifies BytesAccessor instances', (t) => {
  const buffer = new ArrayBuffer(4)
  const accessor = new BytesAccessor(buffer, 0, 4)

  t.true(BytesAccessor.is(accessor))
  t.false(BytesAccessor.is({}))
  t.false(BytesAccessor.is(buffer))
})

// Test serialization
test('serialize correctly writes bytes to encoder', (t) => {
  const buffer = new ArrayBuffer(4)
  const view = new Uint8Array(buffer)
  view.set([65, 66, 67, 68]) // ASCII for 'ABCD'

  const accessor = new BytesAccessor(buffer, 0, 4)

  const encoder = new Encoder()
  const result = accessor.serializeShallow(encoder)

  // Check result type
  t.is(result, finished)

  // Check written bytes
  t.deepEqual([...encoder.bytes].slice(1), [65, 66, 67, 68])
})

test('serialize respects offset and length', (t) => {
  const buffer = new ArrayBuffer(8)
  const view = new Uint8Array(buffer)
  view.set([10, 20, 30, 40, 50, 60, 70, 80])

  // Get subset of bytes from middle of buffer
  const accessor = new BytesAccessor(buffer, 2, 4)

  const encoder = new Encoder()
  accessor.serializeShallow(encoder)

  // Check we got exactly the right bytes
  t.deepEqual([...encoder.bytes].slice(1), [30, 40, 50, 60])
})

test('serialize works with other ArrayBufferLike types', (t) => {
  const buffer = new SharedArrayBuffer(4)
  const view = new Uint8Array(buffer)
  view.set([1, 2, 3, 4])

  const accessor = new BytesAccessor(buffer, 0, 4)

  const encoder = new Encoder()
  accessor.serializeShallow(encoder)

  t.deepEqual([...encoder.bytes].slice(1), [1, 2, 3, 4])
})

test('handles zero-length buffers', (t) => {
  const buffer = new ArrayBuffer(0)
  const accessor = new BytesAccessor(buffer, 0, 0)

  const encoder = new Encoder()
  accessor.serializeShallow(encoder)

  t.is(encoder.bytes.length, 1) // Empty buffer should serialize to an empty CBOR ByteString

  // Empty accessors should compare as equal
  const buffer2 = new ArrayBuffer(0)
  const accessor2 = new BytesAccessor(buffer2, 0, 0)

  t.is(accessor.compare(accessor2), strictlyEqual)
})

const testTheme = deriveTheme()

test('formatShallow formats empty buffer', (t) => {
  const buffer = new ArrayBuffer(0)
  const accessor = new BytesAccessor(buffer, 0, 0)

  const formatter = new Formatter(testTheme)
  accessor.formatShallow(formatter)
  formatter.close()

  // Empty buffer should result in empty output
  t.snapshot(formatter.render())
})

test('formatShallow formats single byte', (t) => {
  const buffer = new ArrayBuffer(1)
  const view = new Uint8Array(buffer)
  view[0] = 0xaf // 175 in decimal

  const accessor = new BytesAccessor(buffer, 0, 1)

  const formatter = new Formatter(testTheme)
  accessor.formatShallow(formatter)
  formatter.close()

  // Should be wrapped in 'bytes' theme formatting
  t.snapshot(formatter.render())
})

test('formatShallow formats two bytes', (t) => {
  const buffer = new ArrayBuffer(2)
  const view = new Uint8Array(buffer)
  view[0] = 0xab // 171 in decimal
  view[1] = 0xcd // 205 in decimal

  const accessor = new BytesAccessor(buffer, 0, 2)

  const formatter = new Formatter(testTheme)
  accessor.formatShallow(formatter)
  formatter.close()

  // Two bytes should be represented as a single 16-bit value
  t.snapshot(formatter.render())
})

test('formatShallow formats three bytes', (t) => {
  const buffer = new ArrayBuffer(3)
  const view = new Uint8Array(buffer)
  view[0] = 0x12
  view[1] = 0x34
  view[2] = 0x56

  const accessor = new BytesAccessor(buffer, 0, 3)

  const formatter = new Formatter(testTheme)
  accessor.formatShallow(formatter)
  formatter.close()

  // Three bytes should be represented as a 24-bit value
  t.snapshot(formatter.render())
})

test('formatShallow formats four bytes', (t) => {
  const buffer = new ArrayBuffer(4)
  const view = new Uint8Array(buffer)
  view[0] = 0xde
  view[1] = 0xad
  view[2] = 0xbe
  view[3] = 0xef

  const accessor = new BytesAccessor(buffer, 0, 4)

  const formatter = new Formatter(testTheme)
  accessor.formatShallow(formatter)
  formatter.close()

  // Four bytes should be represented as a 32-bit value
  t.snapshot(formatter.render())
})

test('formatShallow formats more than four bytes with spaces between chunks', (t) => {
  const buffer = new ArrayBuffer(8)
  const view = new Uint8Array(buffer)
  // First 4 bytes
  view[0] = 0xde
  view[1] = 0xad
  view[2] = 0xbe
  view[3] = 0xef
  // Next 4 bytes
  view[4] = 0xca
  view[5] = 0xfe
  view[6] = 0xba
  view[7] = 0xbe

  const accessor = new BytesAccessor(buffer, 0, 8)

  const formatter = new Formatter(testTheme)
  accessor.formatShallow(formatter)
  formatter.close()

  // Should have a space between 4-byte chunks
  t.snapshot(formatter.render())
})

test('formatShallow formats with line breaks for large buffers', (t) => {
  // Create a 36-byte buffer (9 words, which should span two lines)
  const buffer = new ArrayBuffer(36)
  const view = new Uint8Array(buffer)

  // Fill with incrementing pattern
  for (let i = 0; i < 36; i++) {
    view[i] = i % 256
  }

  const accessor = new BytesAccessor(buffer, 0, 36)

  const formatter = new Formatter(testTheme, 0)
  accessor.formatShallow(formatter)
  formatter.close()

  // We expect 8 words on the first line, then a line break, then 1 word
  const rendered = formatter.render()

  // With snapshot testing we'll see if the line breaks are correctly placed
  t.snapshot(rendered)
})

test('formatShallow respects buffer offsets', (t) => {
  const buffer = new ArrayBuffer(10)
  const view = new Uint8Array(buffer)

  // Fill with data
  for (let i = 0; i < 10; i++) {
    view[i] = i + 10
  }

  // Create accessor for bytes 3-7 (5 bytes)
  // Should format values: 13 14 15 16 17
  const accessor = new BytesAccessor(buffer, 3, 5)

  const formatter = new Formatter(testTheme)
  accessor.formatShallow(formatter)
  formatter.close()

  // Let the snapshot verify the formatted output
  t.snapshot(formatter.render())
})

test('formatShallow handles non-aligned buffer length and offsets correctly', (t) => {
  const buffer = new ArrayBuffer(10)
  const view = new Uint8Array(buffer)

  // Fill with data
  for (let i = 0; i < 10; i++) {
    view[i] = i + 10
  }

  // Create accessor for bytes 2-6 (starting at odd offset, 5 bytes total)
  // Should format values: 12 13 14 15 16
  const accessor = new BytesAccessor(buffer, 2, 5)

  const formatter = new Formatter(testTheme)
  accessor.formatShallow(formatter)
  formatter.close()

  // Let the snapshot verify the formatted output
  t.snapshot(formatter.render())
})

test('deserialized property returns false for BytesAccessor', (t) => {
  const view = new Uint8Array([10, 20, 30, 40])
  const accessor = new BytesAccessor(view.buffer, view.byteOffset, view.length)
  t.false(accessor.deserialized)
})
