import test from 'ava'
import { MapEntryAccessor, MapEntryGroup } from '../map-entry.ts'
import { StringRepresentation } from '../../values/primitives/string.ts'
import { NumberRepresentation } from '../../values/primitives/number.ts'
import { BooleanRepresentation } from '../../values/primitives/boolean.ts'
import { strictlyEqual, possiblyEqual, unequal, comparable } from '../../comparison.ts'
import { partial } from '../../serialization-result.ts'
import { Encoder } from '../../encoder.ts'
import { RealValueContext } from '../../real-value-context.ts'
import { Decoder } from '../../decoder.ts'
import { DeserializationContext } from '../../deserialization-context.ts'
import type { SymbolRepresentation } from '../../values/primitives/symbol.ts'
import { Formatter } from '../../formatter.ts'
import { deriveTheme } from '../../theme.ts'
import type { ValueRepresentation } from '../../value.d.ts'
import type { TakeWhile } from '../../stack.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import type { MapRepresentation } from '../../values/objects/map.ts'

// Test MapEntryAccessor
test('MapEntryAccessor - constructor sets key and value, which iterator yields in order', (t) => {
  const context = new RealValueContext()

  // Test with string value
  const key1 = new StringRepresentation('key1')
  const value1 = new StringRepresentation('value')
  const mapEntry1 = new MapEntryAccessor(context, key1, value1)

  const values1 = [...mapEntry1]
  t.is(values1.length, 2)
  t.is(values1[0], key1, 'Iterator should yield the key first')
  t.is(values1[1], value1, 'Iterator should yield the string value second')

  // Test with number value
  const key2 = new StringRepresentation('key2')
  const value2 = new NumberRepresentation(42)
  const mapEntry2 = new MapEntryAccessor(context, key2, value2)

  const values2 = [...mapEntry2]
  t.is(values2.length, 2)
  t.is(values2[0], key2, 'Iterator should yield the key first')
  t.is(values2[1], value2, 'Iterator should yield the number value second')
})

test('MapEntryAccessor.is correctly identifies MapEntryAccessor instances', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const mapEntry = new MapEntryAccessor(context, key, value)

  t.true(MapEntryAccessor.is(mapEntry))
  t.false(MapEntryAccessor.is(key))
})

test('MapEntryAccessor - lazy loads value from DeserializationContext when not provided', (t) => {
  // Create a serialized value
  const encoder = new Encoder()
  const valueToDeserialize = new BooleanRepresentation(true)
  valueToDeserialize.serializeShallow(encoder)

  // Set up a deserialization context with this serialized data
  const decoder = new Decoder(encoder.bytes)
  const deserializationContext = new DeserializationContext(decoder)

  // Create a map entry with only a key
  const key = new StringRepresentation('key')
  const mapEntry = new MapEntryAccessor(deserializationContext, key)

  // When we iterate, it should load the value from context
  const yielded = [...mapEntry]
  t.is(yielded.length, 2)
  t.is(yielded[0], key)

  // The value should have been loaded from the deserialization context
  const value = yielded[1]
  t.true(value instanceof BooleanRepresentation)
})

test('MapEntryAccessor - compare returns unequal for non-MapEntryAccessor', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const mapEntry = new MapEntryAccessor(context, key, value)

  const nonMapEntry = {
    compare: () => strictlyEqual,
    serialize: () => partial,
    *[Symbol.iterator]() {
      yield null
    },
  }

  t.is(mapEntry.compare(nonMapEntry as unknown as ValueRepresentation, 'comprehensive'), unequal)
})

test('MapEntryAccessor - compare returns key comparison result when keys are not equal', (t) => {
  const context = new RealValueContext()

  const key1 = new StringRepresentation('key1')
  const value1 = new StringRepresentation('value')
  const mapEntry1 = new MapEntryAccessor(context, key1, value1)

  const key2 = new StringRepresentation('key2')
  const value2 = new StringRepresentation('value')
  const mapEntry2 = new MapEntryAccessor(context, key2, value2)

  // Should return the result of comparing keys (unequal in this case)
  t.is(mapEntry1.compare(mapEntry2, 'comprehensive'), unequal)
})

