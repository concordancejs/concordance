import test from 'ava'
import * as cbor from 'cbor2'
import type { Encoder } from '../encoder.ts'
import { serialize } from '../serialize.ts'
import {
  finished,
  partial,
  partialRequiringTerminator,
  partialStoreAsByteArray,
  type SerializationResult,
} from '../serialization-result.ts'
import { staticTypeTable, version } from '../serialization-types.ts'
import { ElementAccessor } from '../accessors/element.ts'
import {
  NamedPropertyAccessor,
  NamedPropertyGroup,
  SymbolPropertyAccessor,
  SymbolPropertyGroup,
  type PropertyGroup,
} from '../accessors/property.ts'
import { MapEntryAccessor } from '../accessors/map-entry.ts'
import { IteratorValueAccessor } from '../accessors/iterator-value.ts'
import type { ValueRepresentation } from '../value.ts'
import { RealValueContext } from '../real-value-context.ts'
import { SymbolRepresentation } from '../values/primitives/symbol.ts'

const cborOptions = {
  cde: false,
  dcbor: false,
  rejectBigInts: false,
  rejectDuplicateKeys: false,
  rejectFloats: false,
  rejectUndefined: false,
  sortKeys: null,
  preferMap: true,
}

// Helper to decode a single CBOR value
const decodeCbor = (bytes: Uint8Array): unknown => cbor.decode(bytes, cborOptions)

// Helper to decode multiple CBOR values when needed
function decodeAllCbor(bytes: Uint8Array): unknown[] {
  return Array.from(new cbor.SequenceEvents(bytes, cborOptions), (mtAiValue) => mtAiValue[2] as unknown)
}

// Mock ValueRepresentation for testing
class MockValueRepresentation {
  children: Array<ValueRepresentation | PropertyGroup>
  pointer?: number
  readonly #serializeResult: SerializationResult
  readonly #serializeImpl?: (encoder: Encoder) => SerializationResult

  constructor(
    options: {
      pointer?: number
      serializeResult?: SerializationResult
      serializeImpl?: (encoder: Encoder) => SerializationResult
      children?: Array<ValueRepresentation | PropertyGroup>
    } = {},
  ) {
    this.pointer = options.pointer
    this.#serializeResult = options.serializeResult ?? finished
    this.#serializeImpl = options.serializeImpl
    this.children = options.children ?? []
  }

  serialize(encoder: Encoder): SerializationResult {
    return this.#serializeImpl?.(encoder) ?? this.#serializeResult
  }

  compare(): never {
    throw new Error('Not implemented for serialization tests')
  }

  finalFormat(): never {
    throw new Error('Not implemented for serialization tests')
  }

  *[Symbol.iterator]() {
    yield* this.children
  }
}

// -----------------------------------------------------------------------------
// serialize function tests
// -----------------------------------------------------------------------------

test('serialize writes the correct version number', (t) => {
  const mockValue = new MockValueRepresentation()

  const serialized = serialize(mockValue)
  // First byte should be the version
  const values = decodeAllCbor(serialized)
  t.is(values[0], version)
})

test('serialize handles simple finished values', (t) => {
  const mockImpl = (encoder: Encoder): SerializationResult => {
    encoder.string('test value')
    return finished
  }

  const mockValue = new MockValueRepresentation({ serializeImpl: mockImpl })
  const serialized = serialize(mockValue)

  const values = decodeAllCbor(serialized)
  t.is(values.length, 2) // Version + test value
  t.is(values[0], version)
  t.is(values[1], 'test value')
})

test('serialize handles partial serialization results', (t) => {
  // Create a mock that returns partial on first call, then has a child that returns finished
  const childMock = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.string('child value')
      return finished
    },
  })

  const parentMock = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.staticType(staticTypeTable.array)
      return partial
    },
    children: [childMock],
  })

  const serialized = serialize(parentMock)
  const values = decodeAllCbor(serialized)

  t.is(values.length, 3) // Version + array type + child value
  t.is(values[0], version)
  t.is(values[1], staticTypeTable.array)
  t.is(values[2], 'child value')
})

