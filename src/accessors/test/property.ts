import { mock } from 'node:test'
import test from 'ava'
import { NamedPropertyAccessor, SymbolPropertyAccessor, NamedPropertyGroup, SymbolPropertyGroup } from '../property.ts'
import { StringRepresentation } from '../../values/primitives/string.ts'
import { NumberRepresentation } from '../../values/primitives/number.ts'
import { SymbolRepresentation } from '../../values/primitives/symbol.ts'
import { strictlyEqual, unequal, comparable, comparableAfterAlignment, type Comparison } from '../../comparison.ts'
import { finished, partial, partialStoreAsByteArray } from '../../serialization-result.ts'
import { DescriptionContext } from '../../description-context.ts'
import { Encoder } from '../../encoder.ts'
import { Decoder } from '../../decoder.ts'
import { DeserializationContext } from '../../deserialization-context.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { ValueRepresentation } from '../../value.js'

// NamedPropertyAccessor Tests
test('NamedPropertyAccessor - constructor correctly sets key and value, which iterator yields', (t) => {
  // Test with string value
  const key1 = 'propertyName1'
  const value1 = new StringRepresentation('value')
  const property1 = new NamedPropertyAccessor(key1, value1)

  const values1 = [...property1]
  t.is(values1.length, 1)
  t.is(values1[0], value1, 'Iterator should yield the string value')

  // Test with number value
  const key2 = 'propertyName2'
  const value2 = new NumberRepresentation(42)
  const property2 = new NamedPropertyAccessor(key2, value2)

  const values2 = [...property2]
  t.is(values2.length, 1)
  t.is(values2[0], value2, 'Iterator should yield the number value')
})

test('NamedPropertyAccessor - compare returns unequal for non-NamedPropertyAccessor', (t) => {
  const key = 'propertyName'
  const value = new StringRepresentation('value')
  const property = new NamedPropertyAccessor(key, value)

  t.is(property.compare(value), unequal)
})

test('NamedPropertyAccessor - compare returns unequal for different keys', (t) => {
  const value = new StringRepresentation('value')

  const property1 = new NamedPropertyAccessor('prop1', value)
  const property2 = new NamedPropertyAccessor('prop2', value)

  t.is(property1.compare(property2), unequal)
})

test('NamedPropertyAccessor - compare delegates to value comparison when keys match', (t) => {
  const key = 'propertyName'
  const value1 = new StringRepresentation('value1')
  const value2 = new StringRepresentation('value2')

  const property1 = new NamedPropertyAccessor(key, value1)
  const property2 = new NamedPropertyAccessor(key, value2)

  // Should return result of comparing values (unequal in this case)
  t.is(property1.compare(property2), unequal)

  // When values are equal
  const value3 = new StringRepresentation('value1')
  const property3 = new NamedPropertyAccessor(key, value3)
  t.is(property1.compare(property3), strictlyEqual)
})

test('NamedPropertyAccessor - serialize encodes key as string and delegates to value.serializeShallow', (t) => {
  const key = 'propertyName'

  // Create a mock value with serializeShallow
  const mockValue = {
    compare: (): Comparison => strictlyEqual,
    serializeShallow: (encoder: Encoder): typeof finished => {
      encoder.uint8Array(new Uint8Array([42]))
      return finished
    },
  } satisfies ValueRepresentation

  const { mock: spy } = mock.method(mockValue, 'serializeShallow')

  const property = new NamedPropertyAccessor(key, mockValue)

  const encoder = new Encoder()
  const result = property.serialize(encoder)

  // Should return what value.serializeShallow returns
  t.is(result, finished)

  // Verify serializeShallow was called
  t.is(spy.callCount(), 1)
})

test('NamedPropertyAccessor - serialize returns partial when value has no serializeShallow', (t) => {
  const key = 'propertyName'

  // Create a value without serializeShallow
  const mockValue = {
    compare: () => strictlyEqual,
    serialize: () => partial,
  } satisfies ValueRepresentation

  const property = new NamedPropertyAccessor(key, mockValue)

  const encoder = new Encoder()
  const result = property.serialize(encoder)

  t.is(result, partial)
})

