import test from 'ava'
import { describe, isPrimitive, DescriptionContext } from '../describe.ts'
import { StringRepresentation } from '../values/primitives/string.ts'
import { NumberRepresentation } from '../values/primitives/number.ts'
import { BooleanRepresentation } from '../values/primitives/boolean.ts'
import { NullRepresentation } from '../values/primitives/null.ts'
import { UndefinedRepresentation } from '../values/primitives/undefined.ts'
import { BigIntRepresentation } from '../values/primitives/bigint.ts'
import { SymbolRepresentation } from '../values/primitives/symbol.ts'
import { ArrayRepresentation } from '../values/objects/array.ts'
import { FunctionRepresentation } from '../values/objects/function.ts'
import { ObjectRepresentation } from '../values/objects/object.ts'
import { ArgumentsRepresentation } from '../values/objects/arguments.ts'
import { ErrorRepresentation } from '../values/objects/error.ts'
import { RegExpRepresentation } from '../values/objects/regexp.ts'
import { MapRepresentation } from '../values/objects/map.ts'
import { SetRepresentation } from '../values/objects/set.ts'
import { DateRepresentation } from '../values/objects/date.ts'
import { ArrayBufferRepresentation } from '../values/objects/array-buffer.ts'
import { ArrayBufferViewRepresentation } from '../values/objects/array-buffer-view.ts'
import { BoxedPrimitiveRepresentation } from '../values/objects/boxed.ts'
import { compareDescriptors } from '../compare.ts'
import { BytesAccessor } from '../accessors/bytes.ts'
import { ElementAccessor } from '../accessors/element.ts'
import { MapEntryAccessor } from '../accessors/map-entry.ts'
import { unequal, strictlyEqual } from '../comparison.ts'
import { ExternalRepresentation } from '../values/nodejs/external.ts'
import { ModuleNamespaceObjectRepresentation } from '../values/objects/module-namespace-object.ts'
import { PromiseRepresentation } from '../values/objects/promise.ts'
import { WeakMapRepresentation } from '../values/objects/weak-map.ts'
import { WeakSetRepresentation } from '../values/objects/weak-set.ts'
import { CryptoKeyRepresentation } from '../values/web/crypto-key.ts'
import { NamedPropertyAccessor } from '../accessors/property.ts'
import { IteratorValueAccessor } from '../accessors/iterator-value.ts'

// -----------------------------------------------------------------------------
// Core function tests
// -----------------------------------------------------------------------------

// Test isPrimitive function
test('isPrimitive identifies primitive values correctly', (t) => {
  // Primitive values
  t.true(isPrimitive(null))
  t.true(isPrimitive(undefined))
  t.true(isPrimitive(true))
  t.true(isPrimitive(false))
  t.true(isPrimitive(0))
  t.true(isPrimitive(42))
  t.true(isPrimitive('string'))
  t.true(isPrimitive(''))
  t.true(isPrimitive(Symbol('test')))
  t.true(isPrimitive(BigInt(123)))

  // Non-primitive values
  t.false(isPrimitive({}))
  t.false(isPrimitive([]))
  t.false(isPrimitive(new Date()))
  t.false(isPrimitive(new Map()))
  t.false(isPrimitive(() => {}))
  t.false(isPrimitive(Object(42))) // Boxed primitive
})

// Test describe function with primitive values
test('describe returns correct representation for primitive values', (t) => {
  t.is(describe(42).constructor, NumberRepresentation)
  t.is(describe('hello').constructor, StringRepresentation)
  t.is(describe(true).constructor, BooleanRepresentation)
  t.is(describe(null).constructor, NullRepresentation)
  t.is(describe(undefined).constructor, UndefinedRepresentation)
  t.is(describe(BigInt(123)).constructor, BigIntRepresentation)
  t.is(describe(Symbol('test')).constructor, SymbolRepresentation)
})

// Test describe function with complex objects
test('describe returns correct representation for objects', (t) => {
  t.is(describe({}).constructor, ObjectRepresentation)
  t.is(describe([]).constructor, ArrayRepresentation)
  t.is(describe(() => {}).constructor, FunctionRepresentation)
  t.is(describe(new Map()).constructor, MapRepresentation)
  t.is(describe(new Set()).constructor, SetRepresentation)
  t.is(describe(new Date()).constructor, DateRepresentation)
  t.is(describe(/regex/).constructor, RegExpRepresentation)
  t.is(describe(Promise.resolve()).constructor, PromiseRepresentation)
  t.is(describe(new WeakMap()).constructor, WeakMapRepresentation)
  t.is(describe(new WeakSet()).constructor, WeakSetRepresentation)
})

