import test from 'ava'
import { DescriptionContext } from '../description-context.ts'
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
import { ExternalRepresentation } from '../values/nodejs/external.ts'
import { ModuleNamespaceObjectRepresentation } from '../values/objects/module-namespace-object.ts'
import { PromiseRepresentation } from '../values/objects/promise.ts'
import { WeakMapRepresentation } from '../values/objects/weak-map.ts'
import { WeakSetRepresentation } from '../values/objects/weak-set.ts'
import { CryptoKeyRepresentation } from '../values/web/crypto-key.ts'
import { ElementAccessor } from '../accessors/element.ts'
import { MapEntryAccessor } from '../accessors/map-entry.ts'
import { NamedPropertyAccessor } from '../accessors/property.ts'
import { strictlyEqual } from '../comparison.ts'
import { BytesAccessor } from '../accessors/bytes.ts'
import { deriveFlags } from '../flags.ts'

// -----------------------------------------------------------------------------
// Core functionality
// -----------------------------------------------------------------------------

test('is identifies context instances correctly', (t) => {
  const context = new DescriptionContext()
  t.true(DescriptionContext.is(context))
  t.false(DescriptionContext.is({ deserialized: false } as any))
})

test('deserialized returns false', (t) => {
  const context = new DescriptionContext()
  t.false(context.deserialized)
})

test('flags returns flags', (t) => {
  const flags = deriveFlags()
  const context = new DescriptionContext({ flags })
  t.deepEqual(context.flags, flags, 'Flags should match the provided flags')
})

test('represent() returns consistent representations for the same object', (t) => {
  const context = new DescriptionContext()
  const obj = { a: 1 }

  const rep1 = context.represent(obj)
  const rep2 = context.represent(obj)

  // The same object should return the exact same representation instance
  t.is(rep1, rep2)
})

test('pointer returns index for representation', (t) => {
  const context = new DescriptionContext()
  const representation1 = context.represent({})
  const representation2 = context.represent({})

  t.truthy(context.pointer(representation1))
  t.truthy(context.pointer(representation2))
  t.true(context.pointer(representation1)! < context.pointer(representation2)!)
})

test('internal PointerMap correctly allocates and retrieves pointers', (t) => {
  const context = new DescriptionContext()
  const obj1 = {}
  const obj2 = {}

  // First represent the objects to have them in the pointer map
  const rep1 = context.represent(obj1)
  const rep2 = context.represent(obj2)

  // Check that we can get pointer indexes
  const pointer1 = context.pointer(rep1)
  const pointer2 = context.pointer(rep2)

  t.truthy(pointer1)
  t.truthy(pointer2)
  t.not(pointer1, pointer2)

  // Test with object that hasn't been represented yet
  const obj3 = {}
  const rep3 = context.represent(obj3)

  const pointer3 = context.pointer(rep3)
  t.truthy(pointer3)
  t.not(pointer3, pointer1)
  t.not(pointer3, pointer2)
})

// -----------------------------------------------------------------------------
// Type detection methods
// -----------------------------------------------------------------------------

