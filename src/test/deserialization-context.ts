import test, { type AssertionError, type ExecutionContext, type ThrowsExpectation } from 'ava'
import { staticTypeTable, type StaticType } from '../serialization-types.ts'
import { Encoder } from '../encoder.ts'
import { serialize } from '../serialize.ts'
import { describe } from '../describe.ts'
import { DescriptionContext } from '../description-context.ts'
import { ElementAccessor, SparseValueRepresentation } from '../accessors/element.ts'
import { IteratorValueAccessor } from '../accessors/iterator-value.ts'
import { NamedPropertyAccessor, SymbolPropertyAccessor } from '../accessors/property.ts'
import { comparable, possiblyEqual, strictlyEqual, type Comparison } from '../comparison.ts'
import type { ObjectRepresentation } from '../values/objects/object.ts'
import { MapEntryAccessor } from '../accessors/map-entry.ts'
import type { SymbolRepresentation } from '../values/primitives/symbol.ts'
import * as testModuleNamespace from '../values/objects/test/fixtures/module-fixture.ts'
import { Decoder } from '../decoder.ts'
import { DeserializationContext } from '../deserialization-context.ts'
import type { ValueRepresentation } from '../value.js'

// -----------------------------------------------------------------------------
// Basic Instance and Property Tests
// -----------------------------------------------------------------------------

test('is identifies context instances correctly', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  const context = new DeserializationContext(decoder)

  t.true(DeserializationContext.is(context))
  t.false(DeserializationContext.is({ deserialized: true } as any))
})

test('deserialized property returns true', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  const context = new DeserializationContext(decoder)

  t.true(context.deserialized)
})

test('next returns undefined for empty buffer', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  const context = new DeserializationContext(decoder)

  t.is(context.next(), undefined)
})

test('next throws for unexpected terminator or aspect types', (t) => {
  // Test with terminator type (value 0)
  // Integers 0-23 are encoded directly (no prefix needed)
  const terminatorBytes = new Uint8Array([staticTypeTable.terminator])
  const terminatorDecoder = new Decoder(terminatorBytes)
  const terminatorContext = new DeserializationContext(terminatorDecoder)
  t.throws(() => terminatorContext.next(), { name: 'AssertionError', message: /Unexpected terminator or aspect/ })

  // Test with elementAspect type (value 24)
  // Integers 24-255 need prefix 0x18
  const elementAspectBytes = new Uint8Array([0x18, staticTypeTable.elementAspect])
  const elementAspectDecoder = new Decoder(elementAspectBytes)
  const elementAspectContext = new DeserializationContext(elementAspectDecoder)
  t.throws(() => elementAspectContext.next(), { name: 'AssertionError', message: /Unexpected terminator or aspect/ })

  // Test with iteratorValueAspect type (value 25)
  const iteratorValueAspectBytes = new Uint8Array([0x18, staticTypeTable.iteratorValueAspect])
  const iteratorValueAspectDecoder = new Decoder(iteratorValueAspectBytes)
  const iteratorValueAspectContext = new DeserializationContext(iteratorValueAspectDecoder)
  t.throws(() => iteratorValueAspectContext.next(), {
    name: 'AssertionError',
    message: /Unexpected terminator or aspect/,
  })

  // Test with mapEntryAspect type (value 26)
  const mapEntryAspectBytes = new Uint8Array([0x18, staticTypeTable.mapEntryAspect])
  const mapEntryAspectDecoder = new Decoder(mapEntryAspectBytes)
  const mapEntryAspectContext = new DeserializationContext(mapEntryAspectDecoder)
  t.throws(() => mapEntryAspectContext.next(), { name: 'AssertionError', message: /Unexpected terminator or aspect/ })

  // Test with namedPropertyAspect type (value 27)
  const namedPropertyAspectBytes = new Uint8Array([0x18, staticTypeTable.namedPropertyAspect])
  const namedPropertyAspectDecoder = new Decoder(namedPropertyAspectBytes)
  const namedPropertyAspectContext = new DeserializationContext(namedPropertyAspectDecoder)
  t.throws(() => namedPropertyAspectContext.next(), {
    name: 'AssertionError',
    message: /Unexpected terminator or aspect/,
  })

  // Test with symbolPropertyAspect type (value 28)
  const symbolPropertyAspectBytes = new Uint8Array([0x18, staticTypeTable.symbolPropertyAspect])
  const symbolPropertyAspectDecoder = new Decoder(symbolPropertyAspectBytes)
  const symbolPropertyAspectContext = new DeserializationContext(symbolPropertyAspectDecoder)
  t.throws(() => symbolPropertyAspectContext.next(), {
    name: 'AssertionError',
    message: /Unexpected terminator or aspect/,
  })
})

test('next throws for unknown pointers', (t) => {
  // Create a byte array with:
  // 1. staticTypeTable.pointer (CBOR encoded integer 16)
  // 2. A pointer value (42) that hasn't been registered
  const bytes = new Uint8Array([staticTypeTable.pointer, 0x18, 0x2a])

  const decoder = new Decoder(bytes)
  const context = new DeserializationContext(decoder)

  t.throws(() => context.next(), {
    name: 'AssertionError',
    message: /Unknown pointer: 42/,
  })
})

