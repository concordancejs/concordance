import test from 'ava'
import { RealValueContext } from '../../../real-value-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { MapRepresentation } from '../map.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { MapEntryAccessor } from '../../../accessors/map-entry.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

// Deserialize method test
test('deserialize creates a comparable MapRepresentation', (t) => {
  const originalContext = new RealValueContext()
  const map = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])
  const original = originalContext.represent(map) as MapRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = MapRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized, 'comprehensive'), comparable)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same map instance', (t) => {
  const context = new RealValueContext()
  const map = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])

  const mapRep1 = context.represent(map) as MapRepresentation
  const mapRep2 = context.represent(map) as MapRepresentation

  t.is(mapRep1.compare(mapRep2, 'comprehensive'), strictlyEqual)
})

test('compare returns unequal when comparing to non-MapRepresentation', (t) => {
  const context = new RealValueContext()
  const map = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])
  const object = {}

  const mapRep = context.represent(map) as MapRepresentation
  const objectRep = context.represent(object)

  t.is(mapRep.compare(objectRep, 'comprehensive'), unequal)
  t.is(mapRep.compare(objectRep, 'fuzzy'), unequal)
})

test('compare returns unequal when comparing maps of different sizes', (t) => {
  const context = new RealValueContext()
  const map1 = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])
  const map2 = new Map([['key1', 'value1']])

  const mapRep1 = context.represent(map1) as MapRepresentation
  const mapRep2 = context.represent(map2) as MapRepresentation

  t.is(mapRep1.compare(mapRep2, 'comprehensive'), unequal)
})

test('compare allows different sizes in fuzzy mode', (t) => {
  const context = new RealValueContext()

  // Actual map (this) has more entries than expected map (other)
  const actualMap = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
    ['key3', 'value3'],
  ])
  const expectedMap = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])

  const actualMapRep = context.represent(actualMap) as MapRepresentation
  const expectedMapRep = context.represent(expectedMap) as MapRepresentation

  // In fuzzy mode, actual can have more items than expected
  t.is(actualMapRep.compare(expectedMapRep, 'fuzzy'), comparable)

  // But in comprehensive mode, different sizes should be unequal
  t.is(actualMapRep.compare(expectedMapRep, 'comprehensive'), unequal)
})

test('compare returns comparable when comparing different map instances with same size', (t) => {
  const context = new RealValueContext()
  const map1 = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])
  const map2 = new Map([
    ['key3', 'value3'],
    ['key4', 'value4'],
  ])

  const mapRep1 = context.represent(map1) as MapRepresentation
  const mapRep2 = context.represent(map2) as MapRepresentation

  // Should be comparable, not strictly equal, as they are different instances
  t.is(mapRep1.compare(mapRep2, 'comprehensive'), comparable)
})

test('compare returns comparable when comparing against subclass instances in fuzzy mode', (t) => {
  const context = new RealValueContext()
  const map1 = new Map()
  class SubMap extends Map {}
  const map2 = new SubMap()

  const mapRep1 = context.represent(map1) as MapRepresentation
  const mapRep2 = context.represent(map2) as MapRepresentation

  t.is(mapRep1.compare(mapRep2, 'fuzzy'), comparable)
})

// IterateArrayLike test
test('iterateArrayLike yields no elements for maps', (t) => {
  const context = new RealValueContext()
  const map = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])
  const mapRep = context.represent(map) as MapRepresentation

  const elements = [...mapRep.iterateArrayLike()]

  t.is(elements.length, 0)
})

// IterateIterable test
test('iterateIterable yields entries for maps', (t) => {
  const context = new RealValueContext()
  const map = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])
  const mapRep = context.represent(map) as MapRepresentation

  const entries = [...mapRep.iterateIterable()]

  // Should have two entries
  t.is(entries.length, 2)

  // Each entry should be a MapEntryAccessor
  for (const entry of entries) {
    t.true(entry instanceof MapEntryAccessor)
  }
})