test('MapEntryAccessor - compare returns value comparison result when keys are equal', (t) => {
  const context = new RealValueContext()

  const key = new StringRepresentation('key')
  const value1 = new StringRepresentation('value1')
  const mapEntry1 = new MapEntryAccessor(context, key, value1)

  // Use a new StringRepresentation with the same content for the key
  const sameKey = new StringRepresentation('key')
  const value2 = new StringRepresentation('value2')
  const mapEntry2 = new MapEntryAccessor(context, sameKey, value2)

  // Keys are strictly equal, so should return result of value comparison
  t.is(mapEntry1.compare(mapEntry2, 'comprehensive'), unequal)

  // Try with equal values too
  const value3 = new StringRepresentation('value1')
  const mapEntry3 = new MapEntryAccessor(context, sameKey, value3)

  // Both keys and values are strictly equal
  t.is(mapEntry1.compare(mapEntry3, 'comprehensive'), strictlyEqual)
})

test('MapEntryAccessor - compare delegates comparison mode to key and value representations', (t) => {
  const context = new RealValueContext()

  // Use the same key for both entries to ensure we reach value comparison
  const key = new StringRepresentation('sameKey')

  // Create a plain object and a custom class instance for values
  class CustomValueClass {
    baz = 3
    qux = 4
  }
  const plainValue = { baz: 3, qux: 4 }
  const customValue = new CustomValueClass()

  // Create map entries with same keys but different value types
  const plainMapEntry = new MapEntryAccessor(context, key, context.represent(plainValue))
  const customMapEntry = new MapEntryAccessor(context, key, context.represent(customValue))

  // In fuzzy mode, different object types should be comparable
  t.is(plainMapEntry.compare(customMapEntry, 'fuzzy'), comparable)
  t.is(customMapEntry.compare(plainMapEntry, 'fuzzy'), comparable)

  // In comprehensive mode, different object types should be unequal
  t.is(plainMapEntry.compare(customMapEntry, 'comprehensive'), unequal)
  t.is(customMapEntry.compare(plainMapEntry, 'comprehensive'), unequal)
})

test('MapEntryAccessor - compare handles strictlyEqual keys across contexts', (t) => {
  const context = new RealValueContext()

  // Create the first map entry
  const key1 = new StringRepresentation('key')
  const value1 = new StringRepresentation('value1')
  const mapEntry1 = new MapEntryAccessor(context, key1, value1)

  // Create a second map entry with the same key content but different instance
  const key2 = new StringRepresentation('key') // Different instance, same content
  const value2 = new StringRepresentation('value1')
  const mapEntry2 = new MapEntryAccessor(context, key2, value2)

  // Keys should be strictly equal because they have the same content
  // Values are also strictly equal
  t.is(mapEntry1.compare(mapEntry2, 'comprehensive'), strictlyEqual)
})

test('MapEntryAccessor - compare handles possiblyEqual keys correctly', (t) => {
  // To test the possiblyEqual branch, we need a type that can be possiblyEqual
  // SymbolRepresentation can be possiblyEqual after deserialization

  const valueContext = new RealValueContext()
  // Create a symbol with description
  const symbol1 = Symbol('test')
  const key1 = valueContext.represent(symbol1) as SymbolRepresentation

  // Serialize the symbol representation
  const encoder = new Encoder()
  key1.serializeShallow(encoder)

  // Deserialize to a new context
  const decoder = new Decoder(encoder.bytes)
  const deserializationContext = new DeserializationContext(decoder)
  const key2 = deserializationContext.next()

  // Verify keys are possiblyEqual (because the symbol was deserialized)
  t.is(key1.compare(key2!), possiblyEqual)

  // Now create map entries with these keys
  const value1 = new StringRepresentation('value1')
  const mapEntry1 = new MapEntryAccessor(valueContext, key1, value1)

  // Different value
  const value2 = new StringRepresentation('value2')
  const mapEntry2 = new MapEntryAccessor(deserializationContext, key2!, value2)

  // Keys are possiblyEqual but values are unequal
  t.is(mapEntry1.compare(mapEntry2, 'comprehensive'), unequal)

  // Same value content
  const value3 = new StringRepresentation('value1')
  const mapEntry3 = new MapEntryAccessor(deserializationContext, key2!, value3)

  // Now with equal values, result should match the value comparison
  t.is(mapEntry1.compare(mapEntry3, 'comprehensive'), strictlyEqual)
})

