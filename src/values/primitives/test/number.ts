import test from 'ava'
import { NumberRepresentation } from '../number.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { strictlyEqual, unequal } from '../../../comparison.ts'
import { StringRepresentation } from '../string.ts'
import { finished } from '../../../serialization-result.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

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

test('acceptsComparisonFrom returns true for NumberRepresentation', (t) => {
  const number1 = new NumberRepresentation(42)
  const number2 = new NumberRepresentation(24)

  t.true(number1.acceptsComparisonFrom(number2))
})

test('acceptsComparisonFrom returns false for non-NumberRepresentation', (t) => {
  const numberRep = new NumberRepresentation(42)
  const stringRep = new StringRepresentation('test')

  t.false(numberRep.acceptsComparisonFrom(stringRep))
})

test('serializeShallow correctly encodes a number', (t) => {
  const representation = new NumberRepresentation(123)
  const encoder = new Encoder()

  const result = representation.serializeShallow(encoder)

  t.is(result, finished)
  snapshotEncoded(t, encoder)
})

test('can serialize and deserialize positive numbers', (t) => {
  const original = new NumberRepresentation(123.45)
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = NumberRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize negative numbers', (t) => {
  const original = new NumberRepresentation(-123.45)
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = NumberRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can handle zero', (t) => {
  const original = new NumberRepresentation(0)
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = NumberRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can handle special number values', (t) => {
  const testCases = [Infinity, -Infinity, Number.NaN, -0]

  for (const value of testCases) {
    const original = new NumberRepresentation(value)
    const encoder = new Encoder()
    original.serializeShallow(encoder)

    snapshotEncoded(t, encoder, String(value))

    const deserialized = NumberRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
    t.is(original.compare(deserialized), strictlyEqual, `Failed for ${value}`)
  }
})

test('formatShallow correctly formats regular number', (t) => {
  const representation = new NumberRepresentation(42)
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('42'))
})

test('formatShallow correctly formats negative number', (t) => {
  const representation = new NumberRepresentation(-42.5)
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('-42.5'))
})

test('formatShallow correctly formats special values', (t) => {
  const specialValues = [
    { value: Infinity, expected: 'Infinity' },
    { value: -Infinity, expected: '-Infinity' },
    { value: Number.NaN, expected: 'NaN' },
    { value: -0, expected: '-0' },
  ]

  for (const { value, expected } of specialValues) {
    const representation = new NumberRepresentation(value)
    const formatter = new Formatter(deriveTheme())

    representation.formatShallow(formatter)
    formatter.close()

    const rendered = formatter.render()
    t.snapshot(rendered, `Snapshot for ${expected}`)
    t.true(rendered.includes(expected), `Should include ${expected}`)
  }
})

test('deserialized property returns false for NumberRepresentation', (t) => {
  const representation = new NumberRepresentation(42)
  t.false(representation.deserialized)
})
