import { mock } from 'node:test'
import test from 'ava'
import { NamedPropertyAccessor, SymbolPropertyAccessor, NamedPropertyGroup, SymbolPropertyGroup } from '../property.ts'
import { StringRepresentation } from '../../values/primitives/string.ts'
import { NumberRepresentation } from '../../values/primitives/number.ts'
import type { SymbolRepresentation } from '../../values/primitives/symbol.ts'
import { strictlyEqual, unequal, comparable, type Comparison } from '../../comparison.ts'
import { finished, partial } from '../../serialization-result.ts'
import { RealValueContext } from '../../real-value-context.ts'
import { Encoder } from '../../encoder.ts'
import { deriveTheme } from '../../theme.ts'
import { Formatter } from '../../formatter.ts'
import { representValue } from '../../represent.ts'
import { serialize } from '../../serialize.ts'
import { deserialize } from '../../deserialize.ts'
import type { ValueRepresentation } from '../../value.d.ts'
import type { TakeWhile } from '../../stack.ts'

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
    deserialized: false,
    compare: (): Comparison => strictlyEqual,
    formatShallow() {
      // No-op
    },
    serializeShallow(encoder: Encoder): typeof finished {
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
    deserialized: false,
    compare: () => strictlyEqual,
    finalFormat() {
      // No-op
    },
    serialize: () => partial,
  } satisfies ValueRepresentation

  const property = new NamedPropertyAccessor(key, mockValue)

  const encoder = new Encoder()
  const result = property.serialize(encoder)

  t.is(result, partial)
})

test('NamedPropertyAccessor - preformat formats different types of keys appropriately', (t) => {
  const theme = deriveTheme()

  // Test with identifier-like key
  const identifierKey = 'validIdentifier'
  const identifierFormatter = new Formatter(theme)
  new NamedPropertyAccessor(identifierKey, new StringRepresentation('value')).preformat(identifierFormatter)
  t.snapshot(identifierFormatter.close().render(), 'Identifier-like key formatting')

  // Test with numeric string key
  const numericKey = '123'
  const numericFormatter = new Formatter(theme)
  new NamedPropertyAccessor(numericKey, new StringRepresentation('value')).preformat(numericFormatter)
  t.snapshot(numericFormatter.close().render(), 'Numeric string key formatting')

  // Test with non-identifier key
  const nonIdentifierKey = 'invalid-identifier'
  const nonIdentifierFormatter = new Formatter(theme)
  new NamedPropertyAccessor(nonIdentifierKey, new StringRepresentation('value')).preformat(nonIdentifierFormatter)
  t.snapshot(nonIdentifierFormatter.close().render(), 'Non-identifier key formatting')
})

test('NamedPropertyAccessor - finalFormat appends theme.property.afterValue and closes formatter', (t) => {
  const key = 'key'
  const value = new StringRepresentation('value')
  const property = new NamedPropertyAccessor(key, value)

  const theme = deriveTheme()
  const formatter = new Formatter(theme)

  // Call finalFormat
  property.finalFormat(formatter)

  // Check the formatter output
  t.is(formatter.render(), theme.property.afterValue)
})

test('NamedPropertyAccessor - deserialized property delegates to value representation', (t) => {
  const arrayValue = representValue([])
  const deserializedArrayValue = deserialize(serialize(arrayValue))

  const propWithArray = new NamedPropertyAccessor('key', arrayValue)
  const propWithDeserialized = new NamedPropertyAccessor('key', deserializedArrayValue)

  t.false(propWithArray.deserialized)
  t.true(propWithDeserialized.deserialized)
})

test('NamedPropertyAccessor.is correctly identifies instances', (t) => {
  const key = 'testKey'
  const value = new StringRepresentation('value')
  const namedProperty = new NamedPropertyAccessor(key, value)

  t.true(NamedPropertyAccessor.is(namedProperty))
  t.false(NamedPropertyAccessor.is(value))

  // Test with SymbolPropertyAccessor (should return false)
  const context = new RealValueContext()
  const symbol = Symbol('test')
  const symbolKey = context.represent(symbol) as SymbolRepresentation
  const symbolProperty = new SymbolPropertyAccessor(symbolKey, value)
  t.false(NamedPropertyAccessor.is(symbolProperty))
})