test('handles invalid static types', (t) => {
  // Use Number.MAX_SAFE_INTEGER as a value that wouldn't be a valid static type
  // 0x1b prefix for uint64, followed by 0x00, 0x1f, ff, ff, ff, ff, ff, ff encodes 9007199254740991
  const bytes = new Uint8Array([0x1b, 0x00, 0x1f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
  const decoder = new Decoder(bytes)
  const context = new DeserializationContext(decoder)

  t.throws(() => context.next(), { name: 'AssertionError', message: /Invalid static type/ })
})

// -----------------------------------------------------------------------------
// Property Accessor Method Tests
// -----------------------------------------------------------------------------

test('accessor methods correctly return object properties', (t) => {
  const decoder = new Decoder(new Uint8Array([]))
  const context = new DeserializationContext(decoder)

  // Create test objects with specific properties to test each method
  const objectWithConstructorName = { constructorName: 'TestClass' }
  const objectWithoutConstructorName = {}

  const objectWithSymbolDesc = { wellKnown: 'Symbol.iterator', string: 'Symbol(Symbol.iterator)' }
  const emptyObject = Object.create(null)

  const lengthObject = { length: 42 }
  const sizeObject = { size: 24 }

  const withPointer = { pointer: 123 }
  const withStringTag = { stringTag: 'TaggedObject' }
  const withValueOf = { valueOf: 'test-value' }

  const nullProto = { isNullProto: true, isObjectProto: false }
  const objectProto = { isNullProto: false, isObjectProto: true }
  const otherProto = { isNullProto: false, isObjectProto: false }

  const arrayLike = { isArrayLike: true }
  const notArrayLike = { isArrayLike: false }
  const noProperty = {}

  // Test property retrieval methods
  t.is(context.constructorName(objectWithConstructorName), 'TestClass', 'Should return constructorName property')
  t.is(
    context.constructorName(objectWithoutConstructorName),
    undefined,
    'Should return undefined when property is missing',
  )

  t.deepEqual(
    context.describeSymbol(objectWithSymbolDesc),
    { wellKnown: 'Symbol.iterator', string: 'Symbol(Symbol.iterator)' },
    'Should return symbol description properties',
  )
  t.deepEqual(context.describeSymbol(emptyObject), {}, 'Should return empty object for missing properties')

  t.is(context.length(lengthObject), 42, 'Should return length property')
  t.is(context.size(sizeObject), 24, 'Should return size property')

  // Using any ValueRepresentation as first parameter since it's ignored
  const dummyRepresentation = {} as any
  t.is(context.pointer(dummyRepresentation, withPointer), 123, 'Should return pointer property')
  t.is(context.pointer(dummyRepresentation, emptyObject), undefined, 'Should return undefined when pointer is missing')

  t.is(context.stringTag(withStringTag), 'TaggedObject', 'Should return stringTag property')
  t.is(context.stringTag(emptyObject), undefined, 'Should return undefined when stringTag is missing')

  t.is(context.valueOf(withValueOf), 'test-value', 'Should return valueOf property')
  t.is(context.valueOf(emptyObject), undefined, 'Should return undefined when valueOf is missing')

  t.true(context.isNullProto(nullProto), 'Should return true when isNullProto is true')
  t.false(context.isObjectProto(nullProto), 'Should return false when isObjectProto is false')

  t.false(context.isNullProto(objectProto), 'Should return false when isNullProto is false')
  t.true(context.isObjectProto(objectProto), 'Should return true when isObjectProto is true')

  t.false(context.isNullProto(otherProto), 'Should return false when isNullProto is false')
  t.false(context.isObjectProto(otherProto), 'Should return false when isObjectProto is false')

  t.true(context.isArrayLike(arrayLike), 'Should return true when isArrayLike is true')
  t.false(context.isArrayLike(notArrayLike), 'Should return false when isArrayLike is false')
  t.is(context.isArrayLike(noProperty) as any, undefined, 'Should return falsy when isArrayLike property is missing')
})

// -----------------------------------------------------------------------------
// Iteration test macro
// -----------------------------------------------------------------------------

type IterationMethod =
  | 'iterateElements'
  | 'iterateMapEntries'
  | 'iterateNamedProperties'
  | 'iterateValues'
  | 'symbolProperties'
  | 'namedProperties'

type IterationOptions = (
  | {
      value: Iterable<any> | object
    }
  | {
      encode: (encoder: Encoder) => void
    }
) & { breakRestartAfter?: number } & (
    | {
        expectedCount: number
        expectedNextStaticType?: StaticType
      }
    | {
        expectedThrows?: ThrowsExpectation<AssertionError>
      }
  )

type IterationAssert = (
  t: ExecutionContext,
  values: any[],
  context: DeserializationContext,
  representation: ValueRepresentation,
) => void

const iteration = test.macro<[IterationMethod, IterationOptions, IterationAssert?]>({
  title(providedTitle, method) {
    return `${method} - ${providedTitle}`
  },

  exec(t, method, options, assert) {
    let bytes
    if ('value' in options) {
      bytes = serialize(describe(options.value)).slice(1)
    } else {
      // Set up encoder with test data
      const encoder = new Encoder()
      options.encode(encoder)
      bytes = encoder.bytes
    }

    // Create decoder and context
    const decoder = new Decoder(bytes)
    const context = new DeserializationContext(decoder)

    // Get the representation
    const representation = context.next() ?? t.fail('Failed to get representation')
    const getIterable = () => {
      if (method === 'iterateNamedProperties') {
        // For named properties, we need to get the group first
        const group = context.namedProperties(representation)
        return context.iterateNamedProperties(group)
      } else {
        return context[method](representation)
      }
    }

    if ('expectedThrows' in options) {
      t.throws(() => [...getIterable()], options.expectedThrows)
      return
    }

    let breakRestartAfter = Number.MAX_SAFE_INTEGER
    if ('breakRestartAfter' in options && options.breakRestartAfter !== undefined) {
      t.assert(options.breakRestartAfter > 1, 'breakRestartAfter should be greater than 1')
      breakRestartAfter = options.breakRestartAfter
    }

    // Collect iterated values
    const values: any[] = []
    let restart = false
    for (const value of getIterable()) {
      // Consume the value from the decoder
      Array.from(value)

      values.push(value)
      if (values.length === breakRestartAfter) {
        restart = true
        break
      }
    }
    if (restart) {
      // Restart the iteration. Expect to read cached values first.
      let offset = 0
      for (const value of getIterable()) {
        if (offset < breakRestartAfter) {
          offset++
          continue
        }

        // Consume the value from the decoder
        Array.from(value)
        values.push(value)
      }
    }

    // Assert the correct number of items were iterated
    if ('expectedCount' in options) {
      const { expectedCount, expectedNextStaticType } = options
      t.is(values.length, expectedCount, `Should iterate ${expectedCount} values`)

      // Check next static type if specified
      if (expectedNextStaticType !== undefined) {
        t.is(decoder.peekStaticType(), expectedNextStaticType, `Decoder should be positioned at expected static type`)
      }
    }

    // Run additional assertions if provided
    assert?.(t, values, context, representation)
  },
})

// -----------------------------------------------------------------------------
// Element Iteration Tests
// -----------------------------------------------------------------------------

test(
  'iterates elements correctly',
  iteration,
  'iterateElements',
  {
    value: [1, 2, 3],
    expectedCount: 3,
  },
  (t, elements) => {
    // Create expected element accessors using the describe function
    const expectedElements = [
      new ElementAccessor(0, describe(1)),
      new ElementAccessor(1, describe(2)),
      new ElementAccessor(2, describe(3)),
    ]

    for (const element of elements) {
      const expectedElement = expectedElements.shift()!
      t.is(element.compare(expectedElement), strictlyEqual)
    }
  },
)

test(
  'replays previously deserialized elements without reprocessing',
  iteration,
  'iterateElements',
  {
    value: [1, 2, 3],
    expectedCount: 3,
  },
  (t, firstIterationElements, context, representation) => {
    // Second iteration should replay cached elements without accessing the decoder again
    const secondIterationElements = [...context.iterateElements(representation)]
    t.is(secondIterationElements.length, 3, 'Should still have 3 elements')

    // Verify the elements are the same objects (cached)
    for (let i = 0; i < 3; i++) {
      t.is(
        firstIterationElements[i],
        secondIterationElements[i],
        `Element at index ${i} should be the exact same accessor object`,
      )
    }
  },
)

test('resumes iteration correctly after a break', iteration, 'iterateElements', {
  value: [1, 2, 3],
  expectedCount: 3,
  breakRestartAfter: 2,
})

test('stops at different aspect types', iteration, 'iterateElements', {
  encode(encoder) {
    // Create a serialized array
    encoder
      .staticType(staticTypeTable.array)
      .annotations({ p: 1 })
      // Add element aspect with a value
      .staticType(staticTypeTable.elementAspect)
      .staticType(staticTypeTable.number)
      .number(42)
      // Add a named property aspect (which should stop element iteration)
      .staticType(staticTypeTable.namedPropertyAspect)
      // Add element aspect again (which should be ignored by the current iteration)
      .staticType(staticTypeTable.elementAspect)
      .staticType(staticTypeTable.number)
      .number(3)
  },
  expectedCount: 1,
  expectedNextStaticType: staticTypeTable.namedPropertyAspect,
})

test('handles multiple aspect types correctly', iteration, 'iterateElements', {
  encode(encoder) {
    // Create a serialized array with multiple aspect types
    encoder
      .staticType(staticTypeTable.array)
      .annotations({ p: 1 })
      // Add element aspect with values
      .staticType(staticTypeTable.elementAspect)
      .staticType(staticTypeTable.number)
      .number(1)
      // Second element
      .staticType(staticTypeTable.elementAspect)
      .staticType(staticTypeTable.number)
      .number(2)
      // Add a named property aspect (which should stop element iteration)
      .staticType(staticTypeTable.namedPropertyAspect)
      .string('prop')
      .staticType(staticTypeTable.number)
      .number(42)
      // Add element aspect again (which should be ignored by the current iteration)
      .staticType(staticTypeTable.elementAspect)
      .staticType(staticTypeTable.number)
      .number(3)
  },
  expectedCount: 2,
  expectedNextStaticType: staticTypeTable.namedPropertyAspect,
})

test('throws when missing aspect', iteration, 'iterateElements', {
  encode(encoder) {
    // Create a serialized array with a value but no aspect
    encoder
      .staticType(staticTypeTable.array)
      .annotations({ p: 1 })
      // No element aspect, directly add a value
      .staticType(staticTypeTable.number)
      .number(42)
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected terminator or aspect/,
  },
})

test(
  'iterates sparse elements correctly',
  iteration,
  'iterateElements',
  {
    encode(encoder) {
      // Create a serialized sparse array [0, <empty>, 2]
      encoder
        .staticType(staticTypeTable.array)
        .annotations({ p: 1 })
        // First element (0)
        .staticType(staticTypeTable.elementAspect)
        .staticType(staticTypeTable.number)
        .number(0)
        // Sparse element (undefined)
        .staticType(staticTypeTable.elementAspect)
        .staticType(staticTypeTable.undefined)
        // Third element (2)
        .staticType(staticTypeTable.elementAspect)
        .staticType(staticTypeTable.number)
        .number(2)
        .staticType(staticTypeTable.terminator)
    },
    expectedCount: 3,
  },
  (t, elements) => {
    t.is(
      elements[1]!.compare(new ElementAccessor(1, new SparseValueRepresentation())),
      strictlyEqual,
      '2nd element should be sparse',
    )
  },
)

for (const aspect of [
  'namedPropertyAspect',
  'symbolPropertyAspect',
  'iteratorValueAspect',
  'mapEntryAspect',
] satisfies Array<keyof typeof staticTypeTable>) {
  test(`handles ${aspect} before elementAspect`, iteration, 'iterateElements', {
    encode(encoder) {
      // Create a serialized array
      encoder
        .staticType(staticTypeTable.array)
        .annotations({ p: 1 })
        // Start with a different aspect (should not be picked up by elementAspect iteration)
        .staticType(staticTypeTable[aspect])
        .string('prop')
        .staticType(staticTypeTable.number)
        .number(42)
        // Then add an element aspect after (should be the first element)
        .staticType(staticTypeTable.elementAspect)
        .staticType(staticTypeTable.number)
        .number(1)
    },
    expectedCount: 0,
    // Should pick up the single element and stop at end
    expectedNextStaticType: staticTypeTable[aspect],
  })
}

test('throws when bytes end after annotations', iteration, 'iterateElements', {
  encode(encoder) {
    // Create a serialized array that ends immediately after annotations
    encoder.staticType(staticTypeTable.array).annotations({ p: 1 })
    // No aspects or elements added
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected terminator, aspect or value/,
  },
})

test('throws when bytes end after elementAspect', iteration, 'iterateElements', {
  encode(encoder) {
    // Create a serialized array that ends after elementAspect
    encoder
      .staticType(staticTypeTable.array)
      .annotations({ p: 1 })
      // Add element aspect but no value after it
      .staticType(staticTypeTable.elementAspect)
    // No value added
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected terminator, aspect or value/,
  },
})

// -----------------------------------------------------------------------------
// Named Property Tests
// -----------------------------------------------------------------------------

test(
  'iterates named properties correctly',
  iteration,
  'namedProperties',
  {
    value: { a: 1, b: 2, c: 3 },
    expectedCount: 3,
  },
  (t, properties) => {
    // Create expected properties for comparison
    const expectedProperties = [
      new NamedPropertyAccessor('a', describe(1)),
      new NamedPropertyAccessor('b', describe(2)),
      new NamedPropertyAccessor('c', describe(3)),
    ]

    for (let i = 0; i < properties.length; i++) {
      t.is(
        properties[i].compare(expectedProperties[i]),
        strictlyEqual,
        `Property at index ${i} should match expected value`,
      )
    }
  },
)

test(
  'replays previously deserialized named properties without reprocessing',
  iteration,
  'namedProperties',
  {
    value: { a: 1, b: 2, c: 3 },
    expectedCount: 3,
  },
  (t, firstIterationProperties, context, representation) => {
    // Second iteration should replay cached properties without accessing the decoder again
    const propertyGroup = context.namedProperties(representation)
    const secondIterationProperties = [...propertyGroup]
    t.is(secondIterationProperties.length, 3, 'Should still have 3 properties')

    // Verify the properties are the same objects (cached)
    for (let i = 0; i < 3; i++) {
      t.is(
        firstIterationProperties[i],
        secondIterationProperties[i],
        `Property at index ${i} should be the exact same accessor object`,
      )
    }
  },
)

test('namedProperties returns cached NamedPropertyGroup instance on subsequent calls', (t) => {
  const obj = { a: 1, b: 2 }
  const serialized = serialize(describe(obj))
  const decoder = new Decoder(serialized.slice(1))
  const context = new DeserializationContext(decoder)

  const representation = context.next() as ObjectRepresentation

  const firstCallResult = context.namedProperties(representation)
  const secondCallResult = context.namedProperties(representation)

  t.is(firstCallResult, secondCallResult, 'Should return the same NamedPropertyGroup instance on subsequent calls')
})

test('iterates empty property case correctly', iteration, 'namedProperties', {
  encode(encoder) {
    // Create a serialized object with namedPropertyAspect but no actual properties
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add named property aspect
      .staticType(staticTypeTable.namedPropertyAspect)
      // Add something else immediately to end named properties
      .staticType(staticTypeTable.symbolPropertyAspect)
  },
  expectedCount: 0,
  expectedNextStaticType: staticTypeTable.symbolPropertyAspect,
})

test('handles termination correctly when no properties exist', iteration, 'namedProperties', {
  encode(encoder) {
    // Create an object serialization with a namedPropertyAspect followed immediately by terminator
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add named property aspect
      .staticType(staticTypeTable.namedPropertyAspect)
      // Add terminator immediately
      .staticType(staticTypeTable.terminator)
  },
  expectedCount: 0,
})

test('stops at different aspect types', iteration, 'namedProperties', {
  encode(encoder) {
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add named property aspect
      .staticType(staticTypeTable.namedPropertyAspect)
      // Add a property key and value
      .string('prop1')
      .staticType(staticTypeTable.number)
      .number(42)
      // Add another aspect type that should end the named properties
      .staticType(staticTypeTable.symbolPropertyAspect)
  },
  expectedCount: 1,
  expectedNextStaticType: staticTypeTable.symbolPropertyAspect,
})

test('handles multiple properties correctly', iteration, 'namedProperties', {
  encode(encoder) {
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add named property aspect
      .staticType(staticTypeTable.namedPropertyAspect)
      // Add property 1
      .string('prop1')
      .staticType(staticTypeTable.number)
      .number(42)
      // Add property 2
      .string('prop2')
      .staticType(staticTypeTable.string)
      .string('value')
      // Add another aspect type to stop iteration
      .staticType(staticTypeTable.iteratorValueAspect)
  },
  expectedCount: 2,
  expectedNextStaticType: staticTypeTable.iteratorValueAspect,
})

test('throws when bytes end after namedPropertyAspect', iteration, 'namedProperties', {
  encode(encoder) {
    // Create a serialized object that ends after namedPropertyAspect
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add named property aspect but nothing after it
      .staticType(staticTypeTable.namedPropertyAspect)
    // End of bytes
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected property name/,
  },
})

test('throws when bytes end after property name', iteration, 'namedProperties', {
  encode(encoder) {
    // Create a serialized object that ends after property name
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add named property aspect
      .staticType(staticTypeTable.namedPropertyAspect)
      // Add property name but no value after it
      .string('prop')
    // End of bytes
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected value after property name/,
  },
})

test('throws when bytes end after first property', iteration, 'namedProperties', {
  encode(encoder) {
    // Create a serialized object with one property but ends abruptly before second property value
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add named property aspect
      .staticType(staticTypeTable.namedPropertyAspect)
      // First property (complete)
      .string('prop1')
      .staticType(staticTypeTable.number)
      .number(42)
      // Second property name but no value after it
      .string('prop2')
    // End of bytes
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected value after property name/,
  },
})

test('throws when second property name is not a string', iteration, 'namedProperties', {
  encode(encoder) {
    // Create a serialized object with one valid property followed by an invalid one
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add named property aspect
      .staticType(staticTypeTable.namedPropertyAspect)
      // First property (complete and valid)
      .string('prop1')
      .staticType(staticTypeTable.number)
      .number(42)
      // Second property with invalid type (number instead of string)
      .staticType(staticTypeTable.number)
      .number(99)
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Unexpected static type/,
  },
})

test('handles proper terminator after first property', iteration, 'namedProperties', {
  encode(encoder) {
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add named property aspect
      .staticType(staticTypeTable.namedPropertyAspect)
      // First property (complete)
      .string('prop1')
      .staticType(staticTypeTable.number)
      .number(42)
      // Add terminator
      .staticType(staticTypeTable.terminator)
      // Add data that would be wrongly interpreted if not properly terminated
      .string('shouldNotBeReached')
  },
  expectedCount: 1,
})

test('allows named property aspect to be repeated', iteration, 'namedProperties', {
  encode(encoder) {
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add named property aspect
      .staticType(staticTypeTable.namedPropertyAspect)
      // First property (complete)
      .string('prop1')
      .staticType(staticTypeTable.number)
      .number(42)
      .staticType(staticTypeTable.namedPropertyAspect)
      .string('prop2')
      .staticType(staticTypeTable.number)
      .number(42)
      // Add terminator
      .staticType(staticTypeTable.terminator)
  },
  expectedCount: 2,
})

test('iterateNamedProperties throws when given unknown group', (t) => {
  // Create a context
  const decoder = new Decoder(new Uint8Array([]))
  const context = new DeserializationContext(decoder)

  // Should throw an assertion error when given a group the context doesn't recognize
  t.throws(
    () => {
      context.iterateNamedProperties({} as any).next()
    },
    {
      name: 'AssertionError',
      message: /Unknown named property group/,
    },
  )
})

for (const aspect of ['symbolPropertyAspect', 'elementAspect', 'iteratorValueAspect', 'mapEntryAspect'] satisfies Array<
  keyof typeof staticTypeTable
>) {
  test(`handles ${aspect} before namedPropertyAspect`, iteration, 'namedProperties', {
    encode(encoder) {
      // Create a serialized object
      encoder
        .staticType(staticTypeTable.object)
        .annotations({ p: 1 })
        // Start with a different aspect
        .staticType(staticTypeTable[aspect])
        .staticType(staticTypeTable.string)
        .string('someValue')
        // Then add named property aspect after
        .staticType(staticTypeTable.namedPropertyAspect)
        .string('prop')
        .staticType(staticTypeTable.number)
        .number(42)
    },
    expectedCount: 0,
    expectedNextStaticType: staticTypeTable[aspect],
  })

  test(`handles ${aspect} before second property`, iteration, 'namedProperties', {
    encode(encoder) {
      // Create a serialized object
      encoder
        .staticType(staticTypeTable.object)
        .annotations({ p: 1 })
        // Start with a property
        .staticType(staticTypeTable.namedPropertyAspect)
        .string('prop1')
        .staticType(staticTypeTable.string)
        .string('someValue')
        // Then add a different aspect
        .staticType(staticTypeTable[aspect])
        .boolean(true)
        // Add another property
        .staticType(staticTypeTable.namedPropertyAspect)
        .string('prop3')
        .staticType(staticTypeTable.number)
        .number(42)
    },
    expectedCount: 1,
    expectedNextStaticType: staticTypeTable[aspect],
  })
}

test('throws when property name is not a string', iteration, 'namedProperties', {
  encode(encoder) {
    // Create a serialized object with invalid property name type
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add named property aspect
      .staticType(staticTypeTable.namedPropertyAspect)
      // Add number instead of string for property name
      .staticType(staticTypeTable.number)
      .number(42)
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Unexpected static type/,
  },
})

// -----------------------------------------------------------------------------
// Symbol Property Tests
// -----------------------------------------------------------------------------

{
  const sym1 = Symbol('sym1')
  const sym2 = Symbol('sym2')
  test(
    'iterates symbol properties correctly',
    iteration,
    'symbolProperties',
    {
      value: {
        [sym1]: 'symbol value 1',
        [sym2]: 'symbol value 2',
      },
      expectedCount: 2,
    },
    (t, properties) => {
      // Create a description context for the expected accessors
      const descriptionContext = new DescriptionContext()

      // Create expected properties for comparison - using the proper constructor signature
      const expectedProperties = [
        new SymbolPropertyAccessor(
          descriptionContext,
          describe(sym1) as SymbolRepresentation,
          describe('symbol value 1'),
        ),
        new SymbolPropertyAccessor(
          descriptionContext,
          describe(sym2) as SymbolRepresentation,
          describe('symbol value 2'),
        ),
      ]

      // Symbol properties won't be the exact same symbols (since they aren't registered)
      // but they should have the correct pattern
      for (const property of properties) {
        t.assert(expectedProperties.length > 0, 'Expected symbol properties should not be empty')
        const expectedProperty = expectedProperties.shift()!
        t.is(property.compare(expectedProperty), strictlyEqual)
      }
    },
  )
}

test(
  'returns cached SymbolPropertyGroup instance on subsequent calls',
  iteration,
  'symbolProperties',
  {
    value: { [Symbol('sym1')]: 'value' },
    expectedCount: 1,
  },
  (t, _, context, representation) => {
    // Get the group directly
    const firstCallResult = context.symbolProperties(representation)
    const secondCallResult = context.symbolProperties(representation)

    t.is(firstCallResult, secondCallResult, 'Should return the same SymbolPropertyGroup instance on subsequent calls')
  },
)

test('handles empty property case correctly', iteration, 'symbolProperties', {
  encode(encoder) {
    // Create a serialized object with symbolPropertyAspect but no symbol properties
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add symbol property aspect
      .staticType(staticTypeTable.symbolPropertyAspect)
      // Add something else immediately to end symbol properties
      .staticType(staticTypeTable.namedPropertyAspect)
  },
  expectedCount: 0,
  expectedNextStaticType: staticTypeTable.namedPropertyAspect,
})

test('handles termination correctly when no properties exist', iteration, 'symbolProperties', {
  encode(encoder) {
    // Create an object serialization with a symbolPropertyAspect followed immediately by terminator
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add symbol property aspect
      .staticType(staticTypeTable.symbolPropertyAspect)
      // Add terminator immediately
      .staticType(staticTypeTable.terminator)
  },
  expectedCount: 0,
})

test('stops at different aspect types', iteration, 'symbolProperties', {
  encode(encoder) {
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add symbol property aspect
      .staticType(staticTypeTable.symbolPropertyAspect)
      // Add a symbol key with proper encoding
      .staticType(staticTypeTable.symbol)
      .annotations({ s: 'Symbol(test)' })
      // Add the value (number 42)
      .uint8Array(new Uint8Array([staticTypeTable.number, 0x18, 0x2a]))
      // Add another aspect type that should end the symbol properties
      .staticType(staticTypeTable.namedPropertyAspect)
  },
  expectedCount: 1,
  expectedNextStaticType: staticTypeTable.namedPropertyAspect,
})

test('handles multiple symbol properties correctly', iteration, 'symbolProperties', {
  encode(encoder) {
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add symbol property aspect
      .staticType(staticTypeTable.symbolPropertyAspect)
      // Add first symbol property
      .staticType(staticTypeTable.symbol)
      .annotations({ s: 'Symbol(sym1)' })
      // Add the value (number 42)
      .uint8Array(new Uint8Array([staticTypeTable.number, 0x18, 0x2a]))
      // Add second symbol property
      .staticType(staticTypeTable.symbol)
      .annotations({ s: 'Symbol(sym2)' })
      // Add the value (number 42)
      .uint8Array(new Uint8Array([staticTypeTable.number, 0x18, 0x2a]))
      // Add another aspect type to stop iteration
      .staticType(staticTypeTable.iteratorValueAspect)
  },
  expectedCount: 2,
  expectedNextStaticType: staticTypeTable.iteratorValueAspect,
})

test('throws when bytes end after symbolPropertyAspect', iteration, 'symbolProperties', {
  encode(encoder) {
    // Create a serialized object that ends after symbolPropertyAspect
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add symbol property aspect but nothing after it
      .staticType(staticTypeTable.symbolPropertyAspect)
    // End of bytes
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected terminator, aspect or property/,
  },
})

test('throws when bytes end after symbol key', iteration, 'symbolProperties', {
  encode(encoder) {
    // Create a serialized object that ends after symbol key
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add symbol property aspect
      .staticType(staticTypeTable.symbolPropertyAspect)
      // Add symbol key but no value after it
      .staticType(staticTypeTable.symbol)
      .annotations({ s: 'Symbol(test)' })
    // End of bytes
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected value after property symbol/,
  },
})

test('throws when symbol key is not a symbol', iteration, 'symbolProperties', {
  encode(encoder) {
    // Create a serialized object with invalid symbol key type
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add symbol property aspect
      .staticType(staticTypeTable.symbolPropertyAspect)
      // Add number instead of symbol for property key
      .staticType(staticTypeTable.number)
      .number(42)
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Unexpected static type/,
  },
})

test('handles proper terminator after first property', iteration, 'symbolProperties', {
  encode(encoder) {
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add symbol property aspect
      .staticType(staticTypeTable.symbolPropertyAspect)
      // First property (complete)
      .staticType(staticTypeTable.symbol)
      .annotations({ s: 'Symbol(sym1)' })
      // Add the value (number 42)
      .uint8Array(new Uint8Array([staticTypeTable.number, 0x18, 0x2a]))
      // Add terminator
      .staticType(staticTypeTable.terminator)
      // Add data that would be wrongly interpreted if not properly terminated
      .string('shouldNotBeReached')
  },
  expectedCount: 1,
})

test('handles well-known symbols correctly', iteration, 'symbolProperties', {
  encode(encoder) {
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add symbol property aspect
      .staticType(staticTypeTable.symbolPropertyAspect)
      // Well-known symbol
      .staticType(staticTypeTable.symbol)
      .annotations({ w: 'Symbol.iterator' })
      // Add the value (number 42)
      .uint8Array(new Uint8Array([staticTypeTable.number, 0x18, 0x2a]))
      // Registered symbol
      .staticType(staticTypeTable.symbol)
      .annotations({ k: 'testKey' })
      // Add the value (number 42)
      .uint8Array(new Uint8Array([staticTypeTable.number, 0x18, 0x2a]))
      // Terminator
      .staticType(staticTypeTable.terminator)
  },
  expectedCount: 2,
})

for (const aspect of ['namedPropertyAspect', 'elementAspect', 'iteratorValueAspect', 'mapEntryAspect'] satisfies Array<
  keyof typeof staticTypeTable
>) {
  test(`handles ${aspect} before symbolPropertyAspect`, iteration, 'symbolProperties', {
    encode(encoder) {
      // Create a serialized object
      encoder
        .staticType(staticTypeTable.object)
        .annotations({ p: 1 })
        // Start with a different aspect
        .staticType(staticTypeTable[aspect])
        .staticType(staticTypeTable.string)
        .string('someValue')
        // Then add symbol property aspect after
        .staticType(staticTypeTable.symbolPropertyAspect)
        .staticType(staticTypeTable.symbol)
        .annotations({ s: 'Symbol(test)' })
        // Add the value (number 42)
        .uint8Array(new Uint8Array([staticTypeTable.number, 0x18, 0x2a]))
    },
    expectedCount: 0,
    expectedNextStaticType: staticTypeTable[aspect],
  })

  test(`handles ${aspect} before second symbol property`, iteration, 'symbolProperties', {
    encode(encoder) {
      // Create a serialized object
      encoder
        .staticType(staticTypeTable.object)
        .annotations({ p: 1 })
        // Start with a symbol property
        .staticType(staticTypeTable.symbolPropertyAspect)
        .staticType(staticTypeTable.symbol)
        .annotations({ s: 'Symbol(sym1)' })
        // Add the value (number 42)
        .uint8Array(new Uint8Array([staticTypeTable.number, 0x18, 0x2a]))
        // Then add a different aspect
        .staticType(staticTypeTable[aspect])
        .boolean(true)
    },
    expectedCount: 1,
    expectedNextStaticType: staticTypeTable[aspect],
  })
}

// -----------------------------------------------------------------------------
// Map Entry Tests
// -----------------------------------------------------------------------------

test(
  'iterates map entries correctly',
  iteration,
  'iterateMapEntries',
  {
    value: new Map([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]),
    expectedCount: 2,
  },
  (t, entries) => {
    // Create a context for creating new accessors
    const descriptionContext = new DescriptionContext()

    // Create expected entries
    const expectedEntries = [
      new MapEntryAccessor(descriptionContext, describe('key1'), describe('value1')),
      new MapEntryAccessor(descriptionContext, describe('key2'), describe('value2')),
    ]

    for (let i = 0; i < entries.length; i++) {
      t.is(entries[i].compare(expectedEntries[i]), strictlyEqual, `Entry at index ${i} should match expected value`)
    }
  },
)

test(
  'replays previously deserialized map entries without reprocessing',
  iteration,
  'iterateMapEntries',
  {
    value: new Map([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]),
    expectedCount: 2,
  },
  (t, firstIterationEntries, context, representation) => {
    // Second iteration should replay cached entries without accessing the decoder again
    const secondIterationEntries = [...context.iterateMapEntries(representation)]
    t.is(secondIterationEntries.length, 2, 'Should still have 2 entries')

    // Verify the entries are the same objects (cached)
    for (let i = 0; i < 2; i++) {
      t.is(
        firstIterationEntries[i],
        secondIterationEntries[i],
        `Entry at index ${i} should be the exact same accessor object`,
      )
    }
  },
)

test('resumes iteration correctly after a break', iteration, 'iterateMapEntries', {
  value: new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
    ['key3', 'value3'],
  ]),
  expectedCount: 3,
  breakRestartAfter: 2,
})