// SymbolPropertyAccessor Tests
test('SymbolPropertyAccessor - constructor correctly sets key and value, which iterator yields', (t) => {
  const context = new DescriptionContext()

  // Test with string value
  const symbol1 = Symbol('testSymbol1')
  const key1 = context.represent(symbol1) as SymbolRepresentation
  const value1 = new StringRepresentation('value')
  const property1 = new SymbolPropertyAccessor(context, key1, value1)

  const values1 = [...property1]
  t.is(values1.length, 1)
  t.is(values1[0], value1, 'Iterator should yield the string value')

  // Test with number value
  const symbol2 = Symbol('testSymbol2')
  const key2 = context.represent(symbol2) as SymbolRepresentation
  const value2 = new NumberRepresentation(42)
  const property2 = new SymbolPropertyAccessor(context, key2, value2)

  const values2 = [...property2]
  t.is(values2.length, 1)
  t.is(values2[0], value2, 'Iterator should yield the number value')
})

test('SymbolPropertyAccessor - lazy loads value from DeserializationContext when not provided', (t) => {
  // Create a serialized value
  const encoder = new Encoder()
  const valueToDeserialize = new NumberRepresentation(42)
  valueToDeserialize.serializeShallow(encoder)

  // Set up a deserialization context with this serialized data
  const decoder = new Decoder(encoder.bytes)
  const deserializationContext = new DeserializationContext(decoder)

  // Create a symbol and get its representation through context.represent
  const originalContext = new DescriptionContext()
  const symbol = Symbol('testSymbol')
  const key = originalContext.represent(symbol) as SymbolRepresentation

  // Create a symbol property accessor with only a key
  const property = new SymbolPropertyAccessor(deserializationContext, key)

  // When we iterate, it should load the value from context
  const yielded = [...property]
  t.is(yielded.length, 1)

  // The value should have been loaded from the deserialization context
  const value = yielded[0]!
  t.true(value instanceof NumberRepresentation)

  // Check the value was correctly deserialized by comparing with an equivalent NumberRepresentation
  t.is(value.compare(new NumberRepresentation(42)), strictlyEqual)
})

test('SymbolPropertyAccessor - compare returns unequal for non-SymbolPropertyAccessor', (t) => {
  const context = new DescriptionContext()
  const symbol = Symbol('testSymbol')
  // Get symbol representation through context
  const key = context.represent(symbol) as SymbolRepresentation
  const value = new StringRepresentation('value')

  const property = new SymbolPropertyAccessor(context, key, value)

  t.is(property.compare(value), unequal)
})

test('SymbolPropertyAccessor - compare returns unequal for different symbol keys', (t) => {
  const context = new DescriptionContext()
  const symbol1 = Symbol('symbol1')
  const symbol2 = Symbol('symbol2')

  // Get symbol representations through context
  const key1 = context.represent(symbol1) as SymbolRepresentation
  const key2 = context.represent(symbol2) as SymbolRepresentation

  const value = new StringRepresentation('value')

  const property1 = new SymbolPropertyAccessor(context, key1, value)
  const property2 = new SymbolPropertyAccessor(context, key2, value)

  t.is(property1.compare(property2), unequal)
})

test('SymbolPropertyAccessor - compare delegates to value comparison when symbol keys match', (t) => {
  const context = new DescriptionContext()
  const symbol = Symbol('testSymbol')

  // Create two representations of the same symbol
  const key = context.represent(symbol) as SymbolRepresentation

  const value1 = new StringRepresentation('value1')
  const property1 = new SymbolPropertyAccessor(context, key, value1)

  const value2 = new StringRepresentation('value2')
  const property2 = new SymbolPropertyAccessor(context, key, value2)

  // Should return result of comparing values (unequal in this case)
  t.is(property1.compare(property2), unequal)

  // When values are equal
  const value3 = new StringRepresentation('value1')
  const property3 = new SymbolPropertyAccessor(context, key, value3)
  t.is(property1.compare(property3), strictlyEqual)
})