test('MapEntryAccessor - serialize always returns partial', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const mapEntry = new MapEntryAccessor(context, key, value)

  t.is(mapEntry.serialize(), partial)
})

test('MapEntryAccessor - formatAfterIteration adds mapEntry.afterKey to formatter when value is the key', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const mapEntry = new MapEntryAccessor(context, key, value)

  // Create formatter to test with
  const theme = deriveTheme()
  const formatter = new Formatter(theme)

  // Call formatAfterIteration with key
  mapEntry.formatAfterIteration(formatter, key)

  // Formatter should have the theme's mapEntry.afterKey appended
  const rendered = formatter.close().render()
  t.is(rendered, theme.mapEntry.afterKey)
})

test('MapEntryAccessor - formatAfterIteration does not append anything when value is not the key', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const mapEntry = new MapEntryAccessor(context, key, value)

  // Create formatter to test with
  const theme = deriveTheme()
  const formatter = new Formatter(theme)

  // Call formatAfterIteration with value (not key)
  mapEntry.formatAfterIteration(formatter, value)

  // Formatter should be empty
  const rendered = formatter.close().render()
  t.is(rendered, '')
})

test('MapEntryAccessor - finalFormat appends mapEntry.afterValue to formatter', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const mapEntry = new MapEntryAccessor(context, key, value)

  // Create formatter with a mock to verify close() is called
  const theme = deriveTheme()
  const formatter = new Formatter(theme)

  // Call finalFormat
  mapEntry.finalFormat(formatter)

  // Check that mapEntry.afterValue was appended
  const rendered = formatter.render()
  t.is(rendered, theme.mapEntry.afterValue)
})

test('MapEntryAccessor - deserialized property delegates to context', (t) => {
  const realContext = new RealValueContext()
  const deserializationContext = new DeserializationContext(new Decoder(new Uint8Array()))

  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')

  const realMapEntry = new MapEntryAccessor(realContext, key, value)
  const deserializedMapEntry = new MapEntryAccessor(deserializationContext, key, value)

  t.false(realMapEntry.deserialized)
  t.true(deserializedMapEntry.deserialized)
})

test('MapEntryAccessor - groupForComparison creates group with consecutive map entries', (t) => {
  const context = new RealValueContext()

  // Create map entry accessors
  const key1 = new StringRepresentation('key1')
  const key2 = new StringRepresentation('key2')
  const key3 = new StringRepresentation('key3')
  const value = new StringRepresentation('value')

  const entry1 = new MapEntryAccessor(context, key1, value)
  const entry2 = new MapEntryAccessor(context, key2, value)
  const entry3 = new MapEntryAccessor(context, key3, value)

  // Create a non-MapEntryAccessor to test the takeWhile condition
  const nonMapEntry = new StringRepresentation('not-an-entry')

  // Mock takeWhile function that returns consecutive MapEntryAccessors
  const takeWhile: TakeWhile = function* (condition) {
    for (const value of [entry2, entry3, nonMapEntry]) {
      if (!condition(value)) return
      yield value
    }
  }

  // Test groupForComparison
  const parent = new StringRepresentation('parent')
  const group = entry1.groupForComparison(takeWhile, parent, 'fuzzy')

  if (t.truthy(group)) {
    t.true(MapEntryGroup.is(group))

    // Verify the group contains the original entry plus the ones from takeWhile
    const groupedEntries = [...group]
    t.is(groupedEntries.length, 3)
    t.is(groupedEntries[0], entry1)
    t.is(groupedEntries[1], entry2)
    t.is(groupedEntries[2], entry3)
  }
})