test('stops at different aspect types', iteration, 'iterateMapEntries', {
  encode(encoder) {
    encoder
      .staticType(staticTypeTable.map)
      .annotations({ p: 1 })
      // Add map entry aspect
      .staticType(staticTypeTable.mapEntryAspect)
      // Add key-value pair
      .staticType(staticTypeTable.string)
      .string('key1')
      .staticType(staticTypeTable.number)
      .number(42)
      // Add a different aspect type
      .staticType(staticTypeTable.elementAspect)
      // Add data that would be wrongly interpreted as an entry
      .staticType(staticTypeTable.string)
      .string('key2')
      .staticType(staticTypeTable.number)
      .number(99)
  },
  expectedCount: 1,
  expectedNextStaticType: staticTypeTable.elementAspect,
})

test('handles multiple aspect types correctly', iteration, 'iterateMapEntries', {
  encode(encoder) {
    encoder
      .staticType(staticTypeTable.map)
      .annotations({ p: 1 })
      // Add a map entry
      .staticType(staticTypeTable.mapEntryAspect)
      .staticType(staticTypeTable.string)
      .string('key1')
      .staticType(staticTypeTable.number)
      .number(42)
      // Add another map entry
      .staticType(staticTypeTable.mapEntryAspect)
      .staticType(staticTypeTable.string)
      .string('key2')
      .staticType(staticTypeTable.number)
      .number(43)
      // Add a different aspect type to stop map entry iteration
      .staticType(staticTypeTable.elementAspect)
      // Add additional content that shouldn't be read
      .staticType(staticTypeTable.number)
      .number(99)
      // Add map entry aspect again (which should be ignored by the current iteration)
      .staticType(staticTypeTable.mapEntryAspect)
      .staticType(staticTypeTable.string)
      .string('key3')
      .staticType(staticTypeTable.number)
      .number(44)
  },
  expectedCount: 2,
  expectedNextStaticType: staticTypeTable.elementAspect,
})