test('iterateIterable preserves entry order', (t) => {
  const context = new RealValueContext()

  // Create a map with specific insertion order
  const map = new Map()
  map.set('key1', 'value1')
  map.set('key2', 'value2')
  map.set('key3', 'value3')

  // Create another map with the same entries but different insertion order
  const map2 = new Map()
  map2.set('key3', 'value3')
  map2.set('key1', 'value1')
  map2.set('key2', 'value2')

  const mapRep = context.represent(map) as MapRepresentation
  const map2Rep = context.represent(map2) as MapRepresentation

  const entries = [...mapRep.iterateIterable()]
  const entries2 = [...map2Rep.iterateIterable()]

  // Should have three entries in each map
  t.is(entries.length, 3)
  t.is(entries2.length, 3)

  // The first entry from map1 should be key1/value1
  // The first entry from map2 should be key3/value3
  // They should be unequal
  t.is(entries[0]!.compare(entries2[0]!, 'comprehensive'), unequal)

  // The first entry of map1 should exactly match the second entry of map2 (both key1/value1)
  t.is(entries[0]!.compare(entries2[1]!, 'comprehensive'), strictlyEqual)

  // The second entry of map1 should match the third entry of map2 (both key2/value2)
  t.is(entries[1]!.compare(entries2[2]!, 'comprehensive'), strictlyEqual)

  // The third entry of map1 should match the first entry of map2 (both key3/value3)
  t.is(entries[2]!.compare(entries2[0]!, 'comprehensive'), strictlyEqual)
})

// Serialization tests
test('serialize uses map static type and includes size annotation', (t) => {
  const context = new RealValueContext()
  const map = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])
  const mapRep = context.represent(map) as MapRepresentation

  const encoder = new Encoder()
  mapRep.serialize(encoder)

  // Check the overall structure and type
  snapshotEncoded(t, encoder, 'map serialization')

  // Verify the static type and annotations manually
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.map)
  const annotations = decoder.annotations<{ s: number }>()
  t.is(annotations.s, 2) // Size should be 2
})

test('serializing and deserializing a Map preserves its structure', (t) => {
  const originalContext = new RealValueContext()

  // Create a map with some entries
  const map = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])

  const original = originalContext.represent(map) as MapRepresentation

  // Serialize it
  const encoder = new Encoder()
  original.serialize(encoder)

  // Deserialize it
  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = MapRepresentation.deserialize(deserializationContext, decoder)

  // The original and deserialized representations should be comparable
  t.is(original.compare(deserialized, 'comprehensive'), comparable)

  // Create a map with different number of entries
  const differentSizeMap = new Map([['key1', 'value1']])
  const differentSizeRep = originalContext.represent(differentSizeMap) as MapRepresentation

  // The deserialized map should be unequal to a map with a different size
  t.is(deserialized.compare(differentSizeRep, 'comprehensive'), unequal)
})

test('handles empty maps correctly', (t) => {
  const context = new RealValueContext()
  const emptyMap = new Map()
  const emptyMapRep = context.represent(emptyMap) as MapRepresentation

  // Empty map should have no iterable entries
  t.is([...emptyMapRep.iterateIterable()].length, 0)

  // Serializing should include size 0
  const encoder = new Encoder()
  emptyMapRep.serialize(encoder)
  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const annotations = decoder.annotations<{ s: number }>()
  t.is(annotations.s, 0)

  // Empty map should be equal to another empty map
  const anotherEmptyMap = new Map()
  const anotherEmptyMapRep = context.represent(anotherEmptyMap) as MapRepresentation

  t.is(emptyMapRep.compare(anotherEmptyMapRep, 'comprehensive'), comparable)
})

// FinalFormat tests
test('finalFormat uses object brackets by default', (t) => {
  const context = new RealValueContext()
  const map = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])
  const mapRep = context.represent(map) as MapRepresentation

  const formatter = new Formatter(deriveTheme())
  mapRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should not include explicit disambiguation hint by default
  // (The constructor name "Map" will still appear as part of the default object formatting)
  t.false(rendered.includes('// Map'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'map default format')
})

test('finalFormat shows disambiguation hint when options.disambiguationHint is true', (t) => {
  const context = new RealValueContext()
  const map = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])
  const mapRep = context.represent(map) as MapRepresentation

  const formatter = new Formatter(deriveTheme())
  mapRep.finalFormat(formatter, { disambiguationHint: true })

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should include the disambiguation hint when options.disambiguationHint is true
  t.true(rendered.includes('// Map'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'map with disambiguation hint')
})