test('MapEntryAccessor - groupForComparison returns undefined when mode is full', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const entry = new MapEntryAccessor(context, key, value)

  const parent = new StringRepresentation('parent')
  const takeWhile: TakeWhile = function* () {
    // No-op
  }

  const result = entry.groupForComparison(takeWhile, parent, 'comprehensive')
  t.is(result, undefined)
})

test('MapEntryAccessor - groupForComparison returns undefined when parent is already a MapEntryGroup', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const entry = new MapEntryAccessor(context, key, value)

  // Create a MapEntryGroup as parent
  const parent = new MapEntryGroup([])
  const takeWhile: TakeWhile = function* () {
    // No-op
  }

  const result = entry.groupForComparison(takeWhile, parent, 'fuzzy')
  t.is(result, undefined)
})

test('MapEntryAccessor - groupForComparison works with empty takeWhile result', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const entry = new MapEntryAccessor(context, key, value)

  const parent = new StringRepresentation('parent')
  // Mock takeWhile that returns no additional entries
  const takeWhile: TakeWhile = function* () {
    // No-op
  }

  const group = entry.groupForComparison(takeWhile, parent, 'fuzzy')
  if (t.truthy(group)) {
    t.true(MapEntryGroup.is(group))

    // Should contain just the original entry
    const groupedEntries = [...group]
    t.is(groupedEntries.length, 1)
    t.is(groupedEntries[0], entry)
  }
})

test('MapEntryAccessor - groupForComparison fully deserializes its accessor', (t) => {
  const { bytes } = new Encoder()
    .staticType(staticTypeTable.map)
    .annotations({ s: 1, p: 1, c: 'Map' })
    // Add map entry aspect
    .staticType(staticTypeTable.mapEntryAspect)
    // First map entry with nested map as value (complex enough to test fullyDeserialize)
    .staticType(staticTypeTable.string)
    .string('outerKey')
    // Nested map as the complex value
    .staticType(staticTypeTable.map)
    .annotations({ s: 1, p: 2, c: 'Map' })
    .staticType(staticTypeTable.mapEntryAspect)
    // Nested map entry
    .staticType(staticTypeTable.string)
    .string('innerKey')
    // Add the value (string 'innerValue')
    .staticType(staticTypeTable.string)
    .string('innerValue')
    .staticType(staticTypeTable.terminator)
    // Second map entry with simple string value
    .staticType(staticTypeTable.string)
    .string('simpleKey')
    .staticType(staticTypeTable.string)
    .string('simpleValue')
    // End map entries
    .staticType(staticTypeTable.terminator)

  const decoder = new Decoder(bytes)
  const context = new DeserializationContext(decoder)

  const mapRep = context.next() as MapRepresentation
  const iterator = mapRep.iterateIterable()
  const { value: entry } = iterator.next() as { value: ValueRepresentation | undefined }
  if (!entry || !MapEntryAccessor.is(entry) || !('groupForComparison' in entry)) {
    t.fail('Expected first entry to be a MapEntryAccessor with groupForComparison method')
    return
  }

  // Mock takeWhile that returns no additional entries
  const takeWhile: TakeWhile = function* () {
    // No-op
  }

  const group = entry.groupForComparison(takeWhile, mapRep, 'fuzzy')
  t.truthy(group, 'Group should be created from MapEntryAccessor')

  const { value: nextEntry } = iterator.next() as { value: ValueRepresentation | undefined }
  if (!nextEntry || !MapEntryAccessor.is(nextEntry)) {
    t.fail('Expected second entry to be a MapEntryAccessor')
    return
  }

  const expected = new MapEntryAccessor(
    new RealValueContext(),
    new StringRepresentation('simpleKey'),
    new StringRepresentation('simpleValue'),
  )
  t.is(expected.compare(nextEntry, 'comprehensive'), strictlyEqual, 'Next entry should match expected simple entry')
})