test('handles terminators correctly', iteration, 'iterateMapEntries', {
  encode(encoder) {
    encoder
      .staticType(staticTypeTable.map)
      .annotations({ p: 1 })
      // Add map entry aspect
      .staticType(staticTypeTable.mapEntryAspect)
      // Add a key-value pair
      .staticType(staticTypeTable.string)
      .string('key')
      .staticType(staticTypeTable.number)
      .number(42)
      // Add terminator
      .staticType(staticTypeTable.terminator)
      // Add some data after terminator to verify it stops at terminator
      .staticType(staticTypeTable.string)
      .string('shouldNotBeReached')
      .staticType(staticTypeTable.number)
      .number(42)
  },
  expectedCount: 1,
})

test('throws when missing aspect', iteration, 'iterateMapEntries', {
  encode(encoder) {
    // Create a serialized map with a key but no aspect
    encoder
      .staticType(staticTypeTable.map)
      .annotations({ p: 1 })
      // No map entry aspect, directly add a key
      .staticType(staticTypeTable.string)
      .string('key')
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected terminator or aspect/,
  },
})

for (const aspect of [
  'namedPropertyAspect',
  'symbolPropertyAspect',
  'elementAspect',
  'iteratorValueAspect',
] satisfies Array<keyof typeof staticTypeTable>) {
  test(`handles ${aspect} before mapEntryAspect`, iteration, 'iterateMapEntries', {
    encode(encoder) {
      // Create a serialized map
      encoder
        .staticType(staticTypeTable.map)
        .annotations({ p: 1 })
        // Start with a different aspect (should not be picked up by mapEntry iteration)
        .staticType(staticTypeTable[aspect])
        .string('prop')
        .staticType(staticTypeTable.number)
        .number(42)
        // Then add a map entry aspect after (should be the first entry)
        .staticType(staticTypeTable.mapEntryAspect)
        .staticType(staticTypeTable.string)
        .string('key')
        .staticType(staticTypeTable.number)
        .number(1)
    },
    expectedCount: 0,
    expectedNextStaticType: staticTypeTable[aspect],
  })
}