// Test for objects with valid String.toStringTag
test('describe handles objects with toStringTag correctly', (t) => {
  const obj = {}
  Object.defineProperty(obj, Symbol.toStringTag, {
    value: 'CustomObject',
  })

  // Should still be represented as a generic object
  const representation = describe(obj)
  t.is(representation.constructor, ObjectRepresentation)
})

// Test with a custom object that won't match any known types
test('describe uses generic ObjectRepresentation for unknown object types', (t) => {
  // Create a class with a null prototype to avoid matching standard JS types
  const CustomClass = function () {} as unknown as { new (): any }
  CustomClass.prototype = Object.create(null)

  const instance = new CustomClass()
  instance.customProp = 'test'

  // This should end up using the fallback case
  const representation = describe(instance)
  t.is(representation.constructor, ObjectRepresentation)
})

// Test that multiple levels of object traversal work correctly
test('describe handles nested object structures', (t) => {
  const nested = {
    a: [1, 2, { b: 'test' }],
    c: {
      d: new Map([['key', 'value']]),
      e: new Set([1, 2, 3]),
    },
  }

  const representation1 = describe(nested)
  const representation2 = describe({ ...nested })

  // Use compareDescriptors to verify the structure was maintained with an equivalent object
  t.true(compareDescriptors(representation1, representation2))
})

// -----------------------------------------------------------------------------
// Tests by object type
// -----------------------------------------------------------------------------

// Test Arguments objects
test('describe correctly identifies arguments objects', (t) => {
  function getArguments(..._: unknown[]) {
    return arguments
  }
  const args = getArguments(1, 2, 3)
  t.is(describe(args).constructor, ArgumentsRepresentation)
})

// Test array buffer and views
test('describe correctly identifies ArrayBuffers and views', (t) => {
  const buffer = new ArrayBuffer(16)
  t.is(describe(buffer).constructor, ArrayBufferRepresentation)

  const uint8Array = new Uint8Array(buffer)
  t.is(describe(uint8Array).constructor, ArrayBufferViewRepresentation)

  const dataView = new DataView(buffer)
  t.is(describe(dataView).constructor, ArrayBufferViewRepresentation)
})

// Test boxed primitives
test('describe correctly identifies boxed primitives', (t) => {
  // eslint-disable-next-line no-new-wrappers
  t.is(describe(new String('test')).constructor, BoxedPrimitiveRepresentation)
  // eslint-disable-next-line no-new-wrappers
  t.is(describe(new Number(42)).constructor, BoxedPrimitiveRepresentation)
  // eslint-disable-next-line no-new-wrappers
  t.is(describe(new Boolean(true)).constructor, BoxedPrimitiveRepresentation)
})

// Test circular references handling
test('describe handles circular references', (t) => {
  const obj = {} as any
  obj.self = obj

  const representation = describe(obj)

  // Verify that circular references work by using the compare function
  // which handles pointer detection
  const result = compareDescriptors(describe(obj), representation)
  t.true(result)
})

