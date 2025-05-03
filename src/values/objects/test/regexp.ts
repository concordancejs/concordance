import test from 'ava'
import { DescriptionContext } from '../../../describe.ts'
import { Encoder } from '../../../serialize.ts'
import { Decoder, DeserializationContext } from '../../../deserialize.ts'
import { RegExpRepresentation } from '../regexp.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { NamedPropertyGroup } from '../../../accessors/property.ts'
import { NamedPropertyAccessor } from '../../../accessors/property.ts'

// Deserialize method test
test('deserialize creates a comparable RegExpRepresentation', (t) => {
  const originalContext = new DescriptionContext()
  const regexp = /test/i
  const original = originalContext.represent(regexp) as RegExpRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = RegExpRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized), comparable)
})

// Compare method tests - just basic identity checks since comparison is inherited
test('compare returns strictlyEqual when comparing the same regexp instance', (t) => {
  const context = new DescriptionContext()
  const regexp = /test/i

  const regexpRep1 = context.represent(regexp) as RegExpRepresentation
  const regexpRep2 = context.represent(regexp) as RegExpRepresentation

  t.is(regexpRep1.compare(regexpRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-RegExpRepresentation', (t) => {
  const context = new DescriptionContext()
  const regexp = /test/i
  const obj = {}

  const regexpRep = context.represent(regexp) as RegExpRepresentation
  const objRep = context.represent(obj)

  t.is(regexpRep.compare(objRep), unequal)
})

// The key test - verify that the right properties are included
test('iterateProperties yields flags and source properties for regexps', (t) => {
  const context = new DescriptionContext()
  const regexp = /test/i
  const regexpRep = context.represent(regexp) as RegExpRepresentation

  const propertyGroups = [...regexpRep.iterateProperties()]

  t.is(propertyGroups.length, 1)
  const [namedGroup] = propertyGroups
  t.true(namedGroup instanceof NamedPropertyGroup)

  // Check if the group contains exactly the expected properties
  const properties = [...namedGroup!]
  t.is(properties.length, 2)

  // Create our own property accessors with the same names and values
  // to test comparison logic
  const flagsValue = context.represent(regexp.flags)
  const sourceValue = context.represent(regexp.source)

  const flagsAccessor = new NamedPropertyAccessor('flags', flagsValue)
  const sourceAccessor = new NamedPropertyAccessor('source', sourceValue)

  // Find the flags property from the regexp
  const flagsProperty = properties.find((prop) => {
    // We can use our manually created accessor to compare
    return flagsAccessor.compare(prop) === strictlyEqual
  })

  // Find the source property from the regexp
  const sourceProperty = properties.find((prop) => {
    return sourceAccessor.compare(prop) === strictlyEqual
  })

  // Verify that both properties were found
  t.truthy(flagsProperty)
  t.truthy(sourceProperty)
})

// Serialization test
test('serialize uses regExp static type', (t) => {
  const context = new DescriptionContext()
  const regexp = /test/i
  const regexpRep = context.represent(regexp) as RegExpRepresentation

  const encoder = new Encoder()
  regexpRep.serialize(encoder)

  // Check the overall structure and type with a snapshot
  snapshotEncoded(t, encoder, 'regexp serialization')

  // Verify the static type
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.regExp)
})

test('serializing and deserializing a RegExp preserves its structure', (t) => {
  const originalContext = new DescriptionContext()
  const regexp = /test/i
  const original = originalContext.represent(regexp) as RegExpRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = RegExpRepresentation.deserialize(deserializationContext, decoder)

  // The original and deserialized representations should be comparable
  t.is(original.compare(deserialized), comparable)
})
