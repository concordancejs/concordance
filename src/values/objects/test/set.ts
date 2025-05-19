import test from 'ava'
import { DescriptionContext } from '../../../description-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { SetRepresentation } from '../set.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'

// Deserialize method test
test('deserialize creates a comparable SetRepresentation', (t) => {
  const originalContext = new DescriptionContext()
  const set = new Set(['value1', 'value2'])
  const original = originalContext.represent(set) as SetRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = SetRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized), comparable)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same set instance', (t) => {
  const context = new DescriptionContext()
  const set = new Set(['value1', 'value2'])

  const setRep1 = context.represent(set) as SetRepresentation
  const setRep2 = context.represent(set) as SetRepresentation

  t.is(setRep1.compare(setRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-SetRepresentation', (t) => {
  const context = new DescriptionContext()
  const set = new Set(['value1', 'value2'])
  const obj = {}

  const setRep = context.represent(set) as SetRepresentation
  const objRep = context.represent(obj)

  t.is(setRep.compare(objRep), unequal)
})

test('compare returns unequal when comparing sets of different sizes', (t) => {
  const context = new DescriptionContext()
  const set1 = new Set(['value1', 'value2'])
  const set2 = new Set(['value1'])

  const setRep1 = context.represent(set1) as SetRepresentation
  const setRep2 = context.represent(set2) as SetRepresentation

  t.is(setRep1.compare(setRep2), unequal)
})

test('compare returns comparable when comparing different set instances with same values', (t) => {
  const context = new DescriptionContext()
  const set1 = new Set(['value1', 'value2'])
  const set2 = new Set(['value1', 'value2'])

  const setRep1 = context.represent(set1) as SetRepresentation
  const setRep2 = context.represent(set2) as SetRepresentation

  // Should be comparable, not strictly equal, as they are different instances
  t.is(setRep1.compare(setRep2), comparable)
})

test('compare returns comparable when comparing sets with different values', (t) => {
  const context = new DescriptionContext()
  const set1 = new Set(['value1', 'value2'])
  const set2 = new Set(['value1', 'different'])

  const setRep1 = context.represent(set1) as SetRepresentation
  const setRep2 = context.represent(set2) as SetRepresentation

  // Further iteration is required to compare values
  t.is(setRep1.compare(setRep2), comparable)
})

test('compare handles sets with complex values', (t) => {
  const context = new DescriptionContext()

  // Create sets with objects and arrays as values
  const value1 = { id: 1 }
  const value2 = { id: 2 }

  const set1 = new Set([value1, value2])

  // Same structure but different object instances
  const set2 = new Set([{ id: 1 }, { id: 2 }])

  const setRep1 = context.represent(set1) as SetRepresentation
  const setRep2 = context.represent(set2) as SetRepresentation

  // Further iteration is required to compare values
  t.is(setRep1.compare(setRep2), comparable)
})

// iterateArrayLike test
test('iterateArrayLike yields no elements for sets', (t) => {
  const context = new DescriptionContext()
  const set = new Set(['value1', 'value2'])
  const setRep = context.represent(set) as SetRepresentation

  const elements = [...setRep.iterateArrayLike()]

  t.is(elements.length, 0)
})

// iterateIterable test
test('iterateIterable yields values for sets', (t) => {
  const context = new DescriptionContext()
  const set = new Set(['value1', 'value2'])
  const setRep = context.represent(set) as SetRepresentation

  const iteratorValues = [...setRep.iterateIterable()]

  // Should have two values
  t.is(iteratorValues.length, 2)

  // We can't compare directly to string representations
  // Instead, extract the actual value representations from the iterators
  const values = iteratorValues.map((iteratorValue) => [...iteratorValue][0]!)

  // Each value should be a representation of the corresponding set value
  const stringValue1 = context.represent('value1')
  const stringValue2 = context.represent('value2')

  // For string values, we can check for strict equality in the comparison
  const hasValue1 = values.some((value) => value.compare(stringValue1) === strictlyEqual)
  const hasValue2 = values.some((value) => value.compare(stringValue2) === strictlyEqual)

  t.true(hasValue1, 'Set should contain value1')
  t.true(hasValue2, 'Set should contain value2')
})

