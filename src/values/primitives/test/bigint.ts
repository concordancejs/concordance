import test from 'ava'
import { BigIntRepresentation } from '../bigint.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { strictlyEqual, unequal } from '../../../comparison.ts'
import { StringRepresentation } from '../string.ts'
import { finished } from '../../../serialization-result.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

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

test('can serialize and deserialize positive bigints', (t) => {
  const original = new BigIntRepresentation(9_007_199_254_740_993n) // Number larger than MAX_SAFE_INTEGER
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = BigIntRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize negative bigints', (t) => {
  const original = new BigIntRepresentation(-9_007_199_254_740_993n)
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = BigIntRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can handle zero as bigint', (t) => {
  const original = new BigIntRepresentation(0n)
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = BigIntRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('formatShallow correctly formats positive bigint', (t) => {
  const representation = new BigIntRepresentation(42n)
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('42n'))
})

test('formatShallow correctly formats negative bigint', (t) => {
  const representation = new BigIntRepresentation(-42n)
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('-42n'))
})

test('formatShallow correctly formats zero as bigint', (t) => {
  const representation = new BigIntRepresentation(0n)
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('0n'))
})

test('formatShallow correctly formats very large bigint', (t) => {
  // Create a bigint larger than MAX_SAFE_INTEGER
  const representation = new BigIntRepresentation(9_007_199_254_740_993n)
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('9007199254740993n'))
})

test('deserialized property returns false for BigIntRepresentation', (t) => {
  const representation = new BigIntRepresentation(42n)
  t.false(representation.deserialized)
})