test('SymbolPropertyAccessor - serialize encodes key and returns partialStoreAsByteArray', (t) => {
  const context = new DescriptionContext()
  const symbol = Symbol('testSymbol')
  // Get symbol representation through context
  const key = context.represent(symbol) as SymbolRepresentation
  const value = new StringRepresentation('value')

  const property = new SymbolPropertyAccessor(context, key, value)

  const encoder = new Encoder()
  const result = property.serialize(encoder)

  t.is(result, partialStoreAsByteArray)
})

// For the SymbolPropertyAccessor.orderByIntersection test
test('SymbolPropertyAccessor.orderByIntersection orders properties by intersection', (t) => {
  const context = new DescriptionContext()

  // Create symbols
  const symbolA = Symbol('symbolA')
  const symbolB = Symbol('symbolB')
  const symbolC = Symbol('symbolC')
  const symbolD = Symbol('symbolD')
  const symbolE = Symbol('symbolE')
  const symbolF = Symbol('symbolF')

  // Get symbol representations through context
  const keyA = context.represent(symbolA) as SymbolRepresentation
  const keyB = context.represent(symbolB) as SymbolRepresentation
  const keyC = context.represent(symbolC) as SymbolRepresentation
  const keyD = context.represent(symbolD) as SymbolRepresentation
  const keyE = context.represent(symbolE) as SymbolRepresentation
  const keyF = context.represent(symbolF) as SymbolRepresentation

  const value = new StringRepresentation('value')

  const propA = new SymbolPropertyAccessor(context, keyA, value)
  const propB = new SymbolPropertyAccessor(context, keyB, value)
  const propC = new SymbolPropertyAccessor(context, keyC, value)
  const propD = new SymbolPropertyAccessor(context, keyD, value)
  const propE = new SymbolPropertyAccessor(context, keyE, value)
  const propF = new SymbolPropertyAccessor(context, keyF, value)

  // LHS: [A, B, C, D]
  // RHS: [E, B, F, D]
  // Intersection: B and D (should be placed first in result, in the order they appear in LHS)
  const lhsProps = [propA, propB, propC, propD]
  const rhsProps = [propE, propB, propF, propD]

  // Order by intersection
  const [lhsOrdered, rhsOrdered] = SymbolPropertyAccessor.orderByIntersection(lhsProps, rhsProps)

  // Verify the matching properties are first, in the order they appear in LHS
  t.is(lhsOrdered[0], propB, 'First intersection (B) should be first in LHS result')
  t.is(lhsOrdered[1], propD, 'Second intersection (D) should be second in LHS result')
  t.is(rhsOrdered[0], propB, 'First intersection (B) should be first in RHS result')
  t.is(rhsOrdered[1], propD, 'Second intersection (D) should be second in RHS result')

  // Verify non-intersecting properties maintain their original order
  t.is(lhsOrdered[2], propA, 'Non-intersecting property A should maintain its relative position')
  t.is(lhsOrdered[3], propC, 'Non-intersecting property C should maintain its relative position')

  t.is(rhsOrdered[2], propE, 'Non-intersecting property E should maintain its relative position')
  t.is(rhsOrdered[3], propF, 'Non-intersecting property F should maintain its relative position')
})

// NamedPropertyGroup Tests
test('NamedPropertyGroup - constructor sets properties which iterator yields', (t) => {
  const context = new DescriptionContext()
  const prop1 = new NamedPropertyAccessor('prop1', new StringRepresentation('value1'))
  const prop2 = new NamedPropertyAccessor('prop2', new StringRepresentation('value2'))

  const group = new NamedPropertyGroup(context, [prop1, prop2])

  const properties = [...group]
  t.is(properties.length, 2)
  t.is(properties[0], prop1)
  t.is(properties[1], prop2)
})

test('NamedPropertyGroup.is correctly identifies instances', (t) => {
  const context = new DescriptionContext()
  const group = new NamedPropertyGroup(context, [])

  t.true(NamedPropertyGroup.is(group))
  t.false(NamedPropertyGroup.is({}))
})