test('serialize handles partialRequiringTerminator serialization results', (t) => {
  // Create a mock that needs a terminator
  const childMock = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.string('child value')
      return finished
    },
  })

  const parentMock = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.staticType(staticTypeTable.object)
      return partialRequiringTerminator
    },
    children: [childMock],
  })

  const serialized = serialize(parentMock)
  const values = decodeAllCbor(serialized)

  // Should have version + object type + child value + terminator
  t.is(values.length, 4)
  t.is(values[0], version)
  t.is(values[1], staticTypeTable.object)
  t.is(values[2], 'child value')
  t.is(values[3], staticTypeTable.terminator)
})

test('serialize handles circular references', (t) => {
  // Create an object with a circular reference
  const circularMock = new MockValueRepresentation({
    pointer: 1,
    serializeImpl(encoder) {
      encoder.staticType(staticTypeTable.object)
      return partial
    },
  })

  // Create a circular reference
  circularMock.children = [circularMock]

  const serialized = serialize(circularMock)
  const values = decodeAllCbor(serialized)

  // Should have version + object type + pointer type + pointer value
  t.is(values.length, 4)
  t.is(values[0], version)
  t.is(values[1], staticTypeTable.object)
  t.is(values[2], staticTypeTable.pointer)
  t.is(values[3], 1) // The pointer value
})

test('serialize handles ElementAccessor objects', (t) => {
  // Create a mock array-like representation that yields ElementAccessors
  const elementValue = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.string('array item')
      return finished
    },
  })

  const arrayMock = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.staticType(staticTypeTable.array)
      return partial
    },
    children: [new ElementAccessor(0, elementValue), new ElementAccessor(1, elementValue)],
  })

  const serialized = serialize(arrayMock)
  const values = decodeAllCbor(serialized)

  // Check for presence of the element aspect type
  const hasElementAspect = values.includes(staticTypeTable.elementAspect)
  t.true(hasElementAspect, 'Should contain element aspect type')

  // Check that our values made it into the output
  const containsString = values.includes('array item')
  t.true(containsString, 'Should contain array item string')
})

test('serialize handles NamedPropertyGroup objects', (t) => {
  // Create a mock object representation that yields NamedPropertyGroups
  const propertyValue = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.number(42)
      return finished
    },
  })

  // Create a context for the property group
  const context = new RealValueContext()

  // Create a named property accessor group
  const namedProperties = [
    new NamedPropertyAccessor('prop1', propertyValue),
    new NamedPropertyAccessor('prop2', propertyValue),
  ]
  const propertyGroup = new NamedPropertyGroup(context, namedProperties)

  const objectMock = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.staticType(staticTypeTable.object)
      return partial
    },
    children: [propertyGroup],
  })

  const serialized = serialize(objectMock)
  const values = decodeAllCbor(serialized)

  // Check for presence of the named property aspect type
  const hasPropertyAspect = values.includes(staticTypeTable.namedPropertyAspect)
  t.true(hasPropertyAspect, 'Should contain named property aspect type')

  // Check that our property names and values made it into the output
  const containsProp1 = values.includes('prop1')
  const containsProp2 = values.includes('prop2')
  const containsNumber = values.includes(42)
  t.true(containsProp1, 'Should contain property name "prop1"')
  t.true(containsProp2, 'Should contain property name "prop2"')
  t.true(containsNumber, 'Should contain property value 42')
})

