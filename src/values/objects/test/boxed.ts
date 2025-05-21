import test from 'ava'
import { DescriptionContext } from '../../../description-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { BoxedPrimitiveRepresentation as BoxedRepresentation } from '../boxed.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

// Helper function to create boxed primitives of different types
function createBoxedValues() {
  return {
    number: new Number(42),
    string: new String('test'),
    boolean: new Boolean(true),
    symbol: Object(Symbol('test')),
    bigint: Object(BigInt(42)),
  }
}

// Deserialize method test
test('deserialize creates a comparable BoxedRepresentation', (t) => {
  const originalContext = new DescriptionContext()
  const boxed = new Number(42)
  const original = originalContext.represent(boxed) as BoxedRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = BoxedRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized), comparable)
})

test('deserialize fails if the primitive value is missing', (t) => {
  const originalContext = new DescriptionContext()
  const boxed = new Number(10) // Encoded as a single CBOR byte.
  const original = originalContext.represent(boxed) as BoxedRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes.subarray(0, -2)) // Remove the primitive value (static type and encoded `10`)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  t.throws(() => BoxedRepresentation.deserialize(deserializationContext, decoder), {
    name: 'AssertionError',
    message: 'No primitive value',
  })
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same boxed instance', (t) => {
  const context = new DescriptionContext()
  const boxed = new Number(42)

  const boxedRep1 = context.represent(boxed) as BoxedRepresentation
  const boxedRep2 = context.represent(boxed) as BoxedRepresentation

  t.is(boxedRep1.compare(boxedRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-BoxedRepresentation', (t) => {
  const context = new DescriptionContext()
  const boxed = new Number(42)
  const obj = {}

  const boxedRep = context.represent(boxed) as BoxedRepresentation
  const objRep = context.represent(obj)

  t.is(boxedRep.compare(objRep), unequal)
})

test('compare returns unequal when comparing boxed values with different primitive values', (t) => {
  const context = new DescriptionContext()
  const boxed1 = new Number(42)
  const boxed2 = new Number(43)

  const boxedRep1 = context.represent(boxed1) as BoxedRepresentation
  const boxedRep2 = context.represent(boxed2) as BoxedRepresentation

  t.is(boxedRep1.compare(boxedRep2), unequal)
})

test('compare returns comparable when comparing different boxed instances with same primitive value', (t) => {
  const context = new DescriptionContext()
  const boxed1 = new Number(42)
  const boxed2 = new Number(42)

  const boxedRep1 = context.represent(boxed1) as BoxedRepresentation
  const boxedRep2 = context.represent(boxed2) as BoxedRepresentation

  // Should be comparable, not strictly equal, as they are different instances
  t.is(boxedRep1.compare(boxedRep2), comparable)
})

test('compare compares different boxed primitive types correctly', (t) => {
  const context = new DescriptionContext()

  // Create instances of different types of boxed primitives
  const values = createBoxedValues()

  const numberRep = context.represent(values.number) as BoxedRepresentation
  const stringRep = context.represent(values.string) as BoxedRepresentation
  const booleanRep = context.represent(values.boolean) as BoxedRepresentation
  const symbolRep = context.represent(values.symbol) as BoxedRepresentation
  const bigintRep = context.represent(values.bigint) as BoxedRepresentation

  // All different types should be unequal to each other
  t.is(numberRep.compare(stringRep), unequal)
  t.is(numberRep.compare(booleanRep), unequal)
  t.is(numberRep.compare(symbolRep), unequal)
  t.is(numberRep.compare(bigintRep), unequal)
  t.is(stringRep.compare(booleanRep), unequal)
  t.is(stringRep.compare(symbolRep), unequal)
  t.is(stringRep.compare(bigintRep), unequal)
  t.is(booleanRep.compare(symbolRep), unequal)
  t.is(booleanRep.compare(bigintRep), unequal)
  t.is(symbolRep.compare(bigintRep), unequal)
})

// iterateArrayLike test
test('iterateArrayLike yields no elements for boxed strings (which are array like)', (t) => {
  const context = new DescriptionContext()
  const boxedString = new String('abc')
  const boxedStringRep = context.represent(boxedString) as BoxedRepresentation

  const elements = [...boxedStringRep.iterateArrayLike()]

  // Boxed string should have array-like elements for each character
  t.is(elements.length, 0)
})