test('NamedPropertyGroup - empty property returns true for empty groups', (t) => {
  const context = new DescriptionContext()
  const emptyGroup = new NamedPropertyGroup(context, [])
  const nonEmptyGroup = new NamedPropertyGroup(context, [
    new NamedPropertyAccessor('prop', new StringRepresentation('value')),
  ])

  t.true(emptyGroup.empty)
  t.false(nonEmptyGroup.empty)
})

test('NamedPropertyGroup - compare returns comparable for another NamedPropertyGroup', (t) => {
  const context = new DescriptionContext()
  const group1 = new NamedPropertyGroup(context, [])
  const group2 = new NamedPropertyGroup(context, [])

  t.is(group1.compare(group2), comparable)
})

test('NamedPropertyGroup - compare returns unequal for non-NamedPropertyGroup', (t) => {
  const context = new DescriptionContext()
  const group = new NamedPropertyGroup(context, [])

  t.is(group.compare(new StringRepresentation('')), unequal)
})

test('NamedPropertyGroup - iterator loads properties from DeserializationContext when deserialized', (t) => {
  // Create properties to test with
  const prop1 = new NamedPropertyAccessor('prop1', new StringRepresentation('value1'))
  const prop2 = new NamedPropertyAccessor('prop2', new NumberRepresentation(42))

  // Create a serialized representation of these properties
  const encoder = new Encoder()

  // Encode the named property aspect type
  encoder.staticType(staticTypeTable.namedPropertyAspect)

  // Serialize the properties
  prop1.serialize(encoder)
  prop2.serialize(encoder)

  // Add a terminator to end the properties
  encoder.staticType(staticTypeTable.terminator)

  // Create a deserialization context with our serialized data
  const decoder = new Decoder(encoder.bytes)
  const deserializationContext = new DeserializationContext(decoder)

  // Create a NamedPropertyGroup with the deserialization context
  // Use an empty array for properties - it should get them from the context
  const group = deserializationContext.namedProperties([])

  // Iterate over the group to load properties from the deserialization context
  const properties = [...group]

  // Verify we got the expected properties
  t.is(properties.length, 2, 'Should load two properties from context')

  // Find and verify prop1
  const foundProp1 = properties.find(
    (prop) =>
      prop instanceof NamedPropertyAccessor &&
      prop.compare(new NamedPropertyAccessor('prop1', new StringRepresentation('value1'))) === strictlyEqual,
  )
  t.truthy(foundProp1, 'Should find property with key "prop1" and value "value1"')

  // Find and verify prop2
  const foundProp2 = properties.find(
    (prop) =>
      prop instanceof NamedPropertyAccessor &&
      prop.compare(new NamedPropertyAccessor('prop2', new NumberRepresentation(42))) === strictlyEqual,
  )
  t.truthy(foundProp2, 'Should find property with key "prop2" and value 42')
})

// SymbolPropertyGroup Tests
test('SymbolPropertyGroup - constructor sets properties array', (t) => {
  const context = new DescriptionContext()
  const symbol1 = Symbol('symbol1')
  const symbol2 = Symbol('symbol2')

  // Get symbol representations through context
  const key1 = context.represent(symbol1) as SymbolRepresentation
  const key2 = context.represent(symbol2) as SymbolRepresentation

  const prop1 = new SymbolPropertyAccessor(context, key1, new StringRepresentation('value1'))
  const prop2 = new SymbolPropertyAccessor(context, key2, new StringRepresentation('value2'))

  const group = new SymbolPropertyGroup([prop1, prop2])

  const properties = [...group]
  t.is(properties.length, 2)
  t.is(properties[0], prop1)
  t.is(properties[1], prop2)
})

test('SymbolPropertyGroup.is correctly identifies instances', (t) => {
  const group = new SymbolPropertyGroup([])

  t.true(SymbolPropertyGroup.is(group))
  t.false(SymbolPropertyGroup.is({}))
})

