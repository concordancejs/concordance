import test from 'ava'
import * as cbor from 'cbor2'
import { Encoder } from '../encoder.ts'
import { BytesAccessor } from '../accessors/bytes.ts'
import { staticTypeTable } from '../serialization-types.ts'

const cborOptions = {
  cde: false,
  dcbor: false,
  rejectBigInts: false,
  rejectDuplicateKeys: false,
  rejectFloats: false,
  rejectUndefined: false,
  sortKeys: null,
  preferMap: true,
}

// Helper to decode a single CBOR value
const decodeCbor = (bytes: Uint8Array): unknown => cbor.decode(bytes, cborOptions)

// Helper to decode multiple CBOR values when needed
function decodeAllCbor(bytes: Uint8Array): unknown[] {
  return Array.from(new cbor.SequenceEvents(bytes, cborOptions), (mtAiValue) => mtAiValue[2] as unknown)
}

// -----------------------------------------------------------------------------
// Encoder class tests with CBOR verification
// -----------------------------------------------------------------------------

test('bytes returns the serialized data', (t) => {
  const encoder = new Encoder()
  encoder.int(42)

  const bytes = encoder.bytes
  t.true(bytes instanceof Uint8Array)
  t.true(bytes.length > 0)
})

test('staticType writes a static type', (t) => {
  const encoder = new Encoder()
  encoder.staticType(staticTypeTable.string)

  const bytes = encoder.bytes
  // Use decode instead of decodeAllCbor for single value
  const decoded = decodeCbor(bytes)
  t.is(decoded, staticTypeTable.string)
})

test('int writes an integer', (t) => {
  const encoder = new Encoder()
  encoder.int(42)

  const bytes = encoder.bytes
  const decoded = decodeCbor(bytes)
  t.is(decoded, 42)
})

test('bigInt writes bigints correctly', (t) => {
  // Test small bigint (which is represented as a regular integer)
  const encoder1 = new Encoder()
  const smallBigIntValue = BigInt(42)
  encoder1.bigInt(smallBigIntValue)

  const bytes1 = encoder1.bytes
  const decoded1 = decodeCbor(bytes1)

  // Should come back as a number
  t.is(decoded1, Number(smallBigIntValue))

  // Test large bigint (beyond max safe integer)
  const encoder2 = new Encoder()
  const largeBigIntValue = BigInt(Number.MAX_SAFE_INTEGER) + 1n
  encoder2.bigInt(largeBigIntValue)

  const bytes2 = encoder2.bytes
  const decoded2 = decodeCbor(bytes2)

  t.is(decoded2, largeBigIntValue)
})

test('boolean writes a boolean', (t) => {
  const encoder1 = new Encoder()
  encoder1.boolean(true)

  const bytes1 = encoder1.bytes
  const decoded1 = decodeCbor(bytes1)
  t.is(decoded1, true)

  const encoder2 = new Encoder()
  encoder2.boolean(false)
  const bytes2 = encoder2.bytes
  const decoded2 = decodeCbor(bytes2)
  t.is(decoded2, false)
})

test('number writes integers as ints and non-integers as floats', (t) => {
  // Test integer
  const encoder1 = new Encoder()
  encoder1.number(42)

  const bytes1 = encoder1.bytes
  const decoded1 = decodeCbor(bytes1)
  t.is(decoded1, 42)

  // Test float
  const encoder2 = new Encoder()
  encoder2.number(3.14)

  const bytes2 = encoder2.bytes
  const decoded2 = decodeCbor(bytes2)
  t.is(decoded2, 3.14)

  // Test negative zero
  const encoder3 = new Encoder()
  encoder3.number(-0)

  const bytes3 = encoder3.bytes
  const decoded3 = decodeCbor(bytes3)
  t.true(Object.is(decoded3, -0))
})

test('string writes a string', (t) => {
  const encoder = new Encoder()
  encoder.string('hello')

  const bytes = encoder.bytes
  const decoded = decodeCbor(bytes)
  t.is(decoded, 'hello')
})

test('uint8Array writes a byte array', (t) => {
  const encoder = new Encoder()
  const arr = new Uint8Array([1, 2, 3])
  encoder.uint8Array(arr)

  const bytes = encoder.bytes
  const decoded = decodeCbor(bytes) as Uint8Array

  t.true(decoded instanceof Uint8Array)
  t.deepEqual([...decoded], [1, 2, 3])
})

test('annotations writes a map of annotations', (t) => {
  const encoder = new Encoder()
  encoder.annotations({
    name: 'test',
    value: 42,
    flag: true,
    // Test undefined values are filtered out
    optional: undefined,
  })

  const bytes = encoder.bytes
  const decoded = decodeCbor(bytes) as Map<string, unknown>

  // cbor2 decodes maps as Map objects
  t.true(decoded instanceof Map)
  t.is(decoded.get('name'), 'test')
  t.is(decoded.get('value'), 42)
  t.is(decoded.get('flag'), true)
  t.false(decoded.has('optional'))
})

test('annotations handles BytesAccessor objects', (t) => {
  const encoder = new Encoder()
  const buffer = new ArrayBuffer(3)
  const view = new Uint8Array(buffer)
  view.set([1, 2, 3])

  // Create a real BytesAccessor
  const bytesAccessor = new BytesAccessor(buffer, 0, 3)

  encoder.annotations({
    bytes: bytesAccessor,
    name: 'test',
  })

  const bytes = encoder.bytes
  const decoded = decodeCbor(bytes) as Map<string, unknown>

  t.true(decoded instanceof Map)
  const decodedBytes = decoded.get('bytes') as Uint8Array
  t.true(decodedBytes instanceof Uint8Array)
  t.deepEqual([...decodedBytes], [1, 2, 3])
  t.is(decoded.get('name'), 'test')
})

test('terminator writes a terminator', (t) => {
  const encoder = new Encoder()
  encoder.terminator()

  const bytes = encoder.bytes
  const decoded = decodeCbor(bytes)
  t.is(decoded, staticTypeTable.terminator)
})

test('methods can be chained with correct CBOR encoding', (t) => {
  const encoder = new Encoder()
  encoder.int(1).string('test').boolean(true)

  const bytes = encoder.bytes
  const values = decodeAllCbor(bytes)

  t.is(values.length, 3)
  t.is(values[0], 1)
  t.is(values[1], 'test')
  t.is(values[2], true)
})
