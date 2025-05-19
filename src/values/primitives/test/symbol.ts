import test from 'ava'
import { SymbolRepresentation } from '../symbol.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { strictlyEqual, unequal, possiblyEqual } from '../../../comparison.ts'
import { StringRepresentation } from '../string.ts'
import { finished } from '../../../serialization-result.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { DescriptionContext } from '../../../description-context.ts'

test('compare returns strictlyEqual for same symbol instance', (t) => {
  const symbol = Symbol('test')
  const context = new DescriptionContext()
  const a = new SymbolRepresentation(context, symbol as unknown as object)
  const b = new SymbolRepresentation(context, symbol as unknown as object)

  t.is(a.compare(b), strictlyEqual)
})

test('compare returns unequal for non-SymbolRepresentation values', (t) => {
  const symbol = Symbol('test')
  const context = new DescriptionContext()
  const a = new SymbolRepresentation(context, symbol as unknown as object)
  const nonSymbol = new StringRepresentation('Symbol(test)')

  t.is(a.compare(nonSymbol), unequal)
})

test('compare returns unequal for different non-registered symbols', (t) => {
  const context = new DescriptionContext()
  const symbol1 = Symbol('test')
  const symbol2 = Symbol('test') // Same description but different symbol
  const a = new SymbolRepresentation(context, symbol1 as unknown as object)
  const b = new SymbolRepresentation(context, symbol2 as unknown as object)

  t.is(a.compare(b), unequal)
})

test('compare returns unequal for differently described symbols after serialization', (t) => {
  const context = new DescriptionContext()
  const symbol1 = Symbol('test')
  const symbol2 = Symbol('test2')
  const a = new SymbolRepresentation(context, symbol1 as unknown as object)
  const b = new SymbolRepresentation(context, symbol2 as unknown as object)

  const encoder = new Encoder()
  a.serialize(encoder)
  const decoder = new Decoder(encoder.bytes.subarray(1))
  const deserializationContext = new DeserializationContext(decoder)
  const deserializedA = SymbolRepresentation.deserialize(deserializationContext, decoder)

  t.is(deserializedA.compare(b), unequal)
})

test('compare returns strictlyEqual for same registered symbol key after serialization', (t) => {
  // Create serialized representation
  const symbol = Symbol.for('test-registry')
  const originalContext = new DescriptionContext()
  const original = new SymbolRepresentation(originalContext, symbol as unknown as object)

  const encoder = new Encoder()
  original.serialize(encoder)

  // Deserialize
  const decoder = new Decoder(encoder.bytes.subarray(1))
  const deserializedContext = new DeserializationContext(decoder)
  const deserialized = SymbolRepresentation.deserialize(deserializedContext, decoder)

  // Compare
  t.is(original.compare(deserialized), strictlyEqual)
})

test('compare returns strictlyEqual for same well-known symbol after serialization', (t) => {
  // Create serialized representation of a well-known symbol
  const symbol = Symbol.iterator
  const originalContext = new DescriptionContext()
  const original = new SymbolRepresentation(originalContext, symbol as unknown as object)

  const encoder = new Encoder()
  original.serialize(encoder)

  // Deserialize
  const decoder = new Decoder(encoder.bytes.subarray(1))
  const deserializedContext = new DeserializationContext(decoder)
  const deserialized = SymbolRepresentation.deserialize(deserializedContext, decoder)

  // Compare
  t.is(original.compare(deserialized), strictlyEqual)
})

test('compare returns possiblyEqual for regular symbols with same string representation', (t) => {
  // Create serialized representation of a regular symbol
  const symbol = Symbol('regular')
  const originalContext = new DescriptionContext()
  const original = new SymbolRepresentation(originalContext, symbol as unknown as object)

  const encoder = new Encoder()
  original.serialize(encoder)

  // Deserialize
  const decoder = new Decoder(encoder.bytes.subarray(1))
  const deserializedContext = new DeserializationContext(decoder)
  const deserialized = SymbolRepresentation.deserialize(deserializedContext, decoder)

  // Compare - should be possiblyEqual since they have the same string representation
  t.is(original.compare(deserialized), possiblyEqual)
})

test('serializeShallow correctly encodes a symbol', (t) => {
  const symbol = Symbol.for('test')
  const context = new DescriptionContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as object)
  const encoder = new Encoder()

  const result = representation.serializeShallow(encoder)

  t.is(result, finished)
  snapshotEncoded(t, encoder)
})

test('serialize calls serializeShallow', (t) => {
  const symbol = Symbol.for('test')
  const context = new DescriptionContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as object)
  const encoder = new Encoder()

  const result = representation.serialize(encoder)

  t.is(result, finished)

  const encoder2 = new Encoder()
  representation.serializeShallow(encoder2)
  t.deepEqual(encoder.bytes, encoder2.bytes)
})

test('serialization includes proper key for registered symbol', (t) => {
  const symbol = Symbol.for('test-key')
  const context = new DescriptionContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as object)
  const encoder = new Encoder()

  representation.serializeShallow(encoder)
  snapshotEncoded(t, encoder)
})

test('serialization includes proper wellKnown for well-known symbols', (t) => {
  const symbol = Symbol.iterator
  const context = new DescriptionContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as object)
  const encoder = new Encoder()

  representation.serializeShallow(encoder)
  snapshotEncoded(t, encoder)
})

test('serialization includes string representation for non-registered symbols', (t) => {
  const symbol = Symbol('custom-description')
  const context = new DescriptionContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as object)
  const encoder = new Encoder()

  representation.serializeShallow(encoder)
  snapshotEncoded(t, encoder)
})

test('serialization handles symbols without description', (t) => {
  const symbol = Symbol()
  const context = new DescriptionContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as object)
  const encoder = new Encoder()

  representation.serializeShallow(encoder)
  snapshotEncoded(t, encoder)
})