// Test CryptoKey objects
test('describe correctly identifies CryptoKey objects', async (t) => {
  // Create a real CryptoKey for testing
  const key = await globalThis.crypto.subtle.generateKey(
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  t.is(describe(key).constructor, CryptoKeyRepresentation)
})

// Test errors
test('describe correctly identifies Error objects', (t) => {
  t.is(describe(new Error('test')).constructor, ErrorRepresentation)
  t.is(describe(new TypeError('test')).constructor, ErrorRepresentation)
  t.is(describe(new SyntaxError('test')).constructor, ErrorRepresentation)
})

// Test External objects
test('describe correctly identifies External objects', async (t) => {
  // @ts-expect-error ts2307: Suppress error about missing import
  const refNapi = await (import('ref-napi') as Promise<{ default: { instance: object } }>)
  const externalValue = refNapi.default.instance

  t.is(describe(externalValue).constructor, ExternalRepresentation)
})

// Test Module Namespace objects
test('describe correctly identifies Module Namespace objects', async (t) => {
  const namespace = await import('../values/objects/test/fixtures/module-fixture.ts')
  t.is(describe(namespace).constructor, ModuleNamespaceObjectRepresentation)
})

// Test Symbol handling
test('describe handles symbols and their registration', (t) => {
  const regularSymbol = Symbol('test')
  const registeredSymbol = Symbol.for('registered')
  const wellKnownSymbol = Symbol.iterator

  t.is(describe(regularSymbol).constructor, SymbolRepresentation)
  t.is(describe(registeredSymbol).constructor, SymbolRepresentation)
  t.is(describe(wellKnownSymbol).constructor, SymbolRepresentation)

  // Compare the symbols to make sure they're handled properly
  const regularSymbolDesc = describe(regularSymbol)
  const registeredSymbolDesc = describe(registeredSymbol)
  const wellKnownSymbolDesc = describe(wellKnownSymbol)

  // Same symbols should be equal
  t.true(compareDescriptors(regularSymbolDesc, describe(regularSymbol)))
  t.true(compareDescriptors(registeredSymbolDesc, describe(Symbol.for('registered'))))
  t.true(compareDescriptors(wellKnownSymbolDesc, describe(Symbol.iterator)))

  // Different symbols should not be equal
  t.false(compareDescriptors(regularSymbolDesc, describe(Symbol('test'))))
  t.false(compareDescriptors(registeredSymbolDesc, regularSymbolDesc))
  t.false(compareDescriptors(wellKnownSymbolDesc, describe(Symbol('iterator'))))
})

// -----------------------------------------------------------------------------
// DescriptionContext Tests - Core functionality
// -----------------------------------------------------------------------------

test('DescriptionContext - is identifies context instances correctly', (t) => {
  const context = new DescriptionContext()
  t.true(DescriptionContext.is(context))
  t.false(DescriptionContext.is({ deserialized: false } as any))
})

test('DescriptionContext - deserialized returns false', (t) => {
  const context = new DescriptionContext()
  t.false(context.deserialized)
})

test('DescriptionContext - represent() returns consistent representations for the same object', (t) => {
  const context = new DescriptionContext()
  const obj = { a: 1 }

  const rep1 = context.represent(obj)
  const rep2 = context.represent(obj)

  // The same object should return the exact same representation instance
  t.is(rep1, rep2)
})

test('DescriptionContext - pointer returns index for representation', (t) => {
  const context = new DescriptionContext()
  const representation1 = context.represent({})
  const representation2 = context.represent({})

  t.truthy(context.pointer(representation1))
  t.truthy(context.pointer(representation2))
  t.true(context.pointer(representation1)! < context.pointer(representation2)!)
})

// -----------------------------------------------------------------------------
// DescriptionContext Tests - Type detection methods
// -----------------------------------------------------------------------------

test('DescriptionContext correctly identifies array-like objects', (t) => {
  const context = new DescriptionContext()

  // Array-like objects
  t.true(context.isArrayLike([1, 2, 3]))
  t.true(context.isArrayLike({ 0: 'a', 1: 'b', length: 2 }))

  // Non-array-like objects
  t.false(context.isArrayLike({}))
  t.false(context.isArrayLike({ length: 'not-a-number' }))
  t.false(context.isArrayLike({ length: -1 })) // Negative length
  t.false(context.isArrayLike({ length: 1 })) // Missing index 0
})

test('DescriptionContext - isArrayLike handles various edge cases', (t) => {
  const context = new DescriptionContext()

  // Test with non-safe integer length
  const badLength1 = { length: Number.MAX_SAFE_INTEGER + 1 }
  t.false(context.isArrayLike(badLength1))

  // Test with negative length
  const badLength2 = { length: -1 }
  t.false(context.isArrayLike(badLength2))

  // Test with length as a non-integer number
  const badLength3 = { length: 1.5 }
  t.false(context.isArrayLike(badLength3))
})

test('DescriptionContext correctly identifies prototype chains', (t) => {
  const context = new DescriptionContext()

  // Null prototype
  const nullProto = Object.create(null)
  t.true(context.isNullProto(nullProto))
  t.false(context.isObjectProto(nullProto))

  // Object prototype
  const objProto = {}
  t.false(context.isNullProto(objProto))
  t.true(context.isObjectProto(objProto))

  // Custom prototype
  class Custom {}
  const customInstance = new Custom()
  t.false(context.isNullProto(customInstance))
  t.false(context.isObjectProto(customInstance))
})

test('DescriptionContext correctly extracts constructor names', (t) => {
  const context = new DescriptionContext()

  class Named {}
  const namedInstance = new Named()
  t.is(context.constructorName(namedInstance), 'Named')

  // Anonymous class
  const anonymousInstance = new (class {})()
  t.is(context.constructorName(anonymousInstance), undefined)

  // Object with no constructor
  const noConstructor = Object.create(null)
  t.is(context.constructorName(noConstructor), undefined)
})

test('DescriptionContext - constructorName handles functions with empty names', (t) => {
  const context = new DescriptionContext()

  // Create function with empty name
  const AnonymousFunc = Function('return function() {}')()
  const instance = new AnonymousFunc()

  t.is(context.constructorName(instance), undefined)
})

test('DescriptionContext - stringTag handles non-string toStringTag values', (t) => {
  const context = new DescriptionContext()
  const obj = {}
  // Set Symbol.toStringTag to a non-string value
  Object.defineProperty(obj, Symbol.toStringTag, {
    value: 42,
  })

  t.is(context.stringTag(obj), undefined)
})

test('DescriptionContext - stringTag handles string toStringTag values', (t) => {
  const context = new DescriptionContext()

  const obj = {}
  Object.defineProperty(obj, Symbol.toStringTag, {
    value: 'CustomObject',
  })

  t.is(context.stringTag(obj), 'CustomObject')
})

// -----------------------------------------------------------------------------
// DescriptionContext Tests - Property and value accessors
// -----------------------------------------------------------------------------

test('DescriptionContext - length and size return correct values', (t) => {
  const context = new DescriptionContext()

  // Test length
  t.is(context.length([1, 2, 3]), 3)
  t.is(context.length({ length: 5 }), 5)

  // Test size
  t.is(
    context.size(
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
    ),
    2,
  )
  t.is(context.size(new Set([1, 2, 3])), 3)
})

test('DescriptionContext - valueOf returns primitive value', (t) => {
  const context = new DescriptionContext()
  const date = new Date('2023-01-01')

  t.is(context.valueOf(date), date.valueOf())
  t.is(context.valueOf(Object(42)), 42)
  t.is(context.valueOf(Object('test')), 'test')
})

test('DescriptionContext - describeSymbol categorizes symbols correctly', (t) => {
  const context = new DescriptionContext()

  // Regular symbol
  const regularSymbol = Symbol('test') as unknown as object
  const regularDesc = context.describeSymbol(regularSymbol)
  t.is(regularDesc.key, undefined)
  t.is(regularDesc.wellKnown, undefined)
  t.truthy(regularDesc.string)

  // Registered symbol
  const registeredSymbol = Symbol.for('registered') as unknown as object
  const registeredDesc = context.describeSymbol(registeredSymbol)
  t.is(registeredDesc.key, 'registered')
  t.is(registeredDesc.wellKnown, undefined)
  t.is(registeredDesc.string, undefined)

  // Well-known symbol
  const wellKnownSymbol = Symbol.iterator as unknown as object
  const wellKnownDesc = context.describeSymbol(wellKnownSymbol)
  t.is(wellKnownDesc.key, undefined)
  t.is(wellKnownDesc.wellKnown, 'iterator')
  t.is(wellKnownDesc.string, undefined)
})

// -----------------------------------------------------------------------------
// DescriptionContext Tests - Iteration and representation methods
// -----------------------------------------------------------------------------

test('DescriptionContext - representBytes handles array buffers and views', (t) => {
  const context = new DescriptionContext()
  const buffer = new ArrayBuffer(16)

  // Test ArrayBuffer
  const bytesAccessor1 = context.representBytes(buffer)

  // Create a direct BytesAccessor with expected values
  const expectedAccessor1 = new BytesAccessor(buffer, 0, 16)

  // Compare the actual accessor with our expected one
  t.is(bytesAccessor1.compare(expectedAccessor1), strictlyEqual)

  // Test ArrayBufferView
  const view = new Uint8Array(buffer, 4, 8)
  const bytesAccessor2 = context.representBytes(view)

  // Create a direct BytesAccessor with expected values
  const expectedAccessor2 = new BytesAccessor(buffer, 4, 8)

  // Compare the actual accessor with our expected one
  t.is(bytesAccessor2.compare(expectedAccessor2), strictlyEqual)

  // Test that different accessors don't match
  const differentAccessor = new BytesAccessor(buffer, 2, 6)
  t.is(bytesAccessor2.compare(differentAccessor), unequal)
})

test('DescriptionContext - iterateElements iterates through array-like elements', (t) => {
  const context = new DescriptionContext()
  const array = [1, 2, 3]

  // Convert iterator to array for testing
  const elements = [...context.iterateElements(array)]
  t.is(elements.length, 3)

  // Create expected accessors with correct values
  const expectedElement0 = new ElementAccessor(0, describe(1))
  const expectedElement1 = new ElementAccessor(1, describe(2))
  const expectedElement2 = new ElementAccessor(2, describe(3))

  // Compare using accessor's compare method
  t.is(elements[0]!.compare(expectedElement0), strictlyEqual)
  t.is(elements[1]!.compare(expectedElement1), strictlyEqual)
  t.is(elements[2]!.compare(expectedElement2), strictlyEqual)
})

test('DescriptionContext - iterateMapEntries iterates through map entries', (t) => {
  const context = new DescriptionContext()
  const map = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])

  // Convert iterator to array for testing
  const entries = [...context.iterateMapEntries(map)]
  t.is(entries.length, 2)

  // Create expected map entry accessors
  const expectedEntry0 = new MapEntryAccessor(context, describe('key1'), describe('value1'))
  const expectedEntry1 = new MapEntryAccessor(context, describe('key2'), describe('value2'))

  // Compare using accessor's compare method
  t.is(entries[0]!.compare(expectedEntry0), strictlyEqual)
  t.is(entries[1]!.compare(expectedEntry1), strictlyEqual)
})