test('MapEntryAccessor.alignForComparison orders entries by key intersection', (t) => {
  const context = new RealValueContext()
  const value = new StringRepresentation('value')

  const keyA = new StringRepresentation('A')
  const keyB = new StringRepresentation('B')
  const keyC = new StringRepresentation('C')
  const keyD = new StringRepresentation('D')
  const keyE = new StringRepresentation('E')
  const keyF = new StringRepresentation('F')

  const entryA = new MapEntryAccessor(context, keyA, value)
  const entryB = new MapEntryAccessor(context, keyB, value)
  const entryC = new MapEntryAccessor(context, keyC, value)
  const entryD = new MapEntryAccessor(context, keyD, value)
  const entryE = new MapEntryAccessor(context, keyE, value)
  const entryF = new MapEntryAccessor(context, keyF, value)

  // LHS: [A, B, C, D]
  // RHS: [E, B, F, D]
  // Intersection: B and D (should be placed first in result, in the order they appear in LHS)
  const lhsEntries = [entryA, entryB, entryC, entryD]
  const rhsEntries = [entryE, entryB, entryF, entryD]

  // Order by intersection
  const [lhsOrdered, rhsOrdered] = MapEntryAccessor.alignForComparison(lhsEntries, rhsEntries, 'comprehensive')

  // Verify the matching entries are first, in the order they appear in LHS
  t.is(lhsOrdered[0], entryB, 'First intersection (B) should be first in LHS result')
  t.is(lhsOrdered[1], entryD, 'Second intersection (D) should be second in LHS result')
  t.is(rhsOrdered[0], entryB, 'First intersection (B) should be first in RHS result')
  t.is(rhsOrdered[1], entryD, 'Second intersection (D) should be second in RHS result')

  // Verify non-intersecting entries maintain their original order
  t.is(lhsOrdered[2], entryA, 'Non-intersecting entry A should maintain its relative position')
  t.is(lhsOrdered[3], entryC, 'Non-intersecting entry C should maintain its relative position')

  t.is(rhsOrdered[2], entryE, 'Non-intersecting entry E should maintain its relative position')
  t.is(rhsOrdered[3], entryF, 'Non-intersecting entry F should maintain its relative position')
})

test('MapEntryAccessor.alignForComparison drops non-intersecting lhs entries in fuzzy mode', (t) => {
  const context = new RealValueContext()
  const value = new StringRepresentation('value')

  const keyA = new StringRepresentation('A')
  const keyB = new StringRepresentation('B')
  const keyC = new StringRepresentation('C')
  const keyD = new StringRepresentation('D')
  const keyE = new StringRepresentation('E')
  const keyF = new StringRepresentation('F')

  const entryA = new MapEntryAccessor(context, keyA, value)
  const entryB = new MapEntryAccessor(context, keyB, value)
  const entryC = new MapEntryAccessor(context, keyC, value)
  const entryD = new MapEntryAccessor(context, keyD, value)
  const entryE = new MapEntryAccessor(context, keyE, value)
  const entryF = new MapEntryAccessor(context, keyF, value)

  // LHS: [A, B, C, D]
  // RHS: [E, B, F, D]
  // Intersection: B and D (should be placed first in result, in the order they appear in LHS)
  const lhsEntries = [entryA, entryB, entryC, entryD]
  const rhsEntries = [entryE, entryB, entryF, entryD]

  // Order by intersection in fuzzy mode
  const [lhsOrdered, rhsOrdered] = MapEntryAccessor.alignForComparison(lhsEntries, rhsEntries, 'fuzzy')

  // Verify the matching entries are first, in the order they appear in LHS
  t.is(lhsOrdered[0], entryB, 'First intersection (B) should be first in LHS result')
  t.is(lhsOrdered[1], entryD, 'Second intersection (D) should be second in LHS result')
  t.is(rhsOrdered[0], entryB, 'First intersection (B) should be first in RHS result')
  t.is(rhsOrdered[1], entryD, 'Second intersection (D) should be second in RHS result')

  // Verify non-intersecting entries are dropped from lhs in fuzzy mode
  t.is(lhsOrdered.length, 2, 'LHS should only contain intersecting entries in fuzzy mode')

  // Verify non-intersecting entries maintain their original order in RHS
  t.is(rhsOrdered[2], entryE, 'Non-intersecting entry E should maintain its relative position')
  t.is(rhsOrdered[3], entryF, 'Non-intersecting entry F should maintain its relative position')
})