test('throws when bytes end after annotations', iteration, 'iterateMapEntries', {
  encode(encoder) {
    // Create a serialized map that ends immediately after annotations
    encoder.staticType(staticTypeTable.map).annotations({ p: 1 })
    // No aspects or entries added
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected terminator, aspect or key/,
  },
})

test('throws when bytes end after mapEntryAspect', iteration, 'iterateMapEntries', {
  encode(encoder) {
    // Create a serialized map that ends after mapEntryAspect
    encoder
      .staticType(staticTypeTable.map)
      .annotations({ p: 1 })
      // Add map entry aspect but no key/value after it
      .staticType(staticTypeTable.mapEntryAspect)
    // No key/value added
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected terminator, aspect or key/,
  },
})

// -----------------------------------------------------------------------------
// Iterator Value Tests
// -----------------------------------------------------------------------------

test(
  'iterates values correctly',
  iteration,
  'iterateValues',
  {
    value: new (class {
      *[Symbol.iterator]() {
        yield 'value1'
        yield 'value2'
      }
    })(),
    expectedCount: 2,
  },
  (t, values) => {
    // Create expected accessors
    const expectedValues = [
      new IteratorValueAccessor(0, describe('value1')),
      new IteratorValueAccessor(1, describe('value2')),
    ]

    for (let i = 0; i < values.length; i++) {
      t.is(values[i].compare(expectedValues[i]), strictlyEqual, `Value at index ${i} should match expected value`)
    }
  },
)