test('correctly identifies prototype chains', (t) => {
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

test('correctly identifies array-like objects', (t) => {
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

test('isArrayLike handles various edge cases', (t) => {
  const context = new DescriptionContext()

  // Test with non-safe integer length
  const nonSafeInteger = { length: Number.MAX_SAFE_INTEGER + 1, 0: 'value' }
  t.false(context.isArrayLike(nonSafeInteger))

  // Test with fractional length
  const fractionalLength = { length: 3.5, 0: 'value' }
  t.false(context.isArrayLike(fractionalLength))

  // Test with zero length (should be true even without indices)
  const zeroLength = { length: 0 }
  t.true(context.isArrayLike(zeroLength))

  // Test with negative length
  const negativeLength = { length: -1, 0: 'value' }
  t.false(context.isArrayLike(negativeLength))

  // Test with non-numeric length property
  const stringLength = { length: '3' }
  t.false(context.isArrayLike(stringLength))

  // Test with null length
  const nullLength = { length: null }
  t.false(context.isArrayLike(nullLength))
})

test('constructorName handles edge cases correctly', (t) => {
  const context = new DescriptionContext()

  // Test with empty name
  const EmptyNameClass = Function('return function() {}')()
  const emptyNameInstance = new EmptyNameClass()
  t.is(context.constructorName(emptyNameInstance), undefined)

  // Test with explicitly empty name
  const ExplicitEmptyNameClass = Function('return function() { this.constructor.name = "" }')()
  const explicitEmptyNameInstance = new ExplicitEmptyNameClass()
  t.is(context.constructorName(explicitEmptyNameInstance), undefined)

  // Test with non-function constructor
  const noConstructorObject = Object.create(null)
  noConstructorObject.constructor = undefined
  t.is(context.constructorName(noConstructorObject), undefined)

  // Test with normal class
  class NormalClass {}
  const normalInstance = new NormalClass()
  t.is(context.constructorName(normalInstance), 'NormalClass')
})

test('handles objects with toStringTag correctly', (t) => {
  const context = new DescriptionContext()

  const obj = {}
  Object.defineProperty(obj, Symbol.toStringTag, {
    value: 'CustomObject',
  })

  // Should still be represented as a generic object
  const representation = context.represent(obj)
  t.is(representation.constructor, ObjectRepresentation)

  // Check the stringTag method directly
  t.is(context.stringTag(obj), 'CustomObject')
})

// -----------------------------------------------------------------------------
// Primitive type representation tests
// -----------------------------------------------------------------------------

test('represent() correctly delegates to representPrimitive for primitive values', (t) => {
  const context = new DescriptionContext()

  // Just test one example of each primitive type to verify delegation works
  t.is(context.represent(42).constructor, NumberRepresentation)
  t.is(context.represent('hello').constructor, StringRepresentation)
  t.is(context.represent(true).constructor, BooleanRepresentation)
  t.is(context.represent(null).constructor, NullRepresentation)
  t.is(context.represent(undefined).constructor, UndefinedRepresentation)
  t.is(context.represent(BigInt(123)).constructor, BigIntRepresentation)
  t.is(context.represent(Symbol('test')).constructor, SymbolRepresentation)
})

test('valueOf returns primitive value from object wrapper', (t) => {
  const context = new DescriptionContext()

  // eslint-disable-next-line no-new-wrappers
  const stringObj = new String('test string')
  t.is(context.valueOf(stringObj), 'test string')

  // eslint-disable-next-line no-new-wrappers
  const numberObj = new Number(123)
  t.is(context.valueOf(numberObj), 123)

  // Test with Date object
  const date = new Date('2023-01-01')
  t.is(context.valueOf(date), date.getTime())

  // Test with custom valueOf implementation
  const custom = {
    valueOf() {
      return 'custom value'
    },
  }
  t.is(context.valueOf(custom), 'custom value')
})

test('handles symbols and their registration', (t) => {
  const context = new DescriptionContext()

  const regularSymbol = Symbol('test')
  const registeredSymbol = Symbol.for('registered')
  const wellKnownSymbol = Symbol.iterator

  t.is(context.represent(regularSymbol).constructor, SymbolRepresentation)
  t.is(context.represent(registeredSymbol).constructor, SymbolRepresentation)
  t.is(context.represent(wellKnownSymbol).constructor, SymbolRepresentation)

  // Compare the symbols to make sure they're handled properly
  const regularSymbolDesc = context.represent(regularSymbol)
  const registeredSymbolDesc = context.represent(registeredSymbol)
  const wellKnownSymbolDesc = context.represent(wellKnownSymbol)

  // Same symbols should be equal
  t.true(compareDescriptors(regularSymbolDesc, context.represent(regularSymbol)))
  t.true(compareDescriptors(registeredSymbolDesc, context.represent(Symbol.for('registered'))))
  t.true(compareDescriptors(wellKnownSymbolDesc, context.represent(Symbol.iterator)))

  // Different symbols should not be equal
  t.false(compareDescriptors(regularSymbolDesc, context.represent(Symbol('test'))))
  t.false(compareDescriptors(registeredSymbolDesc, regularSymbolDesc))
  t.false(compareDescriptors(wellKnownSymbolDesc, context.represent(Symbol('iterator'))))
})

test('describeSymbol categorizes symbols correctly', (t) => {
  const context = new DescriptionContext()

  // Regular symbol
  const regularSymbol = Symbol('test')
  const regularDesc = context.describeSymbol(regularSymbol as any)
  t.is(regularDesc.key, undefined)
  t.is(regularDesc.wellKnown, undefined)
  t.is(regularDesc.string, 'Symbol(test)')

  // Registered symbol (Symbol.for)
  const registeredSymbol = Symbol.for('registered-key')
  const registeredDesc = context.describeSymbol(registeredSymbol as any)
  t.is(registeredDesc.key, 'registered-key')
  t.is(registeredDesc.wellKnown, undefined)
  t.is(registeredDesc.string, undefined)

  // Well-known symbol
  const wellKnownSymbol = Symbol.iterator
  const wellKnownDesc = context.describeSymbol(wellKnownSymbol as any)
  t.is(wellKnownDesc.key, undefined)
  t.is(wellKnownDesc.wellKnown, 'iterator')
  t.is(wellKnownDesc.string, undefined)
})

// -----------------------------------------------------------------------------
// Object representation tests
// -----------------------------------------------------------------------------

test('DescriptionContext.represent returns correct representation for objects', (t) => {
  const context = new DescriptionContext()

  t.is(context.represent({}).constructor, ObjectRepresentation)
  t.is(context.represent([]).constructor, ArrayRepresentation)
  t.is(context.represent(() => {}).constructor, FunctionRepresentation)
  t.is(context.represent(new Map()).constructor, MapRepresentation)
  t.is(context.represent(new Set()).constructor, SetRepresentation)
  t.is(context.represent(new Date()).constructor, DateRepresentation)
  t.is(context.represent(/regex/).constructor, RegExpRepresentation)
  t.is(context.represent(Promise.resolve()).constructor, PromiseRepresentation)
  t.is(context.represent(new WeakMap()).constructor, WeakMapRepresentation)
  t.is(context.represent(new WeakSet()).constructor, WeakSetRepresentation)
})

test('uses generic ObjectRepresentation for unknown object types', (t) => {
  const context = new DescriptionContext()

  // Create a class with a null prototype to avoid matching standard JS types
  const CustomClass = function () {} as unknown as { new (): any }
  CustomClass.prototype = Object.create(null)

  const instance = new CustomClass()
  instance.customProp = 'test'

  // This should end up using the fallback case
  const representation = context.represent(instance)
  t.is(representation.constructor, ObjectRepresentation)
})

test('represent handles objects with null prototype correctly', (t) => {
  const context = new DescriptionContext()

  // Create a plain object with null prototype
  // This will hit the specific branch we want to test
  const nullProtoObj = Object.create(null)
  nullProtoObj.prop = 'value'

  // Verify the object does have a null prototype
  t.true(context.isNullProto(nullProtoObj))

  // This should use the ObjectRepresentation fallback for null prototype objects
  const representation = context.represent(nullProtoObj)

  // Verify it's represented correctly
  t.is(representation.constructor, ObjectRepresentation)
})

test('handles nested object structures', (t) => {
  const context = new DescriptionContext()

  const nested = {
    a: [1, 2, { b: 'test' }],
    c: {
      d: new Map([['key', 'value']]),
      e: new Set([1, 2, 3]),
    },
  }

  const representation1 = context.represent(nested)
  const representation2 = context.represent({ ...nested })

  // Check that the representations are similar
  t.true(compareDescriptors(representation1, representation2))
})

test('correctly identifies Arguments objects', (t) => {
  const context = new DescriptionContext()

  function getArguments(..._: unknown[]) {
    return arguments
  }
  const args = getArguments(1, 2, 3)
  t.is(context.represent(args).constructor, ArgumentsRepresentation)
})

test('correctly identifies ArrayBuffers and views', (t) => {
  const context = new DescriptionContext()

  const buffer = new ArrayBuffer(16)
  t.is(context.represent(buffer).constructor, ArrayBufferRepresentation)

  const uint8Array = new Uint8Array(buffer)
  t.is(context.represent(uint8Array).constructor, ArrayBufferViewRepresentation)

  const dataView = new DataView(buffer)
  t.is(context.represent(dataView).constructor, ArrayBufferViewRepresentation)
})

test('correctly identifies boxed primitives', (t) => {
  const context = new DescriptionContext()

  // eslint-disable-next-line no-new-wrappers
  t.is(context.represent(new String('test')).constructor, BoxedPrimitiveRepresentation)
  // eslint-disable-next-line no-new-wrappers
  t.is(context.represent(new Number(42)).constructor, BoxedPrimitiveRepresentation)
  // eslint-disable-next-line no-new-wrappers
  t.is(context.represent(new Boolean(true)).constructor, BoxedPrimitiveRepresentation)
})

test('correctly identifies CryptoKey objects', async (t) => {
  const context = new DescriptionContext()

  // Create a real CryptoKey for testing
  const key = await globalThis.crypto.subtle.generateKey(
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  t.is(context.represent(key).constructor, CryptoKeyRepresentation)
})

test('correctly identifies Error objects', (t) => {
  const context = new DescriptionContext()

  t.is(context.represent(new Error('test')).constructor, ErrorRepresentation)
  t.is(context.represent(new TypeError('test')).constructor, ErrorRepresentation)
  t.is(context.represent(new SyntaxError('test')).constructor, ErrorRepresentation)
})

test('correctly identifies External objects', async (t) => {
  const context = new DescriptionContext()

  // @ts-expect-error ts2307: Suppress error about missing import
  const refNapi = await (import('ref-napi') as Promise<{ default: { instance: object } }>)
  const externalValue = refNapi.default.instance

  t.is(context.represent(externalValue).constructor, ExternalRepresentation)
})

test('correctly identifies Module Namespace objects', async (t) => {
  const context = new DescriptionContext()

  const namespace = await import('../values/objects/test/fixtures/module-fixture.ts')
  t.is(context.represent(namespace).constructor, ModuleNamespaceObjectRepresentation)
})

// -----------------------------------------------------------------------------
// Collection handling tests
// -----------------------------------------------------------------------------

test('handles circular references', (t) => {
  const context = new DescriptionContext()

  const obj = {} as any
  obj.self = obj

  const representation = context.represent(obj)

  // We need a separate object to verify pointer tracking works
  const obj2 = {} as any
  obj2.self = obj2

  const representation2 = context.represent(obj2)

  // Verify circular references are handled correctly
  t.true(compareDescriptors(representation, context.represent(obj)))
  t.true(compareDescriptors(representation2, context.represent(obj2)))
})

test('iterateElements iterates through array-like elements', (t) => {
  const context = new DescriptionContext()
  const array = [1, 2, 3]

  // Convert iterator to array for testing
  const elements = [...context.iterateElements(array)]
  t.is(elements.length, 3)

  // Create expected accessors with correct values
  const expectedElement0 = new ElementAccessor(0, context.represent(1))
  const expectedElement1 = new ElementAccessor(1, context.represent(2))
  const expectedElement2 = new ElementAccessor(2, context.represent(3))

  // Compare using accessor's compare method
  t.is(elements[0]!.compare(expectedElement0), strictlyEqual)
  t.is(elements[1]!.compare(expectedElement1), strictlyEqual)
  t.is(elements[2]!.compare(expectedElement2), strictlyEqual)
})

test('iterateMapEntries iterates through map entries', (t) => {
  const context = new DescriptionContext()
  const map = new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ])

  // Convert iterator to array for testing
  const entries = [...context.iterateMapEntries(map)]
  t.is(entries.length, 2)

  // Create expected map entry accessors
  const expectedEntry0 = new MapEntryAccessor(context, context.represent('key1'), context.represent('value1'))
  const expectedEntry1 = new MapEntryAccessor(context, context.represent('key2'), context.represent('value2'))

  // Compare using accessor's compare method
  t.is(entries[0]!.compare(expectedEntry0), strictlyEqual)
  t.is(entries[1]!.compare(expectedEntry1), strictlyEqual)
})

test('iterateValues handles objects with and without Symbol.iterator', (t) => {
  const context = new DescriptionContext()

  // Object with iterator
  const iterable = {
    *[Symbol.iterator]() {
      yield 1
      yield 'two'
      yield { three: 3 }
    },
  }

  const iterableValues = [...context.iterateValues(iterable)]
  t.is(iterableValues.length, 3)

  // Object without iterator
  const nonIterable = { a: 1, b: 2 }
  const nonIterableValues = [...context.iterateValues(nonIterable)]
  t.is(nonIterableValues.length, 0)
})

test('size returns correct size for sized collections', (t) => {
  const context = new DescriptionContext()

  const map = new Map([
    ['a', 1],
    ['b', 2],
  ])
  t.is(context.size(map), 2)

  const set = new Set([1, 2, 3, 4])
  t.is(context.size(set), 4)

  // Test with custom sized object
  const customSized = { size: 42 }
  t.is(context.size(customSized), 42)
})

// -----------------------------------------------------------------------------
// Property access and representation tests
// -----------------------------------------------------------------------------

test('namedProperties handles property descriptors correctly', (t) => {
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
  const expectedEnumProp = new NamedPropertyAccessor('enumProp', context.represent('visible'))

  // Some property should compare equal to our expected enumProp accessor
  t.true(props.some((p) => p.compare(expectedEnumProp) === strictlyEqual))

  // None of the properties should compare equal to a nonEnumProp accessor
  const expectedNonEnumProp = new NamedPropertyAccessor('nonEnumProp', context.represent('hidden'))
  t.false(props.some((p) => p.compare(expectedNonEnumProp) === strictlyEqual))

  // Test with include parameter to force inclusion of non-enumerable properties
  const propsWithForced = [...context.namedProperties(obj, 'nonEnumProp')]
  t.true(propsWithForced.some((p) => p.compare(expectedNonEnumProp) === strictlyEqual))
})

test('namedProperties filters out numeric indices for array-like objects', (t) => {
  const context = new DescriptionContext()

  // Create an array-like object with both numeric indices and named properties
  const arrayLike = {
    0: 'zero',
    1: 'one',
    2: 'two',
    extraProp: 'extra',
  }
  Object.defineProperty(arrayLike, 'length', {
    value: 3,
    enumerable: false,
  })

  // Get the named properties
  const props = [...context.namedProperties(arrayLike)]

  // Should only contain 'extraProp', not the numeric indices
  t.is(props.length, 1)

  // Create expected property accessor for 'extraProp'
  const expectedExtraProp = new NamedPropertyAccessor('extraProp', context.represent('extra'))

  // Should include 'extraProp'
  t.true(props.some((p) => p.compare(expectedExtraProp) === strictlyEqual))

  // Create expected property accessors for the numeric indices
  const expectedProp0 = new NamedPropertyAccessor('0', context.represent('zero'))
  const expectedProp1 = new NamedPropertyAccessor('1', context.represent('one'))
  const expectedProp2 = new NamedPropertyAccessor('2', context.represent('two'))

  // Should not include any of the numeric indices
  t.false(props.some((p) => p.compare(expectedProp0) === strictlyEqual))
  t.false(props.some((p) => p.compare(expectedProp1) === strictlyEqual))
  t.false(props.some((p) => p.compare(expectedProp2) === strictlyEqual))

  // Boundary case: a numeric index at exactly the length
  const arrayLikeWithBoundary = {
    0: 'zero',
    1: 'one',
    2: 'boundary', // index 2 = length, should be included
    extraProp: 'extra',
  }
  Object.defineProperty(arrayLikeWithBoundary, 'length', {
    value: 2,
    enumerable: false,
  })

  const boundaryProps = [...context.namedProperties(arrayLikeWithBoundary)]

  // Should contain 'extraProp' and '2' (boundary case)
  t.is(boundaryProps.length, 2)

  // Create expected property accessor for boundary index
  const expectedBoundaryProp = new NamedPropertyAccessor('2', context.represent('boundary'))

  // Should include the boundary index
  t.true(boundaryProps.some((p) => p.compare(expectedBoundaryProp) === strictlyEqual))
})

test('symbolProperties handles objects with symbol properties', (t) => {
  const context = new DescriptionContext()

  // Create an object with symbol properties
  const sym1 = Symbol('test1')
  const sym2 = Symbol('test2')

  const obj = {
    [sym1]: 'value1',
    [sym2]: 'value2',
    regularProp: 'regular',
  }

  // Make one symbol non-enumerable
  Object.defineProperty(obj, sym2, { enumerable: false })

  const symbolProps = [...context.symbolProperties(obj)]

  // Should only include enumerable symbol properties
  t.is(symbolProps.length, 1)

  // Create empty object to test empty symbol properties case
  const emptyObj = {}
  const emptySymbolProps = [...context.symbolProperties(emptyObj)]
  t.is(emptySymbolProps.length, 0)
})

test('nonSparseArrayElements filters out sparse array elements', (t) => {
  const context = new DescriptionContext()

  // Create a sparse array
  const sparseArray = Array(5)
  sparseArray[0] = 'first'
  sparseArray[3] = 'fourth'

  const elements = context.nonSparseArrayElements(sparseArray)

  t.is(elements.length, 2)
  t.deepEqual(elements, [
    [0, 'first'],
    [3, 'fourth'],
  ])

  // Test with non-sparse array
  const denseArray = ['a', 'b', 'c']
  const denseElements = context.nonSparseArrayElements(denseArray)

  t.is(denseElements.length, 3)
  t.deepEqual(denseElements, [
    [0, 'a'],
    [1, 'b'],
    [2, 'c'],
  ])
})

test('representBytes creates correct BytesAccessor for buffer types', (t) => {
  const context = new DescriptionContext()

  // Test with ArrayBuffer
  const buffer = new ArrayBuffer(16)
  const view = new Uint8Array(buffer)
  // Fill buffer with values to test
  for (let i = 0; i < 16; i++) {
    view[i] = i
  }

  const bytesAccessor = context.representBytes(buffer)

  // Create a reference accessor to compare against
  const referenceAccessor = new BytesAccessor(buffer, 0, 16)

  // Use the BytesAccessor's compare method to verify equality
  t.is(bytesAccessor.compare(referenceAccessor), strictlyEqual)

  // Test with typed array view
  const viewSlice = new Uint8Array(buffer, 4, 8)
  const viewBytesAccessor = context.representBytes(viewSlice)

  // Create reference accessor with same parameters
  const referenceViewAccessor = new BytesAccessor(buffer, 4, 8)

  // Compare accessors
  t.is(viewBytesAccessor.compare(referenceViewAccessor), strictlyEqual)

  // Test with DataView
  const dataView = new DataView(buffer, 2, 10)
  const dataViewBytesAccessor = context.representBytes(dataView)

  // Create reference accessor with same parameters
  const referenceDataViewAccessor = new BytesAccessor(buffer, 2, 10)

  // Compare accessors
  t.is(dataViewBytesAccessor.compare(referenceDataViewAccessor), strictlyEqual)
})