test('serialize handles SymbolPropertyGroup objects', (t) => {
  // Create a mock object representation that yields SymbolPropertyGroups
  const propertyValue = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.string('symbol value')
      return finished
    },
  })

  // Create a context
  const context = new RealValueContext()

  // Create symbol representations
  const symbol1Rep = new SymbolRepresentation(context, Symbol('testSymbol1') as unknown as Record<string, unknown>)
  const symbol2Rep = new SymbolRepresentation(context, Symbol('testSymbol2') as unknown as Record<string, unknown>)

  // Create symbol property accessors
  const symbolAccessors = [
    new SymbolPropertyAccessor(context, symbol1Rep, propertyValue),
    new SymbolPropertyAccessor(context, symbol2Rep, propertyValue),
  ]

  // Create a symbol property group
  const symbolPropertyGroup = new SymbolPropertyGroup(symbolAccessors)

  // Create object with the symbol property group
  const objectMock = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.staticType(staticTypeTable.object)
      return partial
    },
    children: [symbolPropertyGroup],
  })

  const serialized = serialize(objectMock)
  const values = decodeAllCbor(serialized)

  // Check for presence of the symbol property aspect type
  const hasSymbolPropertyAspect = values.includes(staticTypeTable.symbolPropertyAspect)
  t.true(hasSymbolPropertyAspect, 'Should contain symbol property aspect type')

  // Check that our symbol key and value made it into the output
  const containsSymbolKey1 = values.includes('Symbol(testSymbol1)')
  const containsSymbolKey2 = values.includes('Symbol(testSymbol2)')
  const containsValue = values.some((v) => {
    if (v instanceof Uint8Array) {
      const decoded = decodeCbor(v)
      return decoded === 'symbol value'
    }

    return false
  })
  t.true(containsSymbolKey1, 'Should contain symbol key 1')
  t.true(containsSymbolKey2, 'Should contain symbol key 2')
  t.true(containsValue, 'Should contain symbol property value')
})

test('serialize handles IteratorValueAccessor objects', (t) => {
  // Create a mock iterable representation that yields IteratorValueAccessors
  const iteratorValue = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.string('iterator item')
      return finished
    },
  })

  const iterableMock = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.staticType(staticTypeTable.object) // Or some iterable type
      return partial
    },
    children: [new IteratorValueAccessor(0, iteratorValue), new IteratorValueAccessor(1, iteratorValue)],
  })

  const serialized = serialize(iterableMock)
  const values = decodeAllCbor(serialized)

  // Check for presence of the iterator value aspect type
  const hasIteratorValueAspect = values.includes(staticTypeTable.iteratorValueAspect)
  t.true(hasIteratorValueAspect, 'Should contain iterator value aspect type')

  // Check that our values made it into the output
  const containsString = values.includes('iterator item')
  t.true(containsString, 'Should contain iterator item string')
})

test('serialize handles MapEntryAccessor objects', (t) => {
  // Create a context for the accessors
  const context = new RealValueContext()

  // Create key and value representations
  const keyValue = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.string('map key')
      return finished
    },
  })

  const valueValue = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.string('map value')
      return finished
    },
  })

  // Create a mock map representation that yields MapEntryAccessors
  const mapMock = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.staticType(staticTypeTable.map)
      return partial
    },
    children: [new MapEntryAccessor(context, keyValue, valueValue)],
  })

  const serialized = serialize(mapMock)
  const values = decodeAllCbor(serialized)

  // Check for presence of the map entry aspect type
  const hasMapEntryAspect = values.includes(staticTypeTable.mapEntryAspect)
  t.true(hasMapEntryAspect, 'Should contain map entry aspect type')

  // Check that our key and value made it into the output
  const containsKey = values.includes('map key')
  const containsValue = values.includes('map value')
  t.true(containsKey, 'Should contain map key string')
  t.true(containsValue, 'Should contain map value string')
})

test('serialize handles partialStoreAsByteArray serialization results', (t) => {
  // Create a value that uses partialStoreAsByteArray
  const childMock = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.string('123')
      return finished
    },
  })

  const parentMock = new MockValueRepresentation({
    serializeImpl(encoder) {
      encoder.staticType(staticTypeTable.string)
      return partialStoreAsByteArray
    },
    children: [childMock],
  })

  const serialized = serialize(parentMock)
  const values = decodeAllCbor(serialized)

  // Should have version + arrayBuffer type + byte array
  t.is(values.length, 3)
  t.is(values[0], version)
  t.is(values[1], staticTypeTable.string)

  // The third value should be a Uint8Array
  const byteArray = values[2] as Uint8Array
  t.true(byteArray instanceof Uint8Array)
  t.is(cbor.decode(byteArray), '123')
})
