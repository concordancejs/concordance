import test from 'ava'
import { DescriptionContext } from '../../../description-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { WeakSetRepresentation } from '../weak-set.ts'
import { possiblyEqual, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'

// Deserialize method test
test('deserialize creates a comparable WeakSetRepresentation', (t) => {
  const originalContext = new DescriptionContext()
  const weakSet = new WeakSet()
  const original = originalContext.represent(weakSet) as WeakSetRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = WeakSetRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  // Since weak sets can't be iterated, the comparison will be possiblyEqual
  t.is(original.compare(deserialized), possiblyEqual)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same weakSet instance', (t) => {
  const context = new DescriptionContext()
  const weakSet = new WeakSet()

  const weakSetRep1 = context.represent(weakSet) as WeakSetRepresentation
  const weakSetRep2 = context.represent(weakSet) as WeakSetRepresentation

  t.is(weakSetRep1.compare(weakSetRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-WeakSetRepresentation', (t) => {
  const context = new DescriptionContext()
  const weakSet = new WeakSet()
  const object = {}

  const weakSetRep = context.represent(weakSet) as WeakSetRepresentation
  const objectRep = context.represent(object)

  t.is(weakSetRep.compare(objectRep), unequal)
})

test('compare returns possiblyEqual when comparing different weakSet instances', (t) => {
  const context = new DescriptionContext()
  const weakSet1 = new WeakSet()
  const weakSet2 = new WeakSet()

  // Add the same value to both sets
  const value = {}
  weakSet1.add(value)
  weakSet2.add(value)

  const weakSetRep1 = context.represent(weakSet1) as WeakSetRepresentation
  const weakSetRep2 = context.represent(weakSet2) as WeakSetRepresentation

  // Since we can't iterate over weak sets to compare their contents,
  // the comparison result for different instances is possiblyEqual
  t.is(weakSetRep1.compare(weakSetRep2), possiblyEqual)
})

test('compare returns unequal when comparing WeakSets with different constructor names', (t) => {
  const context = new DescriptionContext()

  // Create a regular WeakSet
  const weakSet = new WeakSet()
  const weakSetRep = context.represent(weakSet) as WeakSetRepresentation

  // Create a subclass of WeakSet to get a different constructor name
  class CustomWeakSet extends WeakSet {}
  const customWeakSet = new CustomWeakSet()

  // This will still be represented as WeakSetRepresentation but with a different constructor name
  const customWeakSetRep = context.represent(customWeakSet) as WeakSetRepresentation

  // We can now test handling of different constructor names
  t.is(weakSetRep.compare(customWeakSetRep), unequal)
})

// Serialization test
test('serialize uses weakSet static type', (t) => {
  const context = new DescriptionContext()
  const weakSet = new WeakSet()
  const weakSetRep = context.represent(weakSet) as WeakSetRepresentation

  const encoder = new Encoder()
  weakSetRep.serialize(encoder)

  // Check the overall structure and type with a snapshot
  snapshotEncoded(t, encoder, 'weakSet serialization')

  // Verify the static type
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.weakSet)
})

// FinalFormat tests
test('finalFormat passes object brackets and does not include disambiguation hint by default', (t) => {
  const context = new DescriptionContext()
  const weakSet = new WeakSet()
  const weakSetRep = context.represent(weakSet) as WeakSetRepresentation

  const formatter = new Formatter(deriveTheme())
  weakSetRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should not include explicit disambiguation hint by default
  t.false(rendered.includes('// WeakSet'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'weak set object default format')
})

test('finalFormat passes object brackets and shows disambiguation hint when options.disambiguationHint is true', (t) => {
  const context = new DescriptionContext()
  const weakSet = new WeakSet()
  const weakSetRep = context.represent(weakSet) as WeakSetRepresentation

  const formatter = new Formatter(deriveTheme())
  weakSetRep.finalFormat(formatter, { disambiguationHint: true })

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should include disambiguation hint when requested
  t.true(rendered.includes('// WeakSet'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'weak set object with disambiguation hint')
})
