import test from 'ava'
import { BytesAccessor } from '../bytes.ts'
import { strictlyEqual, unequal } from '../../comparison.ts'
import { Encoder } from '../../serialize.ts'
import { finished } from '../../serialization-result.ts'

// Test constructor and basic properties
test('constructs with correct byte length', (t) => {
  const buffer = new ArrayBuffer(10)
  const accessor = new BytesAccessor(buffer, 2, 4)

  // Access private field indirectly by serializing and checking length
  const encoder = new Encoder()
  accessor.serialize(encoder)

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
  accessor.serialize(encoder)

  t.deepEqual(Array.from(encoder.bytes).slice(1), [3, 4, 5, 6])
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
    [Symbol.iterator]: function* () {
      yield null
    },
  }

  t.is(accessor.compare(nonAccessor as any), unequal)
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
  const result = accessor.serialize(encoder)

  // Check result type
  t.is(result, finished)

  // Check written bytes
  t.deepEqual(Array.from(encoder.bytes).slice(1), [65, 66, 67, 68])
})

test('serialize respects offset and length', (t) => {
  const buffer = new ArrayBuffer(8)
  const view = new Uint8Array(buffer)
  view.set([10, 20, 30, 40, 50, 60, 70, 80])

  // Get subset of bytes from middle of buffer
  const accessor = new BytesAccessor(buffer, 2, 4)

  const encoder = new Encoder()
  accessor.serialize(encoder)

  // Check we got exactly the right bytes
  t.deepEqual(Array.from(encoder.bytes).slice(1), [30, 40, 50, 60])
})

test('serialize works with other ArrayBufferLike types', (t) => {
  // Test with a SharedArrayBuffer if available
  if (typeof SharedArrayBuffer !== 'undefined') {
    const buffer = new SharedArrayBuffer(4)
    const view = new Uint8Array(buffer)
    view.set([1, 2, 3, 4])

    const accessor = new BytesAccessor(buffer, 0, 4)

    const encoder = new Encoder()
    accessor.serialize(encoder)

    t.deepEqual(Array.from(encoder.bytes).slice(1), [1, 2, 3, 4])
  } else {
    // Skip test if SharedArrayBuffer is not available
    t.pass('SharedArrayBuffer not available in this environment')
  }
})

test('handles zero-length buffers', (t) => {
  const buffer = new ArrayBuffer(0)
  const accessor = new BytesAccessor(buffer, 0, 0)

  const encoder = new Encoder()
  accessor.serialize(encoder)

  t.is(encoder.bytes.length, 1) // Empty buffer should serialize to an empty CBOR ByteString

  // Empty accessors should compare as equal
  const buffer2 = new ArrayBuffer(0)
  const accessor2 = new BytesAccessor(buffer2, 0, 0)

  t.is(accessor.compare(accessor2), strictlyEqual)
})