test('MapEntryAccessor.alignForComparison handles comparable keys correctly', (t) => {
  const context = new RealValueContext()

  // Create objects that would be comparable in fuzzy mode
  class CustomClass {
    baz = 3
    qux = 4
  }
  const plainObject = { baz: 3, qux: 4 }
  const customObject = new CustomClass()

  const plainKey = context.represent(plainObject)
  const customKey = context.represent(customObject)

  const value = new StringRepresentation('value')

  const entryWithPlain = new MapEntryAccessor(context, plainKey, value)
  const entryWithCustom = new MapEntryAccessor(context, customKey, value)

  const lhsEntries = [entryWithPlain]
  const rhsEntries = [entryWithCustom]

  // In fuzzy mode, objects with similar structure should be comparable
  const [lhsOrdered, rhsOrdered] = MapEntryAccessor.alignForComparison(lhsEntries, rhsEntries, 'fuzzy')

  // Should be aligned because the keys are comparable
  t.is(lhsOrdered.length, 1)
  t.is(rhsOrdered.length, 1)
  t.is(lhsOrdered[0], entryWithPlain)
  t.is(rhsOrdered[0], entryWithCustom)
})

// MapEntryGroup tests
test('MapEntryGroup - constructor sets entries which iterator yields', (t) => {
  const context = new RealValueContext()

  const key1 = new StringRepresentation('key1')
  const key2 = new StringRepresentation('key2')
  const value = new StringRepresentation('value')

  const entry1 = new MapEntryAccessor(context, key1, value)
  const entry2 = new MapEntryAccessor(context, key2, value)

  const group = new MapEntryGroup([entry1, entry2])

  // Test iteration
  const entries = [...group]
  t.is(entries.length, 2)
  t.is(entries[0], entry1)
  t.is(entries[1], entry2)
})

test('MapEntryGroup.is correctly identifies instances', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const entry = new MapEntryAccessor(context, key, value)

  const group = new MapEntryGroup([entry])

  t.true(MapEntryGroup.is(group))
  t.false(MapEntryGroup.is(entry))
  t.false(MapEntryGroup.is(value))
})

test('MapEntryGroup - compare returns comparable for another MapEntryGroup', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const entry = new MapEntryAccessor(context, key, value)

  const group1 = new MapEntryGroup([entry])
  const group2 = new MapEntryGroup([entry])

  t.is(group1.compare(group2), comparable)
})

test('MapEntryGroup - compare returns unequal for non-MapEntryGroup', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const entry = new MapEntryAccessor(context, key, value)

  const group = new MapEntryGroup([entry])
  const nonGroup = new StringRepresentation('not-a-group')

  t.is(group.compare(nonGroup), unequal)
})

test('MapEntryGroup - compare returns unequal for different lengths', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const entry = new MapEntryAccessor(context, key, value)

  const group1 = new MapEntryGroup([entry])
  const group2 = new MapEntryGroup([entry, entry])

  t.is(group1.compare(group2), unequal)
})

