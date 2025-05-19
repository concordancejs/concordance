import test from 'ava'
import { NumberRepresentation } from '../number.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { strictlyEqual, unequal } from '../../../comparison.ts'
import { StringRepresentation } from '../string.ts'
import { finished } from '../../../serialization-result.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'

test('compare returns strictlyEqual for same numbers', (t) => {
  const a = new NumberRepresentation(42)
  const b = new NumberRepresentation(42)

  t.is(a.compare(b), strictlyEqual)
})

test('compare returns unequal for different numbers', (t) => {
  const a = new NumberRepresentation(42)
  const b = new NumberRepresentation(43)

  t.is(a.compare(b), unequal)
})

test('compare returns unequal for -0 and 0', (t) => {
  const negativeZero = new NumberRepresentation(-0)
  const positiveZero = new NumberRepresentation(0)

  // Object.is differentiates between -0 and +0
  t.is(negativeZero.compare(positiveZero), unequal)
})

test('compare returns unequal for non-NumberRepresentation values', (t) => {
  const a = new NumberRepresentation(42)
  const nonNumber = new StringRepresentation('42')

  t.is(a.compare(nonNumber), unequal)
})

test('serializeShallow correctly encodes a number', (t) => {
  const representation = new NumberRepresentation(123)
  const encoder = new Encoder()

  const result = representation.serializeShallow(encoder)

  t.is(result, finished)
  snapshotEncoded(t, encoder)
})

test('serialize calls serializeShallow', (t) => {
  const representation = new NumberRepresentation(123)
  const encoder = new Encoder()

  const result = representation.serialize(encoder)

  t.is(result, finished)

  const encoder2 = new Encoder()
  representation.serializeShallow(encoder2)
  t.deepEqual(encoder.bytes, encoder2.bytes)
})

test('can serialize and deserialize positive numbers', (t) => {
  const original = new NumberRepresentation(123.45)
  const encoder = new Encoder()
  original.serialize(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = NumberRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize negative numbers', (t) => {
  const original = new NumberRepresentation(-123.45)
  const encoder = new Encoder()
  original.serialize(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = NumberRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can handle zero', (t) => {
  const original = new NumberRepresentation(0)
  const encoder = new Encoder()
  original.serialize(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = NumberRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can handle special number values', (t) => {
  const testCases = [Infinity, -Infinity, NaN, -0]

  for (const value of testCases) {
    const original = new NumberRepresentation(value)
    const encoder = new Encoder()
    original.serialize(encoder)

    snapshotEncoded(t, encoder, String(value))

    const deserialized = NumberRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
    t.is(original.compare(deserialized), strictlyEqual, `Failed for ${value}`)
  }
})