test('DescriptionContext - nonSparseArrayElements returns non-sparse elements', (t) => {
  const context = new DescriptionContext()
  // Create sparse array
  const sparseArray = []
  sparseArray[0] = 'first'
  sparseArray[2] = 'third' // index 1 is sparse

  const elements = context.nonSparseArrayElements(sparseArray)
  t.is(elements.length, 2) // Should only have two elements, not three
  t.deepEqual(elements, [
    [0, 'first'],
    [2, 'third'],
  ])
})

test('DescriptionContext - namedProperties handles property descriptors correctly', (t) => {
  const context = new DescriptionContext()

  // Object with non-enumerable properties
  const obj = {}
  Object.defineProperty(obj, 'nonEnumProp', {
    value: 'hidden',
    enumerable: false,
  })
  Object.defineProperty(obj, 'enumProp', {
    value: 'visible',
    enumerable: true,
  })

  const props = [...context.namedProperties(obj)]

  // Create expected property accessors
  const expectedEnumProp = new NamedPropertyAccessor('enumProp', describe('visible'))

  // Some property should compare equal to our expected enumProp accessor
  t.true(props.some((p) => p.compare(expectedEnumProp) === strictlyEqual))

  // None of the properties should compare equal to a nonEnumProp accessor
  const expectedNonEnumProp = new NamedPropertyAccessor('nonEnumProp', describe('hidden'))
  t.false(props.some((p) => p.compare(expectedNonEnumProp) === strictlyEqual))

  // Test with include parameter to force inclusion of non-enumerable properties
  const propsWithForced = [...context.namedProperties(obj, 'nonEnumProp')]
  t.true(propsWithForced.some((p) => p.compare(expectedNonEnumProp) === strictlyEqual))
})