test(
  'replays previously deserialized values without reprocessing',
  iteration,
  'iterateValues',
  {
    value: new (class {
      *[Symbol.iterator]() {
        yield 'value1'
        yield 'value2'
      }
    })(),
    expectedCount: 2,
  },
  (t, firstIterationValues, context, representation) => {
    // Second iteration should replay cached values without accessing the decoder again
    const secondIterationValues = [...context.iterateValues(representation)]
    t.is(secondIterationValues.length, 2, 'Should still have 2 values')

    // Verify the values are the same objects (cached)
    for (let i = 0; i < 2; i++) {
      t.is(
        firstIterationValues[i],
        secondIterationValues[i],
        `Value at index ${i} should be the exact same accessor object`,
      )
    }
  },
)

test('resumes iteration correctly after a break', iteration, 'iterateValues', {
  value: new (class {
    *[Symbol.iterator]() {
      yield 'value1'
      yield 'value2'
      yield 'value3'
    }
  })(),
  expectedCount: 3,
  breakRestartAfter: 2,
})

test('stops at different aspect types', iteration, 'iterateValues', {
  encode(encoder) {
    // Create an iterable object with iterator values followed by a different aspect type
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add iterator value aspect with a value
      .staticType(staticTypeTable.iteratorValueAspect)
      .staticType(staticTypeTable.number)
      .number(42)
      // Add a different aspect type
      .staticType(staticTypeTable.namedPropertyAspect)
      // Add data that would be wrongly interpreted as an iterator value if not properly handled
      .string('prop')
      .staticType(staticTypeTable.number)
      .number(99)
  },
  expectedCount: 1,
  expectedNextStaticType: staticTypeTable.namedPropertyAspect,
})

