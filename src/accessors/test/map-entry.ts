import test from 'ava'
import { MapEntryAccessor } from '../map-entry.ts'
import { StringRepresentation } from '../../values/primitives/string.ts'
import { NumberRepresentation } from '../../values/primitives/number.ts'
import { BooleanRepresentation } from '../../values/primitives/boolean.ts'
import { strictlyEqual, possiblyEqual, unequal } from '../../comparison.ts'
import { partial } from '../../serialization-result.ts'
import { Encoder } from '../../encoder.ts'
import { RealValueContext } from '../../real-value-context.ts'
import { Decoder } from '../../decoder.ts'
import { DeserializationContext } from '../../deserialization-context.ts'
import type { SymbolRepresentation } from '../../values/primitives/symbol.ts'
import { Formatter } from '../../formatter.ts'
import { deriveTheme } from '../../theme.ts'
import type { ValueRepresentation } from '../../value.d.ts'

// Test constructor and basic properties
test('constructor sets key and value, which iterator yields in order', (t) => {
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

// Test is static method
test('is correctly identifies MapEntryAccessor instances', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const mapEntry = new MapEntryAccessor(context, key, value)

  t.true(MapEntryAccessor.is(mapEntry))
  t.false(MapEntryAccessor.is({}))
  t.false(MapEntryAccessor.is(key))
})

// Test lazy loading from DeserializationContext
test('lazy loads value from DeserializationContext when not provided', (t) => {
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

// Test compare
test('compare returns unequal for non-MapEntryAccessor', (t) => {
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

  t.is(mapEntry.compare(nonMapEntry as unknown as ValueRepresentation), unequal)
})

test('compare returns key comparison result when keys are not equal', (t) => {
  const context = new RealValueContext()

  const key1 = new StringRepresentation('key1')
  const value1 = new StringRepresentation('value')
  const mapEntry1 = new MapEntryAccessor(context, key1, value1)

  const key2 = new StringRepresentation('key2')
  const value2 = new StringRepresentation('value')
  const mapEntry2 = new MapEntryAccessor(context, key2, value2)

  // Should return the result of comparing keys (unequal in this case)
  t.is(mapEntry1.compare(mapEntry2), unequal)
})

test('compare returns value comparison result when keys are equal', (t) => {
  const context = new RealValueContext()

  const key = new StringRepresentation('key')
  const value1 = new StringRepresentation('value1')
  const mapEntry1 = new MapEntryAccessor(context, key, value1)

  // Use a new StringRepresentation with the same content for the key
  const sameKey = new StringRepresentation('key')
  const value2 = new StringRepresentation('value2')
  const mapEntry2 = new MapEntryAccessor(context, sameKey, value2)

  // Keys are strictly equal, so should return result of value comparison
  t.is(mapEntry1.compare(mapEntry2), unequal)

  // Try with equal values too
  const value3 = new StringRepresentation('value1')
  const mapEntry3 = new MapEntryAccessor(context, sameKey, value3)

  // Both keys and values are strictly equal
  t.is(mapEntry1.compare(mapEntry3), strictlyEqual)
})

test('compare handles strictlyEqual keys across contexts', (t) => {
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
  t.is(mapEntry1.compare(mapEntry2), strictlyEqual)
})

test('compare handles possiblyEqual keys correctly', (t) => {
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
  t.is(mapEntry1.compare(mapEntry2), unequal)

  // Same value content
  const value3 = new StringRepresentation('value1')
  const mapEntry3 = new MapEntryAccessor(deserializationContext, key2!, value3)

  // Now with equal values, result should match the value comparison
  t.is(mapEntry1.compare(mapEntry3), strictlyEqual)
})

// Test serialize
test('serialize always returns partial', (t) => {
  const context = new RealValueContext()
  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')
  const mapEntry = new MapEntryAccessor(context, key, value)

  t.is(mapEntry.serialize(), partial)
})

// Test formatAfterIteration
test('formatAfterIteration adds mapEntry.afterKey to formatter when value is the key', (t) => {
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

test('formatAfterIteration does not append anything when value is not the key', (t) => {
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

// Test finalFormat
test('finalFormat appends mapEntry.afterValue to formatter', (t) => {
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

test('deserialized property delegates to context', (t) => {
  const realContext = new RealValueContext()
  const deserializationContext = new DeserializationContext(new Decoder(new Uint8Array()))

  const key = new StringRepresentation('key')
  const value = new StringRepresentation('value')

  const realMapEntry = new MapEntryAccessor(realContext, key, value)
  const deserializedMapEntry = new MapEntryAccessor(deserializationContext, key, value)

  t.false(realMapEntry.deserialized)
  t.true(deserializedMapEntry.deserialized)
})
