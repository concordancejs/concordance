import test from 'ava'
import { BooleanRepresentation } from '../boolean.ts'
import { Encoder } from '../../../serialize.ts'
import { Decoder } from '../../../deserialize.ts'
import { strictlyEqual, unequal } from '../../../comparison.ts'
import { StringRepresentation } from '../string.ts'
import { finished } from '../../../serialization-result.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'

test('compare returns strictlyEqual for same booleans', (t) => {
  const a = new BooleanRepresentation(true)
  const b = new BooleanRepresentation(true)

  t.is(a.compare(b), strictlyEqual)
})

test('compare returns unequal for different booleans', (t) => {
  const a = new BooleanRepresentation(true)
  const b = new BooleanRepresentation(false)

  t.is(a.compare(b), unequal)
})

test('compare returns unequal for non-BooleanRepresentation values', (t) => {
  const a = new BooleanRepresentation(true)
  const nonBoolean = new StringRepresentation('true')

  t.is(a.compare(nonBoolean), unequal)
})

test('serializeShallow correctly encodes a boolean', (t) => {
  const representation = new BooleanRepresentation(true)
  const encoder = new Encoder()

  const result = representation.serializeShallow(encoder)

  t.is(result, finished)
  snapshotEncoded(t, encoder)
})

test('serialize calls serializeShallow', (t) => {
  const representation = new BooleanRepresentation(false)
  const encoder = new Encoder()

  const result = representation.serialize(encoder)

  t.is(result, finished)

  const encoder2 = new Encoder()
  representation.serializeShallow(encoder2)
  t.deepEqual(encoder.bytes, encoder2.bytes)
})

test('can serialize and deserialize true', (t) => {
  const original = new BooleanRepresentation(true)
  const encoder = new Encoder()
  original.serialize(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = BooleanRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize false', (t) => {
  const original = new BooleanRepresentation(false)
  const encoder = new Encoder()
  original.serialize(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = BooleanRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})