test('MapEntryGroup - deserialized property returns false for empty group and checks first entry when present', (t) => {
  const realContext = new RealValueContext()
  const deserializationContext = new DeserializationContext(new Decoder(new Uint8Array()))

  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')

  const realEntry = new MapEntryAccessor(realContext, key, value)
  const deserializedEntry = new MapEntryAccessor(deserializationContext, key, value)

  // Empty group
  const emptyGroup = new MapEntryGroup([])
  t.false(emptyGroup.deserialized)

  // Group with real entry
  const realGroup = new MapEntryGroup([realEntry])
  t.false(realGroup.deserialized)

  // Group with deserialized entry
  const deserializedGroup = new MapEntryGroup([deserializedEntry])
  t.true(deserializedGroup.deserialized)
})

test('MapEntryGroup - align reorders entries based on intersection', (t) => {
  const context = new RealValueContext()
  const value = new StringRepresentation('value')

  const keyA = new StringRepresentation('A')
  const keyB = new StringRepresentation('B')
  const keyC = new StringRepresentation('C')
  const keyD = new StringRepresentation('D')

  const entryA = new MapEntryAccessor(context, keyA, value)
  const entryB = new MapEntryAccessor(context, keyB, value)
  const entryC = new MapEntryAccessor(context, keyC, value)
  const entryD = new MapEntryAccessor(context, keyD, value)

  // Create groups with different orders
  const group1 = new MapEntryGroup([entryA, entryB, entryC])
  const group2 = new MapEntryGroup([entryC, entryB, entryD])

  // Align the groups
  group1.align(group2, 'comprehensive')

  // Check that group1 was reordered based on intersection with group2
  const group1Entries = [...group1]
  const group2Entries = [...group2]

  // Intersecting entries (B, C) should be first in both groups
  t.is(group1Entries[0], entryB, 'B should be first in group1 after align')
  t.is(group1Entries[1], entryC, 'C should be second in group1 after align')
  t.is(group2Entries[0], entryB, 'B should be first in group2 after align')
  t.is(group2Entries[1], entryC, 'C should be second in group2 after align')
})

test('MapEntryGroup - align does nothing when other is not a MapEntryGroup', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const entry = new MapEntryAccessor(context, key, value)

  const group = new MapEntryGroup([entry])
  const originalEntries = [...group]

  // Try to align with a non-MapEntryGroup
  const nonGroup = new StringRepresentation('not-a-group')
  group.align(nonGroup, 'comprehensive')

  // Group should remain unchanged
  const newEntries = [...group]
  t.deepEqual(newEntries, originalEntries)
})

test('MapEntryGroup - align drops non-intersecting lhs entries in fuzzy mode', (t) => {
  const context = new RealValueContext()
  const value = new StringRepresentation('value')

  const keyA = new StringRepresentation('A')
  const keyB = new StringRepresentation('B')
  const keyC = new StringRepresentation('C')
  const keyD = new StringRepresentation('D')

  const entryA = new MapEntryAccessor(context, keyA, value)
  const entryB = new MapEntryAccessor(context, keyB, value)
  const entryC = new MapEntryAccessor(context, keyC, value)
  const entryD = new MapEntryAccessor(context, keyD, value)

  // Create groups: group1 has A,B,C and group2 has B,D
  const group1 = new MapEntryGroup([entryA, entryB, entryC])
  const group2 = new MapEntryGroup([entryB, entryD])

  // Align in fuzzy mode
  group1.align(group2, 'fuzzy')

  // Check that only intersecting entries remain in group1
  const group1Entries = [...group1]
  const group2Entries = [...group2]

  // Only B should remain in group1 (the intersection)
  t.is(group1Entries.length, 1, 'Group1 should only contain intersecting entries in fuzzy mode')
  t.is(group1Entries[0], entryB, 'Only entry B should remain in group1')

  // Group2 should contain B and D
  t.is(group2Entries.length, 2)
  t.is(group2Entries[0], entryB, 'B should be first in group2')
  t.is(group2Entries[1], entryD, 'D should be second in group2')
})
