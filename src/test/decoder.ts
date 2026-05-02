import test from 'ava'
import { BytesAccessor } from '../accessors/bytes.ts'
import { Decoder } from '../decoder.ts'
import { staticTypeTable } from '../serialization-types.ts'
import { strictlyEqual } from '../comparison.ts'

// Basic constructor and core functionality tests
test('constructor initializes with bytes', (t) => {
  const bytes = new Uint8Array([0, 1, 2, 3])
  const decoder = new Decoder(bytes)
  t.true(decoder instanceof Decoder)
  // Test Iterator
  let count = 0
  for (const _ of decoder) {
    count++
  }

  t.true(count > 0, 'Decoder should be iterable')
})

// Int method tests
test('int reads integer values correctly', (t) => {
  // Create a byte array with CBOR integer 42 (0x182a)
  const bytes = new Uint8Array([0x18, 0x2a])
  const decoder = new Decoder(bytes)
  t.is(decoder.int(), 42)

  // Throws AssertionError for integers larger than Number.MAX_SAFE_INTEGER
  // CBOR encoding for 2^53 (0x1b 0x00 0x20 0x00 0x00 0x00 0x00 0x00 0x00):
  // 0x1b prefix for uint64, followed by 0x00 0x20 0x00 0x00 0x00 0x00 0x00 0x00
  const bytesMax = new Uint8Array([0x1b, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
  const decoderMax = new Decoder(bytesMax)
  t.throws(() => decoderMax.int(), { name: 'AssertionError', message: 'Unexpected bigint' })
})

test('int throws for empty buffer', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  t.throws(() => decoder.int(), { name: 'AssertionError' })
})

test('int throws for incorrect major types', (t) => {
  // Create a byte array with CBOR float (0xfb)
  const bytesFloat = new Uint8Array([0xfb, 0x40, 0x09, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18])
  const decoderFloat = new Decoder(bytesFloat)
  t.throws(() => decoderFloat.int(), { name: 'AssertionError', message: /Expected an integer, got major type/ })
})

// BigInt method tests
test('bigInt handles large integers correctly', (t) => {
  // Test with a value bigger than MAX_SAFE_INTEGER (2^53-1)
  // CBOR encoding for 2^60 (1152921504606846976):
  // 0x1b prefix for uint64, followed by 0x10 00 00 00 00 00 00 00
  const largeBytes = new Uint8Array([0x1b, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
  const largeDecoder = new Decoder(largeBytes)
  t.is(largeDecoder.bigInt(), 1_152_921_504_606_846_976n)

  // Test with a negative value smaller than -MAX_SAFE_INTEGER
  // CBOR encoding for -2^60 (-1152921504606846976):
  // 0x3b prefix for negative uint64, followed by 0x0f ff ff ff ff ff ff ff
  const negLargeBytes = new Uint8Array([0x3b, 0x0f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
  const negLargeDecoder = new Decoder(negLargeBytes)
  t.is(negLargeDecoder.bigInt(), -1_152_921_504_606_846_976n)

  // Test with a value at the boundary of int64
  // CBOR encoding for 2^63-1 (9223372036854775807):
  // 0x1b prefix for uint64, followed by 0x7f ff ff ff ff ff ff ff
  const maxInt64Bytes = new Uint8Array([0x1b, 0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
  const maxInt64Decoder = new Decoder(maxInt64Bytes)
  t.is(maxInt64Decoder.bigInt(), 9_223_372_036_854_775_807n)
})

test('bigInt handles tagged big integers correctly', (t) => {
  // Test with a positive value exceeding the int64 range
  // Tagged BigInteger for 1234567890123456789012345678901234567890
  // Test with a value exceeding the int64 range using CBOR tag 2 (bignum)
  // Tag 2 (0xc2) followed by byte string containing the big integer value
  const taggedBigIntBytes = new Uint8Array([
    0xc2, // Tag 2 for positive bignum
    0x51, // Byte string of length 0x51 (81 bytes)
    0x03,
    0xa0,
    0xc9,
    0x20,
    0x75,
    0xc0,
    0xdb,
    0xf3,
    0xb8,
    0xac,
    0xbc,
    0x5f,
    0x96,
    0xce,
    0x3f,
    0x0a,
    0xd2,
    // Additional bytes would complete the 81-byte sequence for this big integer
  ])
  const taggedBigIntDecoder = new Decoder(taggedBigIntBytes)
  t.is(taggedBigIntDecoder.bigInt(), 1_234_567_890_123_456_789_012_345_678_901_234_567_890n)

  // Test with a negative value exceeding the int64 range
  // Tagged BigInteger for -1234567890123456789012345678901234567890
  // Test with a value exceeding the int64 range using CBOR tag 3 (negative bignum)
  // For tag 3, the encoded value n becomes -1-n, so we need to encode 1234567890123456789012345678901234567889
  // Tag 3 (0xc3) followed by byte string containing the absolute value of the big integer minus 1
  const taggedNegativeBigIntBytes = new Uint8Array([
    0xc3, // Tag 3 for negative bignum
    0x51, // Byte string of length 0x51 (81 bytes)
    0x03,
    0xa0,
    0xc9,
    0x20,
    0x75,
    0xc0,
    0xdb,
    0xf3,
    0xb8,
    0xac,
    0xbc,
    0x5f,
    0x96,
    0xce,
    0x3f,
    0x0a,
    0xd1, // Changed last byte from 0xd2 to 0xd1 to represent one less
    // Additional bytes would complete the 81-byte sequence for this big integer
  ])
  const taggedNegativeBigIntDecoder = new Decoder(taggedNegativeBigIntBytes)
  t.is(taggedNegativeBigIntDecoder.bigInt(), -1_234_567_890_123_456_789_012_345_678_901_234_567_890n)
})

test('bigInt converts number value to bigint when needed', (t) => {
  // Create a byte array with small CBOR integer (0x01 = integer 1)
  // This will be returned as a number by the underlying CBOR library
  const bytes = new Uint8Array([0x01])
  const decoder = new Decoder(bytes)

  // This should convert the numeric 1 to a BigInt
  const result = decoder.bigInt()
  t.is(result, 1n)
  t.is(typeof result, 'bigint', 'Result should be a bigint type')
})

test('bigInt throws for empty buffer', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  t.throws(() => decoder.bigInt(), { name: 'AssertionError' })
})

test('bigInt throws for incorrect major types', (t) => {
  // Create a byte array with CBOR float (0xfb)
  const bytesFloat = new Uint8Array([0xfb, 0x40, 0x09, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18])
  const decoderFloat = new Decoder(bytesFloat)
  t.throws(() => decoderFloat.bigInt(), { name: 'AssertionError', message: /Expected a bigint, got major type/ })
})

// Number method tests
test('number reads numeric values correctly', (t) => {
  // CBOR integer 42 (0x182a)
  const intBytes = new Uint8Array([0x18, 0x2a])

  // CBOR float64 π (major type 7, additional info 27 = 0xfb, followed by 8 bytes)
  // 0xfb = header byte for float64
  // 0x4009 21fb 5444 2d18 = IEEE 754 representation of π
  const piBytes = new Uint8Array([0xfb, 0x40, 0x09, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18])

  t.is(new Decoder(intBytes).number(), 42)

  // Compare with Math.PI for exact precision comparison
  const piResult = new Decoder(piBytes).number()
  t.is(piResult, Math.PI)
})

test('number handles integer values correctly', (t) => {
  // Test the same large integer with number() method
  const bytesLarge = new Uint8Array([0x1b, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]) // 2^32
  const decoderLarge = new Decoder(bytesLarge)
  t.is(decoderLarge.number(), 4_294_967_296)

  // Test a small int with number()
  const bytesSmall = new Uint8Array([0x18, 0x2a]) // 42
  const decoderSmall = new Decoder(bytesSmall)
  t.is(decoderSmall.number(), 42)

  // Throws AssertionError for integers larger than Number.MAX_SAFE_INTEGER
  const bytesMax = new Uint8Array([0x1b, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]) // 2^53
  const decoderMax = new Decoder(bytesMax)
  t.throws(() => decoderMax.number(), { name: 'AssertionError', message: 'Unexpected bigint' })
})

test('number throws for empty buffer', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  t.throws(() => decoder.number(), { name: 'AssertionError' })
})

test('number throws for incorrect major types', (t) => {
  // Create a byte array with CBOR string (0x65 + "hello")
  const bytesString = new Uint8Array([0x65, 0x68, 0x65, 0x6c, 0x6c, 0x6f])
  const decoderString = new Decoder(bytesString)
  t.throws(() => decoderString.number(), { name: 'AssertionError', message: /Expected a number/ })
})

// Boolean method tests
test('boolean reads boolean values correctly', (t) => {
  // CBOR true (0xf5) and false (0xf4)
  const bytesTrue = new Uint8Array([0xf5])
  const bytesFalse = new Uint8Array([0xf4])

  t.true(new Decoder(bytesTrue).boolean())
  t.false(new Decoder(bytesFalse).boolean())
})

test('boolean throws for empty buffer', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  t.throws(() => decoder.boolean(), { name: 'AssertionError' })
})

test('boolean throws for incorrect major types', (t) => {
  // Create a byte array with CBOR integer (0x01 for integer 1)
  const bytesInt = new Uint8Array([0x01])
  const decoderInt = new Decoder(bytesInt)
  t.throws(() => decoderInt.boolean(), { name: 'AssertionError', message: /Expected a boolean/ })
})

// String method tests
test('string reads string values correctly', (t) => {
  // CBOR string "hello" (0x6568656c6c6f)
  const bytes = new Uint8Array([0x65, 0x68, 0x65, 0x6c, 0x6c, 0x6f])
  const decoder = new Decoder(bytes)
  t.is(decoder.string(), 'hello')
})

test('string throws for empty buffer', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  t.throws(() => decoder.string(), { name: 'AssertionError' })
})

test('string throws for incorrect major types', (t) => {
  // Create a byte array with CBOR integer (0x01 for integer 1)
  const bytesInt = new Uint8Array([0x01])
  const decoderInt = new Decoder(bytesInt)
  t.throws(() => decoderInt.string(), {
    name: 'AssertionError',
    message: /Expected a fixed-length text string, got major type/,
  })
})

test('string throws for indefinite length text strings', (t) => {
  // CBOR indefinite length text string (0x7f + chunks + break)
  // 0x7f: indefinite length text string marker
  // 0x62 + "he": first chunk ("he")
  // 0x63 + "llo": second chunk ("llo")
  // 0xff: break code
  const bytes = new Uint8Array([0x7f, 0x62, 0x68, 0x65, 0x63, 0x6c, 0x6c, 0x6f, 0xff])
  const decoder = new Decoder(bytes)

  t.throws(() => decoder.string(), {
    name: 'AssertionError',
    message: /Expected a fixed-length text string/,
  })
})

// UInt8Array method tests
test('uint8Array reads binary data correctly', (t) => {
  // CBOR byte string 0x010203 (0x43010203)
  const bytes = new Uint8Array([0x43, 0x01, 0x02, 0x03])
  const decoder = new Decoder(bytes)
  const result = decoder.uint8Array()
  t.deepEqual(result, new Uint8Array([0x01, 0x02, 0x03]))
})

test('uint8Array throws for empty buffer', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  t.throws(() => decoder.uint8Array(), { name: 'AssertionError' })
})

test('uint8Array throws for incorrect major types', (t) => {
  // Create a byte array with CBOR integer (0x01 for integer 1)
  const bytesInt = new Uint8Array([0x01])
  const decoderInt = new Decoder(bytesInt)
  t.throws(() => decoderInt.uint8Array(), {
    name: 'AssertionError',
    message: /Expected a fixed-length byte string, got major type/,
  })
})

test('uint8Array throws for indefinite length byte strings', (t) => {
  // CBOR indefinite length byte string (0x5f + chunks + break)
  // 0x5f: indefinite length byte string marker
  // 0x41 + 0x01: first chunk (byte 0x01)
  // 0x42 + 0x02 + 0x03: second chunk (bytes 0x02, 0x03)
  // 0xff: break code
  const bytes = new Uint8Array([0x5f, 0x41, 0x01, 0x42, 0x02, 0x03, 0xff])
  const decoder = new Decoder(bytes)

  t.throws(() => decoder.uint8Array(), {
    name: 'AssertionError',
    message: /Expected a fixed-length byte string/,
  })
})

// StaticType method tests
test('staticType reads static type values', (t) => {
  // Create a byte array with a valid static type
  const typeValue = staticTypeTable.string
  const bytes = new Uint8Array([typeValue])
  const decoder = new Decoder(bytes)
  t.is(decoder.staticType(), typeValue)
})

test('staticType returns undefined for empty buffer', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  t.is(decoder.staticType(), undefined, 'Should return undefined when buffer is empty')
})

test('staticType throws for invalid static type values', (t) => {
  // Test with an invalid static type (not in staticTypeTable)
  // Use 0x1b for major type 0 (unsigned integer) with additional info 27 (8 bytes)
  // Followed by 8 bytes representing 2^53-1 (0x001f ffff ffff ffff)
  const invalidBytes = new Uint8Array([0x1b, 0x00, 0x1f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
  const invalidDecoder = new Decoder(invalidBytes)
  t.throws(() => invalidDecoder.staticType(), {
    name: 'AssertionError',
    message: /Invalid static type/,
  })

  // Test with integer that's beyond the valid range for static types
  // CBOR encoding for 2^64-1 (largest possible uint64)
  const decoderBigint = new Decoder(new Uint8Array([0x1b, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]))

  t.throws(() => decoderBigint.staticType(), {
    name: 'AssertionError',
    message: /Unexpected bigint/,
  })
})

test('peekStaticType returns the next valid static type without advancing the pointer', (t) => {
  // Set up a decoder with a valid static type
  const validType = staticTypeTable.string
  const bytes = new Uint8Array([validType])
  const decoder = new Decoder(bytes)

  // Peek should return the type without advancing
  const peekedType = decoder.peekStaticType()
  t.is(peekedType, validType, 'Should return the correct static type')

  // The decoder should still be at the beginning, so staticType() should return the same value
  const actualType = decoder.staticType()
  t.is(actualType, validType, 'Should read the same value after peeking')

  // Now the decoder should be at the end, so another peek should return undefined
  t.is(decoder.peekStaticType(), undefined, 'Should return undefined after consuming the buffer')
})

test('peekStaticType returns undefined for empty buffer', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  t.is(decoder.peekStaticType(), undefined)
})

test('peekStaticType handles invalid major types', (t) => {
  // Test with non-integer major type
  const bytes = new Uint8Array([0x65, 0x68, 0x65, 0x6c, 0x6c, 0x6f]) // String "hello"
  const decoder = new Decoder(bytes)

  // Should return undefined for non-integer major type
  t.is(decoder.peekStaticType(), undefined)
})

test('peekStaticType returns undefined for invalid values', (t) => {
  // Test with integer that's beyond the valid range for static types
  // CBOR encoding for 2^64-1 (largest possible uint64)
  const decoder = new Decoder(new Uint8Array([0x1b, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]))
  t.is(decoder.peekStaticType(), undefined)
})

// AspectType method tests
test('aspectType reads aspect type values correctly', (t) => {
  // Valid aspect types from staticTypeTable
  const bytes = new Uint8Array([0x18, staticTypeTable.elementAspect])
  const decoder = new Decoder(bytes)
  t.is(decoder.aspectType(), staticTypeTable.elementAspect)
})

test('aspectType returns undefined for empty buffer', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  t.is(decoder.aspectType(), undefined)
})

test('aspectType throws for invalid aspect types', (t) => {
  // Test with object type (not an aspect type)
  const invalidBytes = new Uint8Array([staticTypeTable.object])
  const invalidDecoder = new Decoder(invalidBytes)
  t.throws(() => invalidDecoder.aspectType(), { message: /Invalid aspect type/ })

  // Test with maximum possible uint64 value (2^64-1), which is way outside aspect type range
  // CBOR encoding for 2^64-1 (uint64 max)
  const maxBytes = new Uint8Array([0x1b, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
  const maxDecoder = new Decoder(maxBytes)
  t.throws(() => maxDecoder.aspectType(), { message: /Unexpected bigint/ })
})

// Annotations method tests
test('annotations reads annotation map correctly', (t) => {
  // CBOR map with 2 entries: {"key1": "value1", "key2": true}
  const bytes = new Uint8Array([
    0xa2, 0x64, 0x6b, 0x65, 0x79, 0x31, 0x66, 0x76, 0x61, 0x6c, 0x75, 0x65, 0x31, 0x64, 0x6b, 0x65, 0x79, 0x32, 0xf5,
  ])

  const decoder = new Decoder(bytes)
  const result = decoder.annotations<{ key1: string; key2: boolean }>()

  t.deepEqual(result, { key1: 'value1', key2: true })
})

test('annotations reads various value types correctly', (t) => {
  // CBOR map with mixed value types
  // Map with:
  // - "int": integer 42
  // - "neg": negative integer -5
  // - "str": string "hello"
  // - "bool": boolean true
  // - "float": float 3.14
  // - "bytes": byte string [1,2,3]
  const bytes = new Uint8Array([
    0xa6, // Map with 6 items
    // Key: "int", Value: integer 42
    0x63,
    0x69,
    0x6e,
    0x74,
    0x18,
    0x2a,
    // Key: "neg", Value: integer -5
    0x63,
    0x6e,
    0x65,
    0x67,
    0x24,
    // Key: "str", Value: string "hello"
    0x63,
    0x73,
    0x74,
    0x72,
    0x65,
    0x68,
    0x65,
    0x6c,
    0x6c,
    0x6f,
    // Key: "bool", Value: true
    0x64,
    0x62,
    0x6f,
    0x6f,
    0x6c,
    0xf5,
    // Key: "float", Value: 3.14
    0x65,
    0x66,
    0x6c,
    0x6f,
    0x61,
    0x74,
    0xfb,
    0x40,
    0x09,
    0x1e,
    0xb8,
    0x51,
    0xeb,
    0x85,
    0x1f,
    // Key: "bytes", Value: bytes [1,2,3]
    0x65,
    0x62,
    0x79,
    0x74,
    0x65,
    0x73,
    0x43,
    0x01,
    0x02,
    0x03,
  ])

  const decoder = new Decoder(bytes)
  const result = decoder.annotations<{
    int: number
    neg: number
    str: string
    bool: boolean
    float: number
    bytes: BytesAccessor
  }>()

  // Test integer values
  t.is(result.int, 42)
  t.is(result.neg, -5)

  // Test string value
  t.is(result.str, 'hello')

  // Test boolean value
  t.true(result.bool)

  // Test float value
  t.is(result.float, 3.14)

  // Test byte string value using a proper BytesAccessor comparison
  t.true(result.bytes instanceof BytesAccessor, 'Result should contain a BytesAccessor')

  // Create an expected BytesAccessor with the same content
  const expectedData = new Uint8Array([1, 2, 3])
  const expectedBytes = new BytesAccessor(expectedData.buffer, expectedData.byteOffset, expectedData.byteLength)

  t.is(result.bytes.compare(expectedBytes), strictlyEqual, 'Bytes content should match expected value')
})

test('annotations handles floating point values', (t) => {
  // CBOR map with floating point value
  // Map with: { "float": 3.14 (half precision) }
  const bytes = new Uint8Array([
    0xa1, // Map with 1 item
    0x65,
    0x66,
    0x6c,
    0x6f,
    0x61,
    0x74, // "float"
    0xf9,
    0x42,
    0x48, // Float16 (3.14 approx)
  ])

  const decoder = new Decoder(bytes)
  const result = decoder.annotations<{ float: number }>()

  t.true(Math.abs(result.float - 3.14) < 0.1, 'Should decode half-precision float')
})

test('annotations reads multiple entries in correct order', (t) => {
  // Map with 3 entries in different order than expected
  const bytes = new Uint8Array([
    0xa3, // Map with 3 items

    // Key: "c", Value: 3
    0x61,
    0x63,
    0x03,

    // Key: "a", Value: 1
    0x61,
    0x61,
    0x01,

    // Key: "b", Value: 2
    0x61,
    0x62,
    0x02,
  ])

  const decoder = new Decoder(bytes)
  const result = decoder.annotations<{ a: number; b: number; c: number }>()

  // Verify all keys are present and in correct order
  t.deepEqual(Object.keys(result), ['c', 'a', 'b'], 'Keys should maintain CBOR order')
  t.is(result.a, 1)
  t.is(result.b, 2)
  t.is(result.c, 3)
})

test('annotations throws for empty buffer', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  t.throws(() => decoder.annotations<Record<string, string>>(), { name: 'AssertionError' })
})

test('annotations throws for incorrect major types', (t) => {
  // Create a byte array with CBOR string (0x65 + "hello") - not a map
  const bytesString = new Uint8Array([0x65, 0x68, 0x65, 0x6c, 0x6c, 0x6f])
  const decoderString = new Decoder(bytesString)
  t.throws(() => decoderString.annotations<Record<string, string>>(), {
    name: 'AssertionError',
    message: /Expected a map with defined length, got major type/,
  })
})

test('annotations throws for indefinite length maps', (t) => {
  // CBOR indefinite length map (0xbf + key-value pairs + break)
  // 0xbf: indefinite length map marker
  // 0x64 + "key1" + 0x66 + "value1": first key-value pair
  // 0x64 + "key2" + 0xf5 (true): second key-value pair
  // 0xff: break code
  const bytes = new Uint8Array([
    0xbf, 0x64, 0x6b, 0x65, 0x79, 0x31, 0x66, 0x76, 0x61, 0x6c, 0x75, 0x65, 0x31, 0x64, 0x6b, 0x65, 0x79, 0x32, 0xf5,
    0xff,
  ])
  const decoder = new Decoder(bytes)

  t.throws(() => decoder.annotations<Record<string, string>>(), {
    name: 'AssertionError',
    message: /Expected a map with defined length, got major type 5 with additional information 31/,
  })
})

test('annotations throws when encountering null values', (t) => {
  // CBOR map with null value
  const bytes = new Uint8Array([
    0xa1, // Map with 1 item
    0x63,
    0x6e,
    0x69,
    0x6c, // "nil"
    0xf6, // Null
  ])

  const decoder = new Decoder(bytes)

  t.throws(() => decoder.annotations<Record<string, string>>(), {
    message: /Unexpected major type/,
  })
})

test('annotations throws for unexpected major types', (t) => {
  // CBOR map with an array value (major type 4)
  const bytes = new Uint8Array([
    0xa1, // Map with 1 item
    0x63,
    0x61,
    0x72,
    0x72, // Key: "arr"
    0x83,
    0x01,
    0x02,
    0x03, // Value: array [1,2,3]
  ])

  const decoder = new Decoder(bytes)
  t.throws(() => decoder.annotations<Record<string, string>>(), {
    name: 'AssertionError',
    message: /Unexpected major type 4/,
  })
})

test('hasNext returns correct state based on buffer content', (t) => {
  // Create a decoder with content
  const bytes = new Uint8Array([0x01, 0x02, 0x03]) // Three integers: 1, 2, 3
  const decoder = new Decoder(bytes)

  // Initially should have content
  t.true(decoder.hasNext(), 'Should return true when buffer has content')

  // After reading one item, should still have more
  decoder.int()
  t.true(decoder.hasNext(), 'Should return true when buffer still has content')

  // Read remaining items
  decoder.int()
  decoder.int()

  // Now buffer should be empty
  t.false(decoder.hasNext(), 'Should return false when buffer is empty')
})

test('hasNext returns false for empty buffer', (t) => {
  const emptyDecoder = new Decoder(new Uint8Array([]))
  t.false(emptyDecoder.hasNext(), 'Should return false for empty buffer')
})

test('hasNext can be called multiple times without advancing the pointer', (t) => {
  const bytes = new Uint8Array([0x01]) // Just one integer: 1
  const decoder = new Decoder(bytes)

  // Call hasNext multiple times
  t.true(decoder.hasNext(), 'First call should return true')
  t.true(decoder.hasNext(), 'Second call should return true')
  t.true(decoder.hasNext(), 'Third call should return true')

  // The pointer should not have advanced, so we can still read the value
  t.is(decoder.int(), 1, 'Should be able to read value after multiple hasNext calls')

  // Now the buffer should be empty
  t.false(decoder.hasNext(), 'Should return false after consuming the buffer')
})
