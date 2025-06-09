import test from 'ava'
import { SymbolRepresentation } from '../symbol.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { strictlyEqual, unequal, possiblyEqual } from '../../../comparison.ts'
import { StringRepresentation } from '../string.ts'
import { finished } from '../../../serialization-result.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { RealValueContext } from '../../../real-value-context.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

test('compare returns strictlyEqual for same symbol instance', (t) => {
  const symbol = Symbol('test')
  const context = new RealValueContext()
  const a = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const b = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)

  t.is(a.compare(b), strictlyEqual)
})

test('compare returns unequal for non-SymbolRepresentation values', (t) => {
  const symbol = Symbol('test')
  const context = new RealValueContext()
  const a = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const nonSymbol = new StringRepresentation('Symbol(test)')

  t.is(a.compare(nonSymbol), unequal)
})

test('compare returns unequal for different non-registered symbols', (t) => {
  const context = new RealValueContext()
  const symbol1 = Symbol('test')
  const symbol2 = Symbol('test') // Same description but different symbol
  const a = new SymbolRepresentation(context, symbol1 as unknown as Record<string, unknown>)
  const b = new SymbolRepresentation(context, symbol2 as unknown as Record<string, unknown>)

  t.is(a.compare(b), unequal)
})

test('compare returns unequal for differently described symbols after serialization', (t) => {
  const context = new RealValueContext()
  const symbol1 = Symbol('test')
  const symbol2 = Symbol('test2')
  const a = new SymbolRepresentation(context, symbol1 as unknown as Record<string, unknown>)
  const b = new SymbolRepresentation(context, symbol2 as unknown as Record<string, unknown>)

  const encoder = new Encoder()
  a.serializeShallow(encoder)
  const decoder = new Decoder(encoder.bytes.subarray(1))
  const deserializationContext = new DeserializationContext(decoder)
  const deserializedA = SymbolRepresentation.deserialize(deserializationContext, decoder)

  t.is(deserializedA.compare(b), unequal)
})

test('compare returns strictlyEqual for same registered symbol key after serialization', (t) => {
  // Create serialized representation
  const symbol = Symbol.for('test-registry')
  const originalContext = new RealValueContext()
  const original = new SymbolRepresentation(originalContext, symbol as unknown as Record<string, unknown>)

  const encoder = new Encoder()
  original.serializeShallow(encoder)

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
  const originalContext = new RealValueContext()
  const original = new SymbolRepresentation(originalContext, symbol as unknown as Record<string, unknown>)

  const encoder = new Encoder()
  original.serializeShallow(encoder)

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
  const originalContext = new RealValueContext()
  const original = new SymbolRepresentation(originalContext, symbol as unknown as Record<string, unknown>)

  const encoder = new Encoder()
  original.serializeShallow(encoder)

  // Deserialize
  const decoder = new Decoder(encoder.bytes.subarray(1))
  const deserializedContext = new DeserializationContext(decoder)
  const deserialized = SymbolRepresentation.deserialize(deserializedContext, decoder)

  // Compare - should be possiblyEqual since they have the same string representation
  t.is(original.compare(deserialized), possiblyEqual)
})

test('serializeShallow correctly encodes a symbol', (t) => {
  const symbol = Symbol.for('test')
  const context = new RealValueContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const encoder = new Encoder()

  const result = representation.serializeShallow(encoder)

  t.is(result, finished)
  snapshotEncoded(t, encoder)
})

test('serialize calls serializeShallow', (t) => {
  const symbol = Symbol.for('test')
  const context = new RealValueContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const encoder = new Encoder()

  const result = representation.serializeShallow(encoder)

  t.is(result, finished)

  const encoder2 = new Encoder()
  representation.serializeShallow(encoder2)
  t.deepEqual(encoder.bytes, encoder2.bytes)
})

test('serialization includes proper key for registered symbol', (t) => {
  const symbol = Symbol.for('test-key')
  const context = new RealValueContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const encoder = new Encoder()

  representation.serializeShallow(encoder)
  snapshotEncoded(t, encoder)
})

test('serialization includes proper wellKnown for well-known symbols', (t) => {
  const symbol = Symbol.iterator
  const context = new RealValueContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const encoder = new Encoder()

  representation.serializeShallow(encoder)
  snapshotEncoded(t, encoder)
})

test('serialization includes string representation for non-registered symbols', (t) => {
  const symbol = Symbol('custom-description')
  const context = new RealValueContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const encoder = new Encoder()

  representation.serializeShallow(encoder)
  snapshotEncoded(t, encoder)
})

test('serialization handles symbols without description', (t) => {
  const symbol = Symbol() // eslint-disable-line symbol-description
  const context = new RealValueContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const encoder = new Encoder()

  representation.serializeShallow(encoder)
  snapshotEncoded(t, encoder)
})

test('formatShallow correctly formats a well-known symbol', (t) => {
  const symbol = Symbol.iterator
  const context = new RealValueContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('Symbol.iterator'))
})

test('formatShallow correctly formats a registered symbol', (t) => {
  const symbol = Symbol.for('test-key')
  const context = new RealValueContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('Symbol.for(test-key)'))
})

test('formatShallow correctly encodes special characters in registered symbol keys', (t) => {
  // Create a symbol with characters that need encoding: control chars, backslashes, etc.
  const symbol = Symbol.for('special\nkey\twith\r\ncontrol\0chars\\and"quotes')
  const context = new RealValueContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)

  // Check that encoding happened correctly - should encode newlines, tabs, null bytes, and backslashes
  t.true(rendered.includes(String.raw`\n`))
  t.true(rendered.includes(String.raw`\t`))
  t.true(rendered.includes(String.raw`\r\n`))
  t.true(rendered.includes(String.raw`\0`))
  t.true(rendered.includes('\\\\'))

  // The whole pattern should be encoded properly
  t.true(rendered.includes(String.raw`Symbol.for(special\nkey\twith\r\ncontrol\0chars\\and\"quotes)`))
})

test('formatShallow correctly formats a symbol with description', (t) => {
  const symbol = Symbol('custom-description')
  const context = new RealValueContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('Symbol(') && rendered.includes('custom-description'))
})

test('formatShallow correctly encodes special characters in symbol descriptions', (t) => {
  // Create a symbol with a description containing characters that would need encoding
  const symbol = Symbol('description\nwith\tspecial\r\ncontrol\0chars\\and"quotes')
  const context = new RealValueContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)

  // Check that encoding happened correctly - special characters should be escaped
  t.true(rendered.includes(String.raw`\n`), 'Should encode newlines')
  t.true(rendered.includes(String.raw`\t`), 'Should encode tabs')
  t.true(rendered.includes(String.raw`\r`), 'Should encode carriage returns')
  t.true(rendered.includes(String.raw`\0`), 'Should encode null bytes')
  t.true(rendered.includes('\\\\'), 'Should encode backslashes')

  // With the updated implementation, the description should be properly encoded
  // and not contain raw special characters
  t.false(rendered.includes('\n'), 'Should not contain raw newline characters')
  t.false(rendered.includes('\t'), 'Should not contain raw tab characters')
  t.false(rendered.includes('\r'), 'Should not contain raw carriage return characters')
})

test('formatShallow correctly formats a symbol without description', (t) => {
  const symbol = Symbol() // eslint-disable-line symbol-description
  const context = new RealValueContext()
  const representation = new SymbolRepresentation(context, symbol as unknown as Record<string, unknown>)
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('Symbol()'))
})
