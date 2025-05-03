import test from 'ava'
import { DescriptionContext } from '../../../describe.ts'
import { Encoder } from '../../../serialize.ts'
import { Decoder, DeserializationContext } from '../../../deserialize.ts'
import { PromiseRepresentation } from '../promise.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'

// Deserialize method test
test('deserialize creates a comparable PromiseRepresentation', (t) => {
  const originalContext = new DescriptionContext()
  const promise = Promise.resolve('value')
  const original = originalContext.represent(promise) as PromiseRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = PromiseRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized), comparable)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same promise instance', (t) => {
  const context = new DescriptionContext()
  const promise = Promise.resolve('value')

  const promiseRep1 = context.represent(promise) as PromiseRepresentation
  const promiseRep2 = context.represent(promise) as PromiseRepresentation

  t.is(promiseRep1.compare(promiseRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-PromiseRepresentation', (t) => {
  const context = new DescriptionContext()
  const promise = Promise.resolve('value')
  const obj = {}

  const promiseRep = context.represent(promise) as PromiseRepresentation
  const objRep = context.represent(obj)

  t.is(promiseRep.compare(objRep), unequal)
})

test('compare returns unequal when comparing different promise instances', (t) => {
  const context = new DescriptionContext()

  // Two different promise instances that resolve to the same value
  const promise1 = Promise.resolve('same value')
  const promise2 = Promise.resolve('same value')

  const promiseRep1 = context.represent(promise1) as PromiseRepresentation
  const promiseRep2 = context.represent(promise2) as PromiseRepresentation

  // For non-deserialized promises, comparison is by reference only
  t.is(promiseRep1.compare(promiseRep2), unequal)
})

test('compare returns comparable when at least one promise is deserialized', (t) => {
  const originalContext = new DescriptionContext()
  const promise = Promise.resolve('value')
  const original = originalContext.represent(promise) as PromiseRepresentation

  // Serialize and deserialize the promise
  const encoder = new Encoder()
  original.serialize(encoder)
  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = PromiseRepresentation.deserialize(deserializationContext, decoder)

  // Create a new representation of a different promise
  const newContext = new DescriptionContext()
  const differentPromise = Promise.resolve('value')
  const differentRep = newContext.represent(differentPromise) as PromiseRepresentation

  // When one is deserialized, they should fall back to object comparison
  t.is(deserialized.compare(differentRep), comparable)
  t.is(differentRep.compare(deserialized), comparable)
})

// Serialization test
test('serialize uses promise static type', (t) => {
  const context = new DescriptionContext()
  const promise = Promise.resolve('value')
  const promiseRep = context.represent(promise) as PromiseRepresentation

  const encoder = new Encoder()
  promiseRep.serialize(encoder)

  // Check the overall structure and type with a snapshot
  snapshotEncoded(t, encoder, 'promise serialization')

  // Verify the static type
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.promise)
})