test('handles multiple aspect types correctly', iteration, 'iterateValues', {
  encode(encoder) {
    // Create an iterable object with iterator values followed by a different aspect type
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add iterator value aspect with a value
      .staticType(staticTypeTable.iteratorValueAspect)
      .staticType(staticTypeTable.number)
      .number(42)
      // Add another iterator value
      .staticType(staticTypeTable.iteratorValueAspect)
      .staticType(staticTypeTable.number)
      .number(43)
      // Add a different aspect type
      .staticType(staticTypeTable.namedPropertyAspect)
      .string('prop')
      .staticType(staticTypeTable.number)
      .number(99)
      // Add iterator value aspect again (which should be ignored by the current iteration)
      .staticType(staticTypeTable.iteratorValueAspect)
      .staticType(staticTypeTable.number)
      .number(44)
  },
  expectedCount: 2,
  expectedNextStaticType: staticTypeTable.namedPropertyAspect,
})

test('throws when missing aspect', iteration, 'iterateValues', {
  encode(encoder) {
    // Create a serialized object with a value but no aspect
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // No iterator value aspect, directly add a value
      .staticType(staticTypeTable.number)
      .number(42)
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected terminator or aspect/,
  },
})

for (const aspect of ['namedPropertyAspect', 'symbolPropertyAspect', 'elementAspect', 'mapEntryAspect'] satisfies Array<
  keyof typeof staticTypeTable
>) {
  test(`handles ${aspect} before iteratorValueAspect`, iteration, 'iterateValues', {
    encode(encoder) {
      // Create a serialized object
      encoder
        .staticType(staticTypeTable.object)
        .annotations({ p: 1 })
        // Start with a different aspect (should not be picked up by iteratorValue iteration)
        .staticType(staticTypeTable[aspect])
        .string('prop')
        .staticType(staticTypeTable.number)
        .number(42)
        // Then add an iterator value aspect after (should be the first value)
        .staticType(staticTypeTable.iteratorValueAspect)
        .staticType(staticTypeTable.number)
        .number(1)
    },
    expectedCount: 0,
    expectedNextStaticType: staticTypeTable[aspect],
  })
}

test('throws when bytes end after annotations', iteration, 'iterateValues', {
  encode(encoder) {
    // Create a serialized object that ends immediately after annotations
    encoder.staticType(staticTypeTable.object).annotations({ p: 1 })
    // No aspects or values added
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected terminator, aspect or value/,
  },
})

test('throws when bytes end after iteratorValueAspect', iteration, 'iterateValues', {
  encode(encoder) {
    // Create a serialized object that ends after iteratorValueAspect
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add iterator value aspect but no value after it
      .staticType(staticTypeTable.iteratorValueAspect)
    // No value added
  },
  expectedThrows: {
    name: 'AssertionError',
    message: /Expected terminator, aspect or value/,
  },
})

