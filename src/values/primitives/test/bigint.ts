import test from 'ava'
import { BigIntRepresentation } from '../bigint.ts'
import { Encoder } from '../../../serialize.ts'
import { Decoder } from '../../../deserialize.ts'
import { strictlyEqual, unequal } from '../../../comparison.ts'
import { StringRepresentation } from '../string.ts'
import { finished } from '../../../serialization-result.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'

test('compare returns strictlyEqual for same bigints', (t) => {
  const a = new BigIntRepresentation(42n)
  const b = new BigIntRepresentation(42n)

  t.is(a.compare(b), strictlyEqual)
})

test('compare returns unequal for different bigints', (t) => {
  const a = new BigIntRepresentation(42n)
  const b = new BigIntRepresentation(43n)

  t.is(a.compare(b), unequal)
})

test('compare returns unequal for non-BigIntRepresentation values', (t) => {
  const a = new BigIntRepresentation(42n)
  const nonBigInt = new StringRepresentation('42')

  t.is(a.compare(nonBigInt), unequal)
})

test('serializeShallow correctly encodes a bigint', (t) => {
  const representation = new BigIntRepresentation(123n)
  const encoder = new Encoder()

  const result = representation.serializeShallow(encoder)

  t.is(result, finished)
  snapshotEncoded(t, encoder)
})

test('serialize calls serializeShallow', (t) => {
  const representation = new BigIntRepresentation(123n)
  const encoder = new Encoder()

  const result = representation.serialize(encoder)

  t.is(result, finished)

  const encoder2 = new Encoder()
  representation.serializeShallow(encoder2)
  t.deepEqual(encoder.bytes, encoder2.bytes)
})

test('can serialize and deserialize positive bigints', (t) => {
  const original = new BigIntRepresentation(9007199254740993n) // Number larger than MAX_SAFE_INTEGER
  const encoder = new Encoder()
  original.serialize(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = BigIntRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize negative bigints', (t) => {
  const original = new BigIntRepresentation(-9007199254740993n)
  const encoder = new Encoder()
  original.serialize(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = BigIntRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can handle zero as bigint', (t) => {
  const original = new BigIntRepresentation(0n)
  const encoder = new Encoder()
  original.serialize(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = BigIntRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})
