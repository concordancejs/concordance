import test from 'ava'
import { DescriptionContext } from '../../../description-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { CryptoKeyRepresentation } from '../crypto-key.ts'
import { possiblyEqual, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { NamedPropertyAccessor } from '../../../accessors/property.ts'
import { NamedPropertyGroup } from '../../../accessors/property.ts'

// Helper to create CryptoKey objects for testing
async function generateCryptoKey() {
  // Generate an HMAC key
  return crypto.subtle.generateKey(
    {
      name: 'HMAC',
      hash: { name: 'SHA-256' },
      length: 256,
    },
    true, // extractable
    ['sign', 'verify'], // usages
  )
}

// Deserialize method test
test('deserialize creates a comparable CryptoKeyRepresentation', async (t) => {
  const originalContext = new DescriptionContext()
  const cryptoKey = await generateCryptoKey()
  const original = originalContext.represent(cryptoKey) as CryptoKeyRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = CryptoKeyRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized), possiblyEqual)
})

// Compare method tests
test('compare returns possiblyEqual when comparing the same cryptoKey instance', async (t) => {
  const context = new DescriptionContext()
  const cryptoKey = await generateCryptoKey()

  const cryptoKeyRep1 = context.represent(cryptoKey) as CryptoKeyRepresentation
  const cryptoKeyRep2 = context.represent(cryptoKey) as CryptoKeyRepresentation

  // CryptoKey objects always compare as possiblyEqual, even when identical
  // This is because their internal state cannot be fully compared
  t.is(cryptoKeyRep1.compare(cryptoKeyRep2), possiblyEqual)
})

test('compare returns unequal when comparing to non-CryptoKeyRepresentation', async (t) => {
  const context = new DescriptionContext()
  const cryptoKey = await generateCryptoKey()
  const obj = {}

  const cryptoKeyRep = context.represent(cryptoKey) as CryptoKeyRepresentation
  const objRep = context.represent(obj)

  t.is(cryptoKeyRep.compare(objRep), unequal)
})

test('compare returns possiblyEqual when comparing different cryptoKey instances with same properties', async (t) => {
  const context = new DescriptionContext()

  // Generate two different keys with same algorithm
  const cryptoKey1 = await generateCryptoKey()
  const cryptoKey2 = await generateCryptoKey()

  const rep1 = context.represent(cryptoKey1) as CryptoKeyRepresentation
  const rep2 = context.represent(cryptoKey2) as CryptoKeyRepresentation

  // Even though they're different keys, they're considered possiblyEqual
  // if super.compare() doesn't return unequal (i.e., same properties)
  t.is(rep1.compare(rep2), possiblyEqual)
})

// iterateProperties test
test('iterateProperties yields type, extractable, algorithm, and usages properties', async (t) => {
  const context = new DescriptionContext()
  const cryptoKey = await generateCryptoKey()
  const cryptoKeyRep = context.represent(cryptoKey) as CryptoKeyRepresentation

  const propertyGroups = [...cryptoKeyRep.iterateProperties()]

  t.is(propertyGroups.length, 1)
  const [namedGroup] = propertyGroups
  t.true(namedGroup instanceof NamedPropertyGroup)

  // Check if the group contains the expected properties
  const properties = [...namedGroup!]
  t.is(properties.length, 4)

  // Create property accessors for expected properties
  const typeValue = context.represent(cryptoKey.type)
  const extractableValue = context.represent(cryptoKey.extractable)
  const algorithmValue = context.represent(cryptoKey.algorithm)
  const usagesValue = context.represent(cryptoKey.usages)

  const typeAccessor = new NamedPropertyAccessor('type', typeValue)
  const extractableAccessor = new NamedPropertyAccessor('extractable', extractableValue)
  const algorithmAccessor = new NamedPropertyAccessor('algorithm', algorithmValue)
  const usagesAccessor = new NamedPropertyAccessor('usages', usagesValue)

  // Find the expected properties
  const typeProperty = properties.find((prop) => {
    return typeAccessor.compare(prop) === strictlyEqual
  })

  const extractableProperty = properties.find((prop) => {
    return extractableAccessor.compare(prop) === strictlyEqual
  })

  const algorithmProperty = properties.find((prop) => {
    return algorithmAccessor.compare(prop) === strictlyEqual
  })

  const usagesProperty = properties.find((prop) => {
    return usagesAccessor.compare(prop) === strictlyEqual
  })

  // Verify that all expected properties were found
  t.truthy(typeProperty, 'type property should be present')
  t.truthy(extractableProperty, 'extractable property should be present')
  t.truthy(algorithmProperty, 'algorithm property should be present')
  t.truthy(usagesProperty, 'usages property should be present')
})

// Serialization test
test('serialize uses cryptoKey static type', async (t) => {
  const context = new DescriptionContext()
  const cryptoKey = await generateCryptoKey()
  const cryptoKeyRep = context.represent(cryptoKey) as CryptoKeyRepresentation

  const encoder = new Encoder()
  cryptoKeyRep.serialize(encoder)

  // Check the overall structure and type with a snapshot
  snapshotEncoded(t, encoder, 'cryptoKey serialization')

  // Verify the static type
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.cryptoKey)
})

test('serializing and deserializing a CryptoKey preserves its structure', async (t) => {
  const originalContext = new DescriptionContext()
  const cryptoKey = await generateCryptoKey()
  const original = originalContext.represent(cryptoKey) as CryptoKeyRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = CryptoKeyRepresentation.deserialize(deserializationContext, decoder)

  // The original and deserialized representations should be comparable
  t.is(original.compare(deserialized), possiblyEqual)
})