test('handles terminators correctly', iteration, 'iterateValues', {
  encode(encoder) {
    // Create a mock serialized iterable with a terminator
    encoder
      .staticType(staticTypeTable.object)
      .annotations({ p: 1 })
      // Add iterator value aspect
      .staticType(staticTypeTable.iteratorValueAspect)
      // Add a value
      .staticType(staticTypeTable.number)
      .number(42)
      // Add terminator
      .staticType(staticTypeTable.terminator)
      // Add extra data
      .staticType(staticTypeTable.number)
      .number(99)
  },
  expectedCount: 1,
})

// -----------------------------------------------------------------------------
// Static Type Deserialization Tests using Macros
// -----------------------------------------------------------------------------

const typeDeserializationMacro = test.macro<[string, unknown, Comparison]>({
  title(providedTitle, desc) {
    return providedTitle || `DeserializationContext correctly deserializes ${desc}`
  },
  exec(t, _, value, expectedEquality) {
    // Create the original representation
    const originalContext = new DescriptionContext()
    const original = originalContext.represent(value)

    // Serialize it
    const encoder = new Encoder()
    original.serialize?.(encoder)
    original.serializeShallow?.(encoder)

    // Deserialize it
    const decoder = new Decoder(encoder.bytes)
    const deserializationContext = new DeserializationContext(decoder)
    const deserialized = deserializationContext.next()

    // Verify it matches the original with the correct equality type
    t.is(
      original.compare(deserialized!),
      expectedEquality,
      `Value should have ${expectedEquality === strictlyEqual ? 'strictly equal' : expectedEquality === possiblyEqual ? 'possibly equal' : 'comparable'} representation after serialization/deserialization`,
    )
  },
})

// Primitive values tests (strictly equal)
test(typeDeserializationMacro, 'undefined', undefined, strictlyEqual)
test(typeDeserializationMacro, 'null', null, strictlyEqual)
test(typeDeserializationMacro, 'boolean (true)', true, strictlyEqual)
test(typeDeserializationMacro, 'boolean (false)', false, strictlyEqual)
test(typeDeserializationMacro, 'number (integer)', 42, strictlyEqual)
test(typeDeserializationMacro, 'number (float)', 3.14, strictlyEqual)
test(typeDeserializationMacro, 'number (NaN)', NaN, strictlyEqual)
test(typeDeserializationMacro, 'number (Infinity)', Infinity, strictlyEqual)
test(typeDeserializationMacro, 'number (negative zero)', -0, strictlyEqual)
test(typeDeserializationMacro, 'bigint', BigInt('9007199254740991'), strictlyEqual)
test(typeDeserializationMacro, 'string', 'hello world', strictlyEqual)
test(typeDeserializationMacro, 'well-known symbol', Symbol.iterator, strictlyEqual)
test(typeDeserializationMacro, 'registered symbol', Symbol.for('test'), strictlyEqual)

// Symbol with description (possiblyEqual)
test(typeDeserializationMacro, 'symbol', Symbol('test'), possiblyEqual)

// Complex objects tests (comparable)
test(typeDeserializationMacro, 'date', new Date('2023-01-01T00:00:00.000Z'), comparable)
test(typeDeserializationMacro, 'regexp', /test/i, comparable)
test(typeDeserializationMacro, 'error', new Error('test error'), comparable)
test(
  typeDeserializationMacro,
  'arguments',
  (function (..._: any[]) {
    return arguments
  })(1, 2, 3),
  comparable,
)
test(typeDeserializationMacro, 'array', [1, 2, 3], comparable)
test(typeDeserializationMacro, 'object', { a: 1, b: 2 }, comparable)
test(typeDeserializationMacro, 'set', new Set([1, 2, 3]), comparable)
test(
  typeDeserializationMacro,
  'map',
  new Map([
    ['a', 1],
    ['b', 2],
  ]),
  comparable,
)

// Binary data tests
test(
  typeDeserializationMacro,
  'array buffer',
  (() => {
    const buffer = new ArrayBuffer(4)
    new Uint8Array(buffer).set([1, 2, 3, 4])
    return buffer
  })(),
  comparable,
)

test(typeDeserializationMacro, 'typed array', new Uint8Array([1, 2, 3, 4]), comparable)

test(
  typeDeserializationMacro,
  'data view',
  (() => {
    const buffer = new ArrayBuffer(4)
    new Uint8Array(buffer).set([1, 2, 3, 4])
    return new DataView(buffer)
  })(),
  comparable,
)

// Object wrapper tests
test(typeDeserializationMacro, 'boxed primitive', new Number(42), comparable)

// Function test
test(
  typeDeserializationMacro,
  'function',
  function testFunc() {
    return 42
  },
  comparable,
)

// Promise test
test(typeDeserializationMacro, 'promise', Promise.resolve(42), comparable)

// WeakMap and WeakSet tests (possiblyEqual)
test(typeDeserializationMacro, 'weak map', new WeakMap([[{}, 'value']]), possiblyEqual)
test(typeDeserializationMacro, 'weak set', new WeakSet([{}]), possiblyEqual)

test(typeDeserializationMacro, 'module namespace object', testModuleNamespace, comparable)

test('DeserializationContext correctly deserializes crypto key', async (t) => {
  const cryptoKey = await crypto.subtle.generateKey(
    {
      name: 'HMAC',
      hash: { name: 'SHA-256' },
      length: 256,
    },
    true,
    ['sign', 'verify'],
  )

  // Now use the same pattern as in the macro
  const originalContext = new DescriptionContext()
  const original = originalContext.represent(cryptoKey)

  const encoder = new Encoder()
  original.serialize?.(encoder)
  original.serializeShallow?.(encoder)

  const decoder = new Decoder(encoder.bytes)
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = deserializationContext.next()

  t.is(
    original.compare(deserialized!),
    possiblyEqual,
    'CryptoKey should have possiblyEqual representation after serialization/deserialization',
  )
})

test('DeserializationContext correctly deserializes external value', async (t) => {
  // @ts-expect-error ts2307: Suppress error about missing import
  const refNapi = await (import('ref-napi') as Promise<{ default: { instance: object } }>)
  const externalValue = refNapi.default.instance

  // Now proceed with the same pattern as the macro
  const originalContext = new DescriptionContext()
  const original = originalContext.represent(externalValue)

  const encoder = new Encoder()
  original.serialize?.(encoder)
  original.serializeShallow?.(encoder)

  const decoder = new Decoder(encoder.bytes)
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = deserializationContext.next()

  t.is(
    original.compare(deserialized!),
    possiblyEqual,
    'External value should have possiblyEqual representation after serialization/deserialization',
  )
})
