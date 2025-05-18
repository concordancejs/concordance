import test from 'ava'
import { DescriptionContext } from '../../../description-context.ts'
import { Encoder } from '../../../serialize.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { WeakMapRepresentation } from '../weak-map.ts'
import { possiblyEqual, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'

// Deserialize method test
test('deserialize creates a comparable WeakMapRepresentation', (t) => {
  const originalContext = new DescriptionContext()
  const weakMap = new WeakMap()
  const original = originalContext.represent(weakMap) as WeakMapRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = WeakMapRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  // Since weak maps can't be iterated, the comparison will be possiblyEqual
  t.is(original.compare(deserialized), possiblyEqual)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same weakMap instance', (t) => {
  const context = new DescriptionContext()
  const weakMap = new WeakMap()

  const weakMapRep1 = context.represent(weakMap) as WeakMapRepresentation
  const weakMapRep2 = context.represent(weakMap) as WeakMapRepresentation

  t.is(weakMapRep1.compare(weakMapRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-WeakMapRepresentation', (t) => {
  const context = new DescriptionContext()
  const weakMap = new WeakMap()
  const obj = {}

  const weakMapRep = context.represent(weakMap) as WeakMapRepresentation
  const objRep = context.represent(obj)

  t.is(weakMapRep.compare(objRep), unequal)
})

test('compare returns possiblyEqual when comparing different weakMap instances', (t) => {
  const context = new DescriptionContext()
  const weakMap1 = new WeakMap()
  const weakMap2 = new WeakMap()

  // Add some entries to both maps using the same key
  const key = {}
  weakMap1.set(key, 'value1')
  weakMap2.set(key, 'value1')

  const weakMapRep1 = context.represent(weakMap1) as WeakMapRepresentation
  const weakMapRep2 = context.represent(weakMap2) as WeakMapRepresentation

  // Since we can't iterate over weak maps to compare their contents,
  // the comparison result for different instances is possiblyEqual
  t.is(weakMapRep1.compare(weakMapRep2), possiblyEqual)
})

test('compare returns unequal when comparing WeakMaps with different constructor names', (t) => {
  const context = new DescriptionContext()

  // Create a regular WeakMap
  const weakMap = new WeakMap()
  const weakMapRep = context.represent(weakMap) as WeakMapRepresentation

  // Create a subclass of WeakMap to get a different constructor name
  class CustomWeakMap extends WeakMap {}
  const customWeakMap = new CustomWeakMap()

  // This will still be represented as WeakMapRepresentation but with a different constructor name
  const customWeakMapRep = context.represent(customWeakMap) as WeakMapRepresentation

  // We can now test handling of different constructor names
  t.is(weakMapRep.compare(customWeakMapRep), unequal)
})

// Serialization test
test('serialize uses weakMap static type', (t) => {
  const context = new DescriptionContext()
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