// SymbolPropertyAccessor Tests
test('SymbolPropertyAccessor - constructor correctly sets key and value, which iterator yields', (t) => {
  const context = new RealValueContext()

  // Test with string value
  const symbol1 = Symbol('testSymbol1')
  const key1 = context.represent(symbol1) as SymbolRepresentation
  const value1 = new StringRepresentation('value')
  const property1 = new SymbolPropertyAccessor(key1, value1)

  const values1 = [...property1]
  t.is(values1.length, 1)
  t.is(values1[0], value1, 'Iterator should yield the string value')

  // Test with number value
  const symbol2 = Symbol('testSymbol2')
  const key2 = context.represent(symbol2) as SymbolRepresentation
  const value2 = new NumberRepresentation(42)
  const property2 = new SymbolPropertyAccessor(key2, value2)

  const values2 = [...property2]
  t.is(values2.length, 1)
  t.is(values2[0], value2, 'Iterator should yield the number value')
})

test('SymbolPropertyAccessor - compare returns unequal for non-SymbolPropertyAccessor', (t) => {
  const context = new RealValueContext()
  const symbol = Symbol('testSymbol')
  // Get symbol representation through context
  const key = context.represent(symbol) as SymbolRepresentation
  const value = new StringRepresentation('value')

  const property = new SymbolPropertyAccessor(key, value)

  t.is(property.compare(value), unequal)
})

test('SymbolPropertyAccessor - compare returns unequal for different symbol keys', (t) => {
  const context = new RealValueContext()
  const symbol1 = Symbol('symbol1')
  const symbol2 = Symbol('symbol2')

  // Get symbol representations through context
  const key1 = context.represent(symbol1) as SymbolRepresentation
  const key2 = context.represent(symbol2) as SymbolRepresentation

  const value = new StringRepresentation('value')

  const property1 = new SymbolPropertyAccessor(key1, value)
  const property2 = new SymbolPropertyAccessor(key2, value)

  t.is(property1.compare(property2), unequal)
})

test('SymbolPropertyAccessor - compare delegates to value comparison when symbol keys match', (t) => {
  const context = new RealValueContext()
  const symbol = Symbol('testSymbol')

  // Create two representations of the same symbol
  const key = context.represent(symbol) as SymbolRepresentation

  const value1 = new StringRepresentation('value1')
  const property1 = new SymbolPropertyAccessor(key, value1)

  const value2 = new StringRepresentation('value2')
  const property2 = new SymbolPropertyAccessor(key, value2)

  // Should return result of comparing values (unequal in this case)
  t.is(property1.compare(property2), unequal)

  // When values are equal
  const value3 = new StringRepresentation('value1')
  const property3 = new SymbolPropertyAccessor(key, value3)
  t.is(property1.compare(property3), strictlyEqual)
})

test('SymbolPropertyAccessor - serialize encodes key and returns partial', (t) => {
  const context = new RealValueContext()
  const symbol = Symbol('testSymbol')
  // Get symbol representation through context
  const key = context.represent(symbol) as SymbolRepresentation
  const value = new StringRepresentation('value')

  const property = new SymbolPropertyAccessor(key, value)

  const encoder = new Encoder()
  const result = property.serialize(encoder)

  t.is(result, partial)
})

test('SymbolPropertyAccessor - preformat formats symbol key correctly', (t) => {
  const context = new RealValueContext()
  const symbol = Symbol('testSymbol')
  const key = context.represent(symbol) as SymbolRepresentation
  const value = new StringRepresentation('value')
  const property = new SymbolPropertyAccessor(key, value)

  const theme = deriveTheme()
  const formatter = new Formatter(theme)

  // Call preformat
  property.preformat(formatter)

  // Use snapshot to verify formatting
  t.snapshot(formatter.close().render(), 'Symbol property key formatting')
})

test('SymbolPropertyAccessor - finalFormat appends theme.property.afterValue and closes formatter', (t) => {
  const context = new RealValueContext()
  const symbol = Symbol('testSymbol')
  const key = context.represent(symbol) as SymbolRepresentation
  const value = new StringRepresentation('value')
  const property = new SymbolPropertyAccessor(key, value)

  const theme = deriveTheme()
  const formatter = new Formatter(theme)

  // Call finalFormat
  property.finalFormat(formatter)

  // Check the formatter output
  t.is(formatter.render(), theme.property.afterValue)
})

test('SymbolPropertyAccessor - deserialized property delegates to value', (t) => {
  const realContext = new RealValueContext()

  const arrayValue = representValue([])
  const deserializedArrayValue = deserialize(serialize(arrayValue))
  const symbol = Symbol('test')
  const symbolKey = realContext.represent(symbol) as SymbolRepresentation

  const propWithArray = new SymbolPropertyAccessor(symbolKey, arrayValue)
  const propWithDeserialized = new SymbolPropertyAccessor(symbolKey, deserializedArrayValue)

  t.false(propWithArray.deserialized)
  t.true(propWithDeserialized.deserialized)
})