test('DescriptionContext - namedProperties handles array-like objects correctly', (t) => {
  const context = new DescriptionContext()

  // Array-like object with both numeric and non-numeric properties
  const arrayLike = { 0: 'zero', 1: 'one', length: 2, extra: 'property' } as any

  const props = [...context.namedProperties(arrayLike)]

  // Create expected property accessors
  const expectedProp0 = new NamedPropertyAccessor('0', describe('zero'))
  const expectedProp1 = new NamedPropertyAccessor('1', describe('one'))
  const expectedPropExtra = new NamedPropertyAccessor('extra', describe('property'))

  // Numeric indices should not be included
  t.false(props.some((p) => p.compare(expectedProp0) === strictlyEqual))
  t.false(props.some((p) => p.compare(expectedProp1) === strictlyEqual))

  // Non-numeric properties should be included
  t.true(props.some((p) => p.compare(expectedPropExtra) === strictlyEqual))

  // Test integer-like string keys past the length
  arrayLike[2] = 'two' // This is at the length boundary
  arrayLike['3'] = 'three' // This is beyond length

  const propsWithMore = [...context.namedProperties(arrayLike)]
  const expectedProp3 = new NamedPropertyAccessor('3', describe('three'))
  t.true(propsWithMore.some((p) => p.compare(expectedProp3) === strictlyEqual))
})

