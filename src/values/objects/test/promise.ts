import test from 'ava'
import { DescriptionContext } from '../../../description-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { PromiseRepresentation } from '../promise.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'
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

// finalFormat tests
test('finalFormat passes object brackets and does not include disambiguation hint by default', (t) => {
  const context = new DescriptionContext()
  const promise = Promise.resolve('value')
  const promiseRep = context.represent(promise) as PromiseRepresentation

  const formatter = new Formatter(deriveTheme())
  promiseRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should not include explicit disambiguation hint by default
  t.false(rendered.includes('// Promise'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'promise object default format')
})

test('finalFormat passes object brackets and shows disambiguation hint when options.disambiguationHint is true', (t) => {
  const context = new DescriptionContext()
  const promise = Promise.resolve('value')
  const promiseRep = context.represent(promise) as PromiseRepresentation

  const formatter = new Formatter(deriveTheme())
  promiseRep.finalFormat(formatter, { disambiguationHint: true })

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should include disambiguation hint when requested
  t.true(rendered.includes('// Promise'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'promise object with disambiguation hint')
})