test('iterateIterable preserves insertion order', (t) => {
  const context = new DescriptionContext()

  // Create a set with specific insertion order
  const set = new Set()
  set.add('value1')
  set.add('value2')
  set.add('value3')

  // Create another set with the same values but different insertion order
  const set2 = new Set()
  set2.add('value3')
  set2.add('value1')
  set2.add('value2')

  const setRep = context.represent(set) as SetRepresentation
  const set2Rep = context.represent(set2) as SetRepresentation

  const iteratorValues = [...setRep.iterateIterable()]
  const iteratorValues2 = [...set2Rep.iterateIterable()]

  // Should have three values in each set
  t.is(iteratorValues.length, 3)
  t.is(iteratorValues2.length, 3)

  // Extract the actual values from the iterators
  const values = iteratorValues.map((iteratorValue) => [...iteratorValue][0]!)
  const values2 = iteratorValues2.map((iteratorValue) => [...iteratorValue][0]!)

  // Create string representations for comparison
  const value1Rep = context.represent('value1')
  const value2Rep = context.represent('value2')
  const value3Rep = context.represent('value3')

  // Check first set's order
  t.is(values[0]!.compare(value1Rep), strictlyEqual) // First is 'value1'
  t.is(values[1]!.compare(value2Rep), strictlyEqual) // Second is 'value2'
  t.is(values[2]!.compare(value3Rep), strictlyEqual) // Third is 'value3'

  // Check second set's order
  t.is(values2[0]!.compare(value3Rep), strictlyEqual) // First is 'value3'
  t.is(values2[1]!.compare(value1Rep), strictlyEqual) // Second is 'value1'
  t.is(values2[2]!.compare(value2Rep), strictlyEqual) // Third is 'value2'
})

// Serialization tests
test('serialize uses set static type and includes size annotation', (t) => {
  const context = new DescriptionContext()
  const set = new Set(['value1', 'value2'])
  const setRep = context.represent(set) as SetRepresentation

  const encoder = new Encoder()
  setRep.serialize(encoder)

  // Check the overall structure and type
  snapshotEncoded(t, encoder, 'set serialization')

  // Verify the static type and annotations manually
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.set)
  const annotations = decoder.annotations<{ s: number }>()
  t.is(annotations.s, 2) // Size should be 2
})

test('serializing and deserializing a Set preserves its structure', (t) => {
  const originalContext = new DescriptionContext()

  // Create a set with some values
  const set = new Set(['value1', 'value2'])

  const original = originalContext.represent(set) as SetRepresentation

  // Serialize it
  const encoder = new Encoder()
  original.serialize(encoder)

  // Deserialize it
  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = SetRepresentation.deserialize(deserializationContext, decoder)

  // The original and deserialized representations should be comparable
  t.is(original.compare(deserialized), comparable)

  // Create a set with different number of values
  const differentSizeSet = new Set(['value1'])
  const differentSizeRep = originalContext.represent(differentSizeSet) as SetRepresentation

  // The deserialized set should be unequal to a set with a different size
  t.is(deserialized.compare(differentSizeRep), unequal)
})

test('handles empty sets correctly', (t) => {
  const context = new DescriptionContext()
  const emptySet = new Set()
  const emptySetRep = context.represent(emptySet) as SetRepresentation

  // Empty set should have no iterable values
  t.is([...emptySetRep.iterateIterable()].length, 0)

  // Serializing should include size 0
  const encoder = new Encoder()
  emptySetRep.serialize(encoder)
  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const annotations = decoder.annotations<{ s: number }>()
  t.is(annotations.s, 0)

  // Empty set should be equal to another empty set
  const anotherEmptySet = new Set()
  const anotherEmptySetRep = context.represent(anotherEmptySet) as SetRepresentation

  t.is(emptySetRep.compare(anotherEmptySetRep), comparable)
})
