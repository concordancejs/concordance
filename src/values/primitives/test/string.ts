import test from 'ava'
import { StringRepresentation } from '../string.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { strictlyEqual, unequal } from '../../../comparison.ts'
import { NumberRepresentation } from '../number.ts'
import { finished } from '../../../serialization-result.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'

test('compare returns strictlyEqual for same strings', (t) => {
  const a = new StringRepresentation('hello')
  const b = new StringRepresentation('hello')

  t.is(a.compare(b), strictlyEqual)
})

test('compare returns unequal for different strings', (t) => {
  const a = new StringRepresentation('hello')
  const b = new StringRepresentation('world')

  t.is(a.compare(b), unequal)
})

test('compare returns unequal for non-StringRepresentation values', (t) => {
  const a = new StringRepresentation('42')
  const nonString = new NumberRepresentation(42)

  t.is(a.compare(nonString), unequal)
})

test('serializeShallow correctly encodes a string', (t) => {
  const representation = new StringRepresentation('test string')
  const encoder = new Encoder()

  const result = representation.serializeShallow(encoder)

  t.is(result, finished)
  snapshotEncoded(t, encoder)
})

test('can serialize and deserialize regular strings', (t) => {
  const original = new StringRepresentation('hello world')
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize empty strings', (t) => {
  const original = new StringRepresentation('')
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize strings with special characters', (t) => {
  const original = new StringRepresentation('特殊文字 🚀 \n\t\r')
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize very long strings', (t) => {
  const longString = 'a'.repeat(10000)
  const original = new StringRepresentation(longString)
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  const deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize strings with surrogate pairs', (t) => {
  // '𝄞' (musical G clef) is represented by surrogate pair '\uD834\uDD1E'
  // '𝌆' (tai xuan jing symbol) is represented by surrogate pair '\uD834\uDF06'
  const stringWithSurrogatePairs = '𝄞 musical G clef and 𝌆 tai xuan jing symbol'
  const original = new StringRepresentation(stringWithSurrogatePairs)
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)

  // Verify the surrogate pairs are preserved
  t.is(stringWithSurrogatePairs.length, 45) // Length in JavaScript characters (code units)
  t.is([...stringWithSurrogatePairs].length, 43) // Length in Unicode code points
})

test('can handle strings with lone surrogate halves', (t) => {
  // Create strings with high surrogate alone and low surrogate alone
  const highSurrogateAlone = '\uD834abc' // High surrogate without its pair
  const lowSurrogateAlone = 'abc\uDD1E' // Low surrogate without its pair
  const bothHalvesSeparated = '\uD834abc\uDD1E' // Both halves but not as a pair

  // Test high surrogate alone
  let original = new StringRepresentation(highSurrogateAlone)
  let encoder = new Encoder()
  original.serializeShallow(encoder)
  snapshotEncoded(t, encoder, 'high surrogate alone')
  let deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)

  // Test low surrogate alone
  original = new StringRepresentation(lowSurrogateAlone)
  encoder = new Encoder()
  original.serializeShallow(encoder)
  snapshotEncoded(t, encoder, 'low surrogate alone')
  deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)

  // Test both halves but separated
  original = new StringRepresentation(bothHalvesSeparated)
  encoder = new Encoder()
  original.serializeShallow(encoder)
  snapshotEncoded(t, encoder, 'both halves separated')
  deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})
