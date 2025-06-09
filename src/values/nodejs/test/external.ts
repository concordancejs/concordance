import test from 'ava'
import { RealValueContext } from '../../../real-value-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { ExternalRepresentation } from '../external.ts'
import { possiblyEqual, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { deriveTheme } from '../../../theme.ts'
import { Formatter } from '../../../formatter.ts'

// @ts-expect-error ts2307: Suppress error about missing import
const refNapi = await (import('ref-napi') as Promise<{ default: { instance: Record<string, unknown> } }>)
const externalValue = refNapi.default.instance

// Deserialize method test
test('deserialize creates a working ExternalRepresentation', (t) => {
  const originalContext = new RealValueContext()
  const original = originalContext.represent(externalValue) as ExternalRepresentation

  const encoder = new Encoder()
  original.serializeShallow(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ExternalRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized), possiblyEqual)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same external value instance', (t) => {
  const context = new RealValueContext()

  const rep1 = context.represent(externalValue) as ExternalRepresentation
  const rep2 = context.represent(externalValue) as ExternalRepresentation

  t.is(rep1.compare(rep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-ExternalRepresentation', (t) => {
  const context = new RealValueContext()
  const regularObject = {}

  const externalRep = context.represent(externalValue) as ExternalRepresentation
  const objectRep = context.represent(regularObject)

  t.is(externalRep.compare(objectRep), unequal)
})

test('compare returns unequal when comparing different external values', (t) => {
  const context = new RealValueContext()

  // Create two different external representations
  const rep1 = context.represent(externalValue) as ExternalRepresentation

  // For the second one, we'll use a different object
  const anotherObject = {}
  const rep2 = new ExternalRepresentation(context, anotherObject)

  // Different objects should return unequal per the implementation
  t.is(rep1.compare(rep2), unequal)
})

test('compare returns possiblyEqual when either context is deserialized', (t) => {
  // Create two contexts - one for real value, one for deserialization
  const originalContext = new RealValueContext()

  // Create original representation
  const original = originalContext.represent(externalValue) as ExternalRepresentation

  // Create a serialized version
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  // Deserialize to get a representation with the deserialization context
  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ExternalRepresentation.deserialize(deserializationContext, decoder)

  // Test comparison in both directions
  t.is(
    original.compare(deserialized),
    possiblyEqual,
    'Original comparing with deserialized should return possiblyEqual',
  )

  t.is(
    deserialized.compare(original),
    possiblyEqual,
    'Deserialized comparing with original should return possiblyEqual',
  )
})

// Formatting tests
test('formatShallow applies the correct theme for external values', (t) => {
  const context = new RealValueContext()
  const externalRep = context.represent(externalValue) as ExternalRepresentation

  const formatter = new Formatter(deriveTheme())
  externalRep.formatShallow(formatter)
  const rendered = formatter.close().render()

  // Check if the theme was applied correctly
  t.is(rendered, formatter.theme.external)
})

// Serialization tests
test('serializeShallow uses the external static type', (t) => {
  const context = new RealValueContext()
  const externalRep = context.represent(externalValue) as ExternalRepresentation

  const encoder = new Encoder()
  externalRep.serializeShallow(encoder)

  // Check the overall structure with a snapshot
  snapshotEncoded(t, encoder, 'external serialization')

  // Verify the static type
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.external)
})