test('DescriptionContext - iterateValues handles missing iterator', (t) => {
  const context = new DescriptionContext()

  // Object without iterator
  const obj = { a: 1, b: 2 }

  // Should yield no values
  const values = Array.from(context.iterateValues(obj))
  t.is(values.length, 0)
})

test('DescriptionContext - handles objects with Symbol.iterator', (t) => {
  const context = new DescriptionContext()

  // Object with custom iterator
  const iterableObj = {
    data: [1, 2, 3],
    *[Symbol.iterator]() {
      yield* this.data
    },
  }

  // Check iterateValues works correctly
  const values = Array.from(context.iterateValues(iterableObj))
  t.is(values.length, 3)

  // Create expected ValueAccessor instances
  const expectedValue0 = new IteratorValueAccessor(0, describe(1))
  const expectedValue1 = new IteratorValueAccessor(1, describe(2))
  const expectedValue2 = new IteratorValueAccessor(2, describe(3))

  // Compare using accessor's compare method
  t.is(values[0]!.compare(expectedValue0), strictlyEqual)
  t.is(values[1]!.compare(expectedValue1), strictlyEqual)
  t.is(values[2]!.compare(expectedValue2), strictlyEqual)
})

// -----------------------------------------------------------------------------
// DescriptionContext Tests - Edge cases and special objects
// -----------------------------------------------------------------------------

test('DescriptionContext - handles array-like objects with null prototypes correctly', (t) => {
  const context = new DescriptionContext()

  // Create array-like object with null prototype
  const arrayLikeNullProto = Object.create(null)
  arrayLikeNullProto.length = 2
  arrayLikeNullProto[0] = 'item0'
  arrayLikeNullProto[1] = 'item1'

  t.true(context.isArrayLike(arrayLikeNullProto))
  t.true(context.isNullProto(arrayLikeNullProto))

  // Ensure it's represented correctly
  const representation = describe(arrayLikeNullProto)
  t.is(representation.constructor, ObjectRepresentation)

  // Verify it can iterate correctly
  const elements = [...context.iterateElements(arrayLikeNullProto)]
  t.is(elements.length, 2)
})

test('DescriptionContext - symbolProperties handles objects with no symbols', (t) => {
  const context = new DescriptionContext()
  const obj = { a: 1, b: 2 }

  const symbolProps = [...context.symbolProperties(obj)]
  t.is(symbolProps.length, 0)
})

test('DescriptionContext - symbolProperties handles objects with symbols', (t) => {
  const context = new DescriptionContext()
  const sym = Symbol('test')
  const obj = {
    a: 1,
    [sym]: 'symbol value',
  }

  const symbolProps = [...context.symbolProperties(obj)]
  t.is(symbolProps.length, 1)
})

test('DescriptionContext - handles non-array-like objects with numeric properties correctly', (t) => {
  const context = new DescriptionContext()

  // Object with numeric properties that is not array-like
  const obj = {
    0: 'zero',
    1: 'one',
    a: 'value',
  }

  t.false(context.isArrayLike(obj))

  // Check that all properties are included in namedProperties
  const props = [...context.namedProperties(obj)]

  // Create expected property accessors
  const expectedProp0 = new NamedPropertyAccessor('0', describe('zero'))
  const expectedProp1 = new NamedPropertyAccessor('1', describe('one'))

  // All numeric properties should be included
  t.true(props.some((p) => p.compare(expectedProp0) === strictlyEqual))
  t.true(props.some((p) => p.compare(expectedProp1) === strictlyEqual))
})