test('SymbolPropertyGroup - empty property returns true for empty groups', (t) => {
  const emptyGroup = new SymbolPropertyGroup([])

  const context = new DescriptionContext()
  const symbol = Symbol('test')
  // Get symbol representation through context
  const key = context.represent(symbol) as SymbolRepresentation
  const prop = new SymbolPropertyAccessor(context, key, new StringRepresentation('value'))

  const nonEmptyGroup = new SymbolPropertyGroup([prop])

  t.true(emptyGroup.empty)
  t.false(nonEmptyGroup.empty)
})

test('SymbolPropertyGroup - align reorders properties based on intersection', (t) => {
  const context = new DescriptionContext()

  // Create symbols and get their representations through context
  const symbolA = Symbol('symbolA')
  const symbolB = Symbol('symbolB')
  const symbolC = Symbol('symbolC')
  const symbolD = Symbol('symbolD')
  const symbolE = Symbol('symbolE')
  const symbolF = Symbol('symbolF')

  const keyA = context.represent(symbolA) as SymbolRepresentation
  const keyB = context.represent(symbolB) as SymbolRepresentation
  const keyC = context.represent(symbolC) as SymbolRepresentation
  const keyD = context.represent(symbolD) as SymbolRepresentation
  const keyE = context.represent(symbolE) as SymbolRepresentation
  const keyF = context.represent(symbolF) as SymbolRepresentation

  const value = new StringRepresentation('value')

  const propA = new SymbolPropertyAccessor(context, keyA, value)
  const propB = new SymbolPropertyAccessor(context, keyB, value)
  const propC = new SymbolPropertyAccessor(context, keyC, value)
  const propD = new SymbolPropertyAccessor(context, keyD, value)
  const propE = new SymbolPropertyAccessor(context, keyE, value)
  const propF = new SymbolPropertyAccessor(context, keyF, value)

  // Group 1: [A, B, C, D]
  // Group 2: [E, B, F, D]
  // Intersection: B and D (should be placed first, in the order they appear in group2)
  const group1 = new SymbolPropertyGroup([propA, propB, propC, propD])
  const group2 = new SymbolPropertyGroup([propE, propB, propF, propD])

  // Before alignment
  const beforeGroup1 = [...group1]
  t.is(beforeGroup1[0], propA)
  t.is(beforeGroup1[1], propB)
  t.is(beforeGroup1[2], propC)
  t.is(beforeGroup1[3], propD)

  const beforeGroup2 = [...group2]
  t.is(beforeGroup2[0], propE)
  t.is(beforeGroup2[1], propB)
  t.is(beforeGroup2[2], propF)
  t.is(beforeGroup2[3], propD)

  // Perform alignment
  group1.align(group2)

  // After alignment:
  // - Matching properties should be first, in the order they appear in group2
  // - Non-matching properties should maintain their original order
  const afterGroup1 = [...group1]
  t.is(afterGroup1[0], propB, 'First intersection (B) should be first in group1')
  t.is(afterGroup1[1], propD, 'Second intersection (D) should be second in group1')
  t.is(afterGroup1[2], propA, 'Non-intersecting property A should maintain its relative position')
  t.is(afterGroup1[3], propC, 'Non-intersecting property C should maintain its relative position')

  const afterGroup2 = [...group2]
  t.is(afterGroup2[0], propB, 'First intersection (B) should be first in group2')
  t.is(afterGroup2[1], propD, 'Second intersection (D) should be second in group2')
  t.is(afterGroup2[2], propE, 'Non-intersecting property E should maintain its relative position')
  t.is(afterGroup2[3], propF, 'Non-intersecting property F should maintain its relative position')
})

test('SymbolPropertyGroup - compare returns comparableAfterAlignment for another SymbolPropertyGroup', (t) => {
  const group1 = new SymbolPropertyGroup([])
  const group2 = new SymbolPropertyGroup([])

  t.is(group1.compare(group2), comparableAfterAlignment)
})

test('SymbolPropertyGroup - compare returns unequal for non-SymbolPropertyGroup', (t) => {
  const group = new SymbolPropertyGroup([])

  t.is(group.compare(new StringRepresentation('')), unequal)
})