test('SymbolPropertyAccessor.is correctly identifies instances', (t) => {
  const context = new RealValueContext()
  const symbol = Symbol('test')
  const symbolKey = context.represent(symbol) as SymbolRepresentation
  const value = new StringRepresentation('value')
  const symbolProperty = new SymbolPropertyAccessor(symbolKey, value)

  t.true(SymbolPropertyAccessor.is(symbolProperty))
  t.false(SymbolPropertyAccessor.is(value))

  // Test with NamedPropertyAccessor (should return false)
  const namedProperty = new NamedPropertyAccessor('key', value)
  t.false(SymbolPropertyAccessor.is(namedProperty))
})

test('SymbolPropertyAccessor - groupForComparison creates group with consecutive symbol properties', (t) => {
  const context = new RealValueContext()

  // Create symbols and their representations
  const symbol1 = Symbol('symbol1')
  const symbol2 = Symbol('symbol2')
  const symbol3 = Symbol('symbol3')
  const key1 = context.represent(symbol1) as SymbolRepresentation
  const key2 = context.represent(symbol2) as SymbolRepresentation
  const key3 = context.represent(symbol3) as SymbolRepresentation

  const value = new StringRepresentation('value')
  const prop1 = new SymbolPropertyAccessor(key1, value)
  const prop2 = new SymbolPropertyAccessor(key2, value)
  const prop3 = new SymbolPropertyAccessor(key3, value)
  const nonSymbolProp = new NamedPropertyAccessor('regular', value)

  // Mock takeWhile function that returns consecutive SymbolPropertyAccessors
  const takeWhile: TakeWhile = function* (condition) {
    for (const value of [prop2, prop3, nonSymbolProp]) {
      if (!condition(value)) return

      yield value
    }
  }

  // Test groupForComparison
  const parent = new StringRepresentation('parent')
  const group = prop1.groupForComparison(takeWhile, parent)

  if (t.truthy(group)) {
    t.true(SymbolPropertyGroup.is(group))

    // Verify the group contains the original property plus the ones from takeWhile
    const groupedProperties = [...group]
    t.is(groupedProperties.length, 3)
    t.is(groupedProperties[0], prop1)
    t.is(groupedProperties[1], prop2)
    t.is(groupedProperties[2], prop3)
  }
})

test('SymbolPropertyAccessor - groupForComparison returns undefined when parent is already a SymbolPropertyGroup', (t) => {
  const context = new RealValueContext()
  const symbol = Symbol('symbol')
  const key = context.represent(symbol) as SymbolRepresentation
  const value = new StringRepresentation('value')
  const prop = new SymbolPropertyAccessor(key, value)

  // Create a SymbolPropertyGroup as parent
  const parent = new SymbolPropertyGroup([])
  const takeWhile: TakeWhile = function* () {
    // No-op
  }

  const result = prop.groupForComparison(takeWhile, parent)
  t.is(result, undefined)
})

test('SymbolPropertyAccessor - groupForComparison works with empty takeWhile result', (t) => {
  const context = new RealValueContext()
  const symbol = Symbol('symbol')
  const key = context.represent(symbol) as SymbolRepresentation
  const value = new StringRepresentation('value')
  const prop = new SymbolPropertyAccessor(key, value)

  const parent = new StringRepresentation('parent')
  // Mock takeWhile that returns no additional properties
  const takeWhile: TakeWhile = function* () {
    // No-op
  }

  const group = prop.groupForComparison(takeWhile, parent)
  if (t.truthy(group)) {
    t.true(SymbolPropertyGroup.is(group))

    // Should contain just the original property
    const groupedProperties = [...group]
    t.is(groupedProperties.length, 1)
    t.is(groupedProperties[0], prop)
  }
})

// For the SymbolPropertyAccessor.orderByIntersection test
test('SymbolPropertyAccessor.orderByIntersection orders properties by intersection', (t) => {
  const context = new RealValueContext()

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

  const propA = new SymbolPropertyAccessor(keyA, value)
  const propB = new SymbolPropertyAccessor(keyB, value)
  const propC = new SymbolPropertyAccessor(keyC, value)
  const propD = new SymbolPropertyAccessor(keyD, value)
  const propE = new SymbolPropertyAccessor(keyE, value)
  const propF = new SymbolPropertyAccessor(keyF, value)

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
  const prop1 = new NamedPropertyAccessor('prop1', new StringRepresentation('value1'))
  const prop2 = new NamedPropertyAccessor('prop2', new StringRepresentation('value2'))

  const group = new NamedPropertyGroup([prop1, prop2])

  const properties = [...group]
  t.is(properties.length, 2)
  t.is(properties[0], prop1)
  t.is(properties[1], prop2)
})

