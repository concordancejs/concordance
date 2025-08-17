import test from 'ava'
import { RealValueContext } from '../../../real-value-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { ArrayRepresentation } from '../array.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { ElementAccessor } from '../../../accessors/element.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

// Static methods tests
test('is method correctly identifies ArrayRepresentation instances', (t) => {
  const context = new RealValueContext()
  const array = [1, 2, 3]
  const arrayRep = context.represent(array) as ArrayRepresentation
  const objectRep = context.represent({})

  t.true(ArrayRepresentation.is(arrayRep))
  t.false(ArrayRepresentation.is(objectRep))
})

// Deserialize method test
test('deserialize creates a comparable ArrayRepresentation', (t) => {
  const originalContext = new RealValueContext()
  const array = [1, 2, 3]
  const original = originalContext.represent(array) as ArrayRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ArrayRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized, 'comprehensive'), comparable)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same array instance', (t) => {
  const context = new RealValueContext()
  const array = [1, 2, 3]

  const arrayRep1 = context.represent(array) as ArrayRepresentation
  const arrayRep2 = context.represent(array) as ArrayRepresentation

  t.is(arrayRep1.compare(arrayRep2, 'comprehensive'), strictlyEqual)
})

test('compare returns unequal when comparing to non-ArrayRepresentation', (t) => {
  const context = new RealValueContext()
  const array = [1, 2, 3]
  const object = {}

  const arrayRep = context.represent(array) as ArrayRepresentation
  const objectRep = context.represent(object)

  t.is(arrayRep.compare(objectRep, 'comprehensive'), unequal)
  t.is(arrayRep.compare(objectRep, 'fuzzy'), unequal)
})

test('compare returns comparable when comparing to array subclass instances in fuzzy mode', (t) => {
  const context = new RealValueContext()
  const array = [1, 2, 3]
  class SubArray extends Array {}
  const sub = new SubArray()
  sub.push(1, 2, 3)

  const arrayRep = context.represent(array) as ArrayRepresentation
  const subRep = context.represent(sub)

  t.is(arrayRep.compare(subRep, 'fuzzy'), comparable)
})

test('compare returns unequal when comparing arrays with different lengths in comprehensive mode', (t) => {
  const context = new RealValueContext()
  const array1 = [1, 2, 3]
  const array2 = [1, 2, 3, 4]

  const arrayRep1 = context.represent(array1) as ArrayRepresentation
  const arrayRep2 = context.represent(array2) as ArrayRepresentation

  t.is(arrayRep1.compare(arrayRep2, 'comprehensive'), unequal)
})

test('compare returns comparable when comparing different array instances with same length in comprehensive mode', (t) => {
  const context = new RealValueContext()
  const array1 = [1, 2, 3]
  const array2 = [4, 5, 6]

  const arrayRep1 = context.represent(array1) as ArrayRepresentation
  const arrayRep2 = context.represent(array2) as ArrayRepresentation

  // Should be comparable, not strictly equal, as they are different instances
  t.is(arrayRep1.compare(arrayRep2, 'comprehensive'), comparable)
})

test('compare returns comparable when comparing against shorter arrays in fuzzy mode', (t) => {
  const context = new RealValueContext()
  const longArray = [1, 2, 3, 4, 5]
  const shortArray = [1, 2]

  const longArrayRep = context.represent(longArray) as ArrayRepresentation
  const shortArrayRep = context.represent(shortArray) as ArrayRepresentation

  // Long array should be comparable to short array in fuzzy mode
  t.is(longArrayRep.compare(shortArrayRep, 'fuzzy'), comparable)

  // Short array should NOT be comparable to long array in fuzzy mode
  t.is(shortArrayRep.compare(longArrayRep, 'fuzzy'), unequal)
})

test('compare returns comparable when comparing different array instances with the same length in fuzzy mode', (t) => {
  const context = new RealValueContext()
  const array1 = [1, 2, 3]
  const array2 = [4, 5, 6]

  const arrayRep1 = context.represent(array1) as ArrayRepresentation
  const arrayRep2 = context.represent(array2) as ArrayRepresentation

  // Equal length arrays should be comparable in fuzzy mode
  t.is(arrayRep1.compare(arrayRep2, 'fuzzy'), comparable)
  t.is(arrayRep2.compare(arrayRep1, 'fuzzy'), comparable)
})

test('compare returns unequal when comparing against longer arrays in fuzzy mode', (t) => {
  const context = new RealValueContext()
  const shortArray = [1, 2]
  const longArray = [1, 2, 3, 4, 5]

  const shortArrayRep = context.represent(shortArray) as ArrayRepresentation
  const longArrayRep = context.represent(longArray) as ArrayRepresentation

  // Short array cannot be compared to long array in fuzzy mode
  t.is(shortArrayRep.compare(longArrayRep, 'fuzzy'), unequal)
})

