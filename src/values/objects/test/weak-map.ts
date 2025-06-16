import test from 'ava'
import { RealValueContext } from '../../../real-value-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { WeakMapRepresentation } from '../weak-map.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'

// Deserialize method test
test('deserialize creates a comparable WeakMapRepresentation', (t) => {
  const originalContext = new RealValueContext()
  const weakMap = new WeakMap()
  const original = originalContext.represent(weakMap) as WeakMapRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = WeakMapRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized, 'comprehensive'), comparable)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same weakMap instance', (t) => {
  const context = new RealValueContext()
  const weakMap = new WeakMap()

  const weakMapRep1 = context.represent(weakMap) as WeakMapRepresentation
  const weakMapRep2 = context.represent(weakMap) as WeakMapRepresentation

  t.is(weakMapRep1.compare(weakMapRep2, 'comprehensive'), strictlyEqual)
})

test('compare returns unequal when comparing to non-WeakMapRepresentation in comprehensive mode', (t) => {
  const context = new RealValueContext()
  const weakMap = new WeakMap()
  const object = {}

  const weakMapRep = context.represent(weakMap) as WeakMapRepresentation
  const objectRep = context.represent(object)

  t.is(weakMapRep.compare(objectRep, 'comprehensive'), unequal)
})

test('compare returns comparable when comparing to non-WeakMapRepresentation in fuzzy mode', (t) => {
  const context = new RealValueContext()
  const weakMap = new WeakMap()
  const object = {}

  const weakMapRep = context.represent(weakMap) as WeakMapRepresentation
  const objectRep = context.represent(object)

  t.is(weakMapRep.compare(objectRep, 'fuzzy'), comparable)
})

test('compare returns unequal when comparing to non-plain object in fuzzy mode', (t) => {
  const context = new RealValueContext()
  const weakMap = new WeakMap()

  // Create a custom class instance (not a plain object)
  class CustomClass {
    prop = 'value'
  }
  const customInstance = new CustomClass()

  const weakMapRep = context.represent(weakMap) as WeakMapRepresentation
  const customRep = context.represent(customInstance)

  t.is(weakMapRep.compare(customRep, 'fuzzy'), unequal)
})

test('compare returns comparable when comparing different weakMap instances', (t) => {
  const context = new RealValueContext()
  const weakMap1 = new WeakMap()
  const weakMap2 = new WeakMap()

  // Add some entries to both maps
  weakMap1.set({}, 'value1')
  weakMap2.set({}, 'value1')

  const weakMapRep1 = context.represent(weakMap1) as WeakMapRepresentation
  const weakMapRep2 = context.represent(weakMap2) as WeakMapRepresentation

  t.is(weakMapRep1.compare(weakMapRep2, 'comprehensive'), comparable)
})

// Serialization test
test('serialize uses weakMap static type', (t) => {
  const context = new RealValueContext()
  const weakMap = new WeakMap()
  const weakMapRep = context.represent(weakMap) as WeakMapRepresentation

  const encoder = new Encoder()
  weakMapRep.serialize(encoder)

  // Check the overall structure and type with a snapshot
  snapshotEncoded(t, encoder, 'weakMap serialization')

  // Verify the static type
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.weakMap)
})

// FinalFormat tests
test('finalFormat passes object brackets and does not include disambiguation hint by default', (t) => {
  const context = new RealValueContext()
  const weakMap = new WeakMap()
  const weakMapRep = context.represent(weakMap) as WeakMapRepresentation

  const formatter = new Formatter(deriveTheme())
  weakMapRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should not include explicit disambiguation hint by default
  t.false(rendered.includes('// WeakMap'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'weak map object default format')
})

test('finalFormat passes object brackets and shows disambiguation hint when options.disambiguationHint is true', (t) => {
  const context = new RealValueContext()
  const weakMap = new WeakMap()
  const weakMapRep = context.represent(weakMap) as WeakMapRepresentation

  const formatter = new Formatter(deriveTheme())
  weakMapRep.finalFormat(formatter, { disambiguationHint: true })

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should include disambiguation hint when requested
  t.true(rendered.includes('// WeakMap'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'weak map object with disambiguation hint')
})