test('NamedPropertyGroup.is correctly identifies instances', (t) => {
  const group = new NamedPropertyGroup([])

  t.true(NamedPropertyGroup.is(group))
  t.false(NamedPropertyGroup.is({}))
})

test('NamedPropertyGroup - compare returns comparable for another NamedPropertyGroup', (t) => {
  const group1 = new NamedPropertyGroup([])
  const group2 = new NamedPropertyGroup([])

  t.is(group1.compare(group2), comparable)
})

test('NamedPropertyGroup - compare returns unequal for non-NamedPropertyGroup', (t) => {
  const group = new NamedPropertyGroup([])

  t.is(group.compare(new StringRepresentation('')), unequal)
})

test('NamedPropertyGroup - deserialized property returns false for empty group and checks first property when present', (t) => {
  const arrayValue = representValue([])
  const deserializedArrayValue = deserialize(serialize(arrayValue))

  // Empty group returns false (no properties to check)
  const emptyGroup = new NamedPropertyGroup([])
  t.false(emptyGroup.deserialized)

  // Group with real context property (first property not deserialized)
  const realProperty = new NamedPropertyAccessor('key', arrayValue)
  const realGroup = new NamedPropertyGroup([realProperty])
  t.false(realGroup.deserialized)

  // Group with deserialized property (first property is deserialized)
  const deserializedProperty = new NamedPropertyAccessor('key', deserializedArrayValue)
  const deserializedGroup = new NamedPropertyGroup([deserializedProperty])
  t.true(deserializedGroup.deserialized)
})

// SymbolPropertyGroup Tests
test('SymbolPropertyGroup - constructor sets properties array', (t) => {
  const context = new RealValueContext()
  const symbol1 = Symbol('symbol1')
  const symbol2 = Symbol('symbol2')

  // Get symbol representations through context
  const key1 = context.represent(symbol1) as SymbolRepresentation
  const key2 = context.represent(symbol2) as SymbolRepresentation

  const prop1 = new SymbolPropertyAccessor(key1, new StringRepresentation('value1'))
  const prop2 = new SymbolPropertyAccessor(key2, new StringRepresentation('value2'))

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

test('SymbolPropertyGroup - align reorders properties based on intersection', (t) => {
  const context = new RealValueContext()

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

  const propA = new SymbolPropertyAccessor(keyA, value)
  const propB = new SymbolPropertyAccessor(keyB, value)
  const propC = new SymbolPropertyAccessor(keyC, value)
  const propD = new SymbolPropertyAccessor(keyD, value)
  const propE = new SymbolPropertyAccessor(keyE, value)
  const propF = new SymbolPropertyAccessor(keyF, value)

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

test('SymbolPropertyGroup - compare returns comparable for another SymbolPropertyGroup', (t) => {
  const group1 = new SymbolPropertyGroup([])
  const group2 = new SymbolPropertyGroup([])

  t.is(group1.compare(group2), comparable)
})

test('SymbolPropertyGroup - compare returns unequal for non-SymbolPropertyGroup', (t) => {
  const group = new SymbolPropertyGroup([])

  t.is(group.compare(new StringRepresentation('')), unequal)
})

test('SymbolPropertyGroup - deserialized property returns false for empty group and checks first property when present', (t) => {
  const realContext = new RealValueContext()

  const symbol = Symbol('test')
  const symbolKey = realContext.represent(symbol) as SymbolRepresentation

  const arrayValue = representValue([])
  const deserializedArrayValue = deserialize(serialize(arrayValue))

  // Empty group returns false (no properties to check)
  const emptyGroup = new SymbolPropertyGroup([])
  t.false(emptyGroup.deserialized)

  // Group with real context property (first property not deserialized)
  const realProperty = new SymbolPropertyAccessor(symbolKey, arrayValue)
  const realGroup = new SymbolPropertyGroup([realProperty])
  t.false(realGroup.deserialized)

  // Group with deserialized property (first property is deserialized)
  const deserializedProperty = new SymbolPropertyAccessor(symbolKey, deserializedArrayValue)
  const deserializedGroup = new SymbolPropertyGroup([deserializedProperty])
  t.true(deserializedGroup.deserialized)
})