// Length property test
test('length property returns correct array length', (t) => {
  const context = new RealValueContext()
  const array = [1, 2, 3]
  const emptyArray: any[] = []

  const arrayRep = context.represent(array) as ArrayRepresentation
  const emptyArrayRep = context.represent(emptyArray) as ArrayRepresentation

  t.is(arrayRep.length, 3)
  t.is(emptyArrayRep.length, 0)
})

// IterateElements tests
test('iterateElements yields elements for dense arrays', (t) => {
  const context = new RealValueContext()
  const array = [1, 2, 3]
  const arrayRep = context.represent(array) as ArrayRepresentation

  const elements = [...arrayRep.iterateElements()]

  t.is(elements.length, 3)
  t.true(elements[0] instanceof ElementAccessor)
  t.true(elements[1] instanceof ElementAccessor)
  t.true(elements[2] instanceof ElementAccessor)
})

test('iterateElements handles sparse arrays', (t) => {
  const context = new RealValueContext()
  // Create a sparse array with holes
  const sparseArray: any[] = []
  sparseArray[0] = 1
  sparseArray[2] = 3
  sparseArray.length = 4 // Explicit length to ensure the last element is sparse

  const arrayRep = context.represent(sparseArray) as ArrayRepresentation

  const elements = [...arrayRep.iterateElements()]

  // Should have 4 elements (including sparse ones)
  t.is(elements.length, 4)
  // Check that indices 1 and 3 represent sparse elements
  const sparseIndices = [1, 3]
  for (const index of sparseIndices) {
    const element = elements[index]!
    // Check if this element represents a sparse value
    t.true(element instanceof ElementAccessor)
    // The first (and only) value yielded by iterating the element should be a SparseValueRepresentation
    // We can't check directly due to the private fields, but we can check indirectly by serializing
    const encoder = new Encoder()
    for (const value of element) {
      value.serialize?.(encoder)
      value.serializeShallow?.(encoder)
    }

    const decoder = new Decoder(encoder.bytes)
    t.is(decoder.staticType(), staticTypeTable.undefined)
  }
})

// IterateIterable test
test('iterateIterable yields no elements for arrays', (t) => {
  const context = new RealValueContext()
  const array = [1, 2, 3]
  const arrayRep = context.represent(array) as ArrayRepresentation

  const iterables = [...arrayRep.iterateIterable()]

  t.is(iterables.length, 0)
})

// Serialization test
test('serialize uses array static type', (t) => {
  const context = new RealValueContext()
  const array = [1, 2, 3]
  const arrayRep = context.represent(array) as ArrayRepresentation

  const encoder = new Encoder()
  arrayRep.serialize(encoder)

  // Check the overall structure and type
  snapshotEncoded(t, encoder, 'array serialization')

  // Verify the static type manually
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.array)
})

test('serializing and deserializing an array preserves its structure', (t) => {
  const originalContext = new RealValueContext()
  const array = [1, null, 'string', true, { key: 'value' }]
  const original = originalContext.represent(array) as ArrayRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ArrayRepresentation.deserialize(deserializationContext, decoder)

  // The original and deserialized representations should be comparable
  t.is(original.compare(deserialized, 'comprehensive'), comparable)

  // The deserialized representation should have the same length
  t.is(deserialized.length, array.length)
})

// FinalFormat tests
test('finalFormat uses array brackets and no disambiguation hint by default', (t) => {
  const context = new RealValueContext()
  const array = [1, 2, 3]
  const arrayRep = context.represent(array) as ArrayRepresentation

  const formatter = new Formatter(deriveTheme())
  arrayRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use array brackets
  t.true(rendered.includes('['))
  t.true(rendered.includes(']'))

  // Should not include disambiguation hint by default
  t.false(rendered.includes('Array'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'array default format')
})

test('finalFormat shows disambiguation hint when options.disambiguationHint is true', (t) => {
  const context = new RealValueContext()
  const array = [1, 2, 3]
  const arrayRep = context.represent(array) as ArrayRepresentation

  const formatter = new Formatter(deriveTheme())
  arrayRep.finalFormat(formatter, { disambiguationHint: true })

  const rendered = formatter.render()

  // Should use array brackets
  t.true(rendered.includes('['))
  t.true(rendered.includes(']'))

  // Should include the disambiguation hint when options.disambiguationHint is true
  t.true(rendered.includes('Array'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'array with disambiguation hint')
})