// iterateIterable test
test('iterateIterable yields no elements for boxed primitives', (t) => {
  const context = new DescriptionContext()
  const values = createBoxedValues()

  // None of the boxed primitives should have iterable elements
  for (const value of Object.values(values)) {
    const boxedRep = context.represent(value) as BoxedRepresentation
    t.is([...boxedRep.iterateIterable()].length, 0)
  }
})

// Serialization tests
test('serialize uses boxed static type and includes primitive value annotation', (t) => {
  const context = new DescriptionContext()
  const boxed = new Number(42)
  const boxedRep = context.represent(boxed) as BoxedRepresentation

  const encoder = new Encoder()
  boxedRep.serialize(encoder)

  // Check the overall structure and type
  snapshotEncoded(t, encoder, 'boxed number serialization')

  // Verify the static type and annotations manually
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.boxedPrimitive)
})

test('serializing and deserializing different boxed primitive types', (t) => {
  const originalContext = new DescriptionContext()
  const values = createBoxedValues()

  // Test each type of boxed primitive
  for (const [type, value] of Object.entries(values)) {
    const original = originalContext.represent(value) as BoxedRepresentation

    const encoder = new Encoder()
    original.serialize(encoder)

    const decoder = new Decoder(encoder.bytes)
    decoder.staticType() // Consume the type
    const deserializationContext = new DeserializationContext(decoder)
    const deserialized = BoxedRepresentation.deserialize(deserializationContext, decoder)

    // The original and deserialized representations should be comparable
    t.is(original.compare(deserialized), comparable, `Failed for boxed ${type}`)
  }
})

// Formatting tests
test('preformat formats the primitive value', (t) => {
  const context = new DescriptionContext()
  const boxed = new Number(42)
  const boxedRep = context.represent(boxed) as BoxedRepresentation

  const formatter = new Formatter(deriveTheme())
  boxedRep.preformat(formatter)

  // Need to close the formatter before rendering
  formatter.close()
  const rendered = formatter.render()

  // Should contain the primitive value
  t.true(rendered.includes('42'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'boxed number preformat')
})

test('preformat formats different boxed primitive types correctly', (t) => {
  const context = new DescriptionContext()
  const values = createBoxedValues()

  // Test each type of boxed primitive
  for (const [type, value] of Object.entries(values)) {
    const boxedRep = context.represent(value) as BoxedRepresentation

    const formatter = new Formatter(deriveTheme())
    boxedRep.preformat(formatter)

    // Need to close the formatter before rendering
    formatter.close()
    const rendered = formatter.render()

    // Should contain a representation of the primitive value
    t.true(rendered.length > 0)

    // Snapshot with type name to differentiate
    t.snapshot(rendered, `boxed ${type} preformat`)
  }
})

test('finalFormat uses object brackets and no disambiguation hint by default', (t) => {
  const context = new DescriptionContext()
  const boxed = new Number(42)
  const boxedRep = context.represent(boxed) as BoxedRepresentation

  const formatter = new Formatter(deriveTheme())
  boxedRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should not include disambiguation hint by default
  t.false(rendered.includes('Boxed primitive'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'boxed primitive default format')
})

test('finalFormat shows disambiguation hint when options.disambiguationHint is true', (t) => {
  const context = new DescriptionContext()
  const boxed = new Number(42)
  const boxedRep = context.represent(boxed) as BoxedRepresentation

  const formatter = new Formatter(deriveTheme())
  boxedRep.finalFormat(formatter, { disambiguationHint: true })

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should include the disambiguation hint when options.disambiguationHint is true
  t.true(rendered.includes('Boxed primitive'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'boxed primitive with disambiguation hint')
})

test('integration of preformat and finalFormat produces correct output', (t) => {
  const context = new DescriptionContext()
  const boxed = new Number(42)
  const boxedRep = context.represent(boxed) as BoxedRepresentation

  const formatter = new Formatter(deriveTheme())

  // First preformat the primitive value
  boxedRep.preformat(formatter)

  // Then do the final formatting
  boxedRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should contain both the primitive value and object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))
  t.true(rendered.includes('42'))

  // Snapshot the complete rendering
  t.snapshot(rendered, 'complete boxed primitive rendering')
})
