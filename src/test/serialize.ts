import test from 'ava'
import { decode } from 'cbor2'
import { Sequence } from 'cbor2/decoder'
import { Encoder, serialize } from '../serialize.ts'
import { finished, partial, partialRequiringTerminator, partialStoreAsByteArray } from '../serialization-result.ts'
import { staticTypeTable, version } from '../serialization-types.ts'
import { ElementAccessor } from '../accessors/element.ts'
import {
  NamedPropertyAccessor,
  NamedPropertyGroup,
  SymbolPropertyAccessor,
  SymbolPropertyGroup,
} from '../accessors/property.ts'
import { MapEntryAccessor } from '../accessors/map-entry.ts'
import { IteratorValueAccessor } from '../accessors/iterator-value.ts'
import { BytesAccessor } from '../accessors/bytes.ts'
import type { SerializationResult } from '../serialization-result.ts'
import type { ValueRepresentation } from '../value.ts'
import { DescriptionContext } from '../description-context.ts'
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
const decodeCbor = (bytes: Uint8Array): unknown => decode(bytes, cborOptions)

// Helper to decode multiple CBOR values when needed
function decodeAllCbor(bytes: Uint8Array): unknown[] {
  return Array.from(new Sequence(bytes, cborOptions), (tuple) => tuple[2] as unknown)
}

// Mock ValueRepresentation for testing
class MockValueRepresentation implements ValueRepresentation {
  pointer?: number
  #serializeResult: SerializationResult
  #serializeImpl?: (encoder: Encoder) => SerializationResult
  children: ValueRepresentation[]

  constructor(
    options: {
      pointer?: number
      serializeResult?: SerializationResult
      serializeImpl?: (encoder: Encoder) => SerializationResult
      children?: ValueRepresentation[]
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

  *[Symbol.iterator]() {
    yield* this.children
  }
}

// -----------------------------------------------------------------------------
// Encoder class tests with CBOR verification
// -----------------------------------------------------------------------------

test('Encoder - bytes returns the serialized data', (t) => {
  const encoder = new Encoder()
  encoder.int(42)

  const bytes = encoder.bytes
  t.true(bytes instanceof Uint8Array)
  t.true(bytes.length > 0)
})

test('Encoder - staticType writes a static type', (t) => {
  const encoder = new Encoder()
  encoder.staticType(staticTypeTable.string)

  const bytes = encoder.bytes
  // Use decode instead of decodeAllCbor for single value
  const decoded = decodeCbor(bytes)
  t.is(decoded, staticTypeTable.string)
})

test('Encoder - int writes an integer', (t) => {
  const encoder = new Encoder()
  encoder.int(42)

  const bytes = encoder.bytes
  const decoded = decodeCbor(bytes)
  t.is(decoded, 42)
})

test('Encoder - bigInt writes bigints correctly', (t) => {
  // Test small bigint (which is represented as a regular integer)
  const encoder1 = new Encoder()
  const smallBigIntValue = BigInt(42)
  encoder1.bigInt(smallBigIntValue)

  const bytes1 = encoder1.bytes
  const decoded1 = decodeCbor(bytes1)

  // Should come back as a number
  t.is(decoded1, Number(smallBigIntValue))

  // Test large bigint (beyond max safe integer)
  const encoder2 = new Encoder()
  const largeBigIntValue = BigInt(Number.MAX_SAFE_INTEGER) + 1n
  encoder2.bigInt(largeBigIntValue)

  const bytes2 = encoder2.bytes
  const decoded2 = decodeCbor(bytes2)

  t.is(decoded2, largeBigIntValue)
})

test('Encoder - boolean writes a boolean', (t) => {
  const encoder1 = new Encoder()
  encoder1.boolean(true)

  const bytes1 = encoder1.bytes
  const decoded1 = decodeCbor(bytes1)
  t.is(decoded1, true)

  const encoder2 = new Encoder()
  encoder2.boolean(false)
  const bytes2 = encoder2.bytes
  const decoded2 = decodeCbor(bytes2)
  t.is(decoded2, false)
})

test('Encoder - number writes integers as ints and non-integers as floats', (t) => {
  // Test integer
  const encoder1 = new Encoder()
  encoder1.number(42)

  const bytes1 = encoder1.bytes
  const decoded1 = decodeCbor(bytes1)
  t.is(decoded1, 42)

  // Test float
  const encoder2 = new Encoder()
  encoder2.number(3.14)

  const bytes2 = encoder2.bytes
  const decoded2 = decodeCbor(bytes2)
  t.is(decoded2, 3.14)

  // Test negative zero
  const encoder3 = new Encoder()
  encoder3.number(-0)

  const bytes3 = encoder3.bytes
  const decoded3 = decodeCbor(bytes3)
  t.true(Object.is(decoded3, -0))
})

test('Encoder - string writes a string', (t) => {
  const encoder = new Encoder()
  encoder.string('hello')

  const bytes = encoder.bytes
  const decoded = decodeCbor(bytes)
  t.is(decoded, 'hello')
})

test('Encoder - uint8Array writes a byte array', (t) => {
  const encoder = new Encoder()
  const arr = new Uint8Array([1, 2, 3])
  encoder.uint8Array(arr)

  const bytes = encoder.bytes
  const decoded = decodeCbor(bytes) as Uint8Array

  t.true(decoded instanceof Uint8Array)
  t.deepEqual([...decoded], [1, 2, 3])
})

test('Encoder - annotations writes a map of annotations', (t) => {
  const encoder = new Encoder()
  encoder.annotations({
    name: 'test',
    value: 42,
    flag: true,
    // Test undefined values are filtered out
    optional: undefined,
  })

  const bytes = encoder.bytes
  const decoded = decodeCbor(bytes) as Map<string, unknown>

  // cbor2 decodes maps as Map objects
  t.true(decoded instanceof Map)
  t.is(decoded.get('name'), 'test')
  t.is(decoded.get('value'), 42)
  t.is(decoded.get('flag'), true)
  t.false(decoded.has('optional'))
})

test('Encoder - annotations handles BytesAccessor objects', (t) => {
  const encoder = new Encoder()
  const buffer = new ArrayBuffer(3)
  const view = new Uint8Array(buffer)
  view.set([1, 2, 3])

  // Create a real BytesAccessor
  const bytesAccessor = new BytesAccessor(buffer, 0, 3)

  encoder.annotations({
    bytes: bytesAccessor,
    name: 'test',
  })

  const bytes = encoder.bytes
  const decoded = decodeCbor(bytes) as Map<string, unknown>

  t.true(decoded instanceof Map)
  const decodedBytes = decoded.get('bytes') as Uint8Array
  t.true(decodedBytes instanceof Uint8Array)
  t.deepEqual([...decodedBytes], [1, 2, 3])
  t.is(decoded.get('name'), 'test')
})

test('Encoder - terminator writes a terminator', (t) => {
  const encoder = new Encoder()
  encoder.terminator()

  const bytes = encoder.bytes
  const decoded = decodeCbor(bytes)
  t.is(decoded, staticTypeTable.terminator)
})

test('Encoder - methods can be chained with correct CBOR encoding', (t) => {
  const encoder = new Encoder()
  encoder.int(1).string('test').boolean(true)

  const bytes = encoder.bytes
  const values = decodeAllCbor(bytes)

  t.is(values.length, 3)
  t.is(values[0], 1)
  t.is(values[1], 'test')
  t.is(values[2], true)
})

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
    serializeImpl: (encoder) => {
      encoder.string('child value')
      return finished
    },
  })

  const parentMock = new MockValueRepresentation({
    serializeImpl: (encoder) => {
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
    serializeImpl: (encoder) => {
      encoder.string('child value')
      return finished
    },
  })

  const parentMock = new MockValueRepresentation({
    serializeImpl: (encoder) => {
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
    serializeImpl: (encoder) => {
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
    serializeImpl: (encoder) => {
      encoder.string('array item')
      return finished
    },
  })

  const arrayMock = new MockValueRepresentation({
    serializeImpl: (encoder) => {
      encoder.staticType(staticTypeTable.array)
      return partial
    },
    children: [new ElementAccessor(0, elementValue), new ElementAccessor(1, elementValue)],
  })

  const serialized = serialize(arrayMock)
  const values = decodeAllCbor(serialized)

  // Check for presence of the element aspect type
  const hasElementAspect = values.some((v) => v === staticTypeTable.elementAspect)
  t.true(hasElementAspect, 'Should contain element aspect type')

  // Check that our values made it into the output
  const containsString = values.some((v) => v === 'array item')
  t.true(containsString, 'Should contain array item string')
})

test('serialize handles NamedPropertyGroup objects', (t) => {
  // Create a mock object representation that yields NamedPropertyGroups
  const propertyValue = new MockValueRepresentation({
    serializeImpl: (encoder) => {
      encoder.number(42)
      return finished
    },
  })

  // Create a context for the property group
  const context = new DescriptionContext()

  // Create a named property accessor group
  const namedProperties = [
    new NamedPropertyAccessor('prop1', propertyValue),
    new NamedPropertyAccessor('prop2', propertyValue),
  ]
  const propertyGroup = new NamedPropertyGroup(context, namedProperties)

  const objectMock = new MockValueRepresentation({
    serializeImpl: (encoder) => {
      encoder.staticType(staticTypeTable.object)
      return partial
    },
    children: [propertyGroup],
  })

  const serialized = serialize(objectMock)
  const values = decodeAllCbor(serialized)

  // Check for presence of the named property aspect type
  const hasPropertyAspect = values.some((v) => v === staticTypeTable.namedPropertyAspect)
  t.true(hasPropertyAspect, 'Should contain named property aspect type')

  // Check that our property names and values made it into the output
  const containsProp1 = values.some((v) => v === 'prop1')
  const containsProp2 = values.some((v) => v === 'prop2')
  const containsNumber = values.some((v) => v === 42)
  t.true(containsProp1, 'Should contain property name "prop1"')
  t.true(containsProp2, 'Should contain property name "prop2"')
  t.true(containsNumber, 'Should contain property value 42')
})

test('serialize handles SymbolPropertyGroup objects', (t) => {
  // Create a mock object representation that yields SymbolPropertyGroups
  const propertyValue = new MockValueRepresentation({
    serializeImpl: (encoder) => {
      encoder.string('symbol value')
      return finished
    },
  })

  // Create a context
  const context = new DescriptionContext()

  // Create symbol representations
  const symbol1Rep = new SymbolRepresentation(context, Symbol('testSymbol1') as unknown as object)
  const symbol2Rep = new SymbolRepresentation(context, Symbol('testSymbol2') as unknown as object)

  // Create symbol property accessors
  const symbolAccessors = [
    new SymbolPropertyAccessor(context, symbol1Rep, propertyValue),
    new SymbolPropertyAccessor(context, symbol2Rep, propertyValue),
  ]

  // Create a symbol property group
  const symbolPropertyGroup = new SymbolPropertyGroup(symbolAccessors)

  // Create object with the symbol property group
  const objectMock = new MockValueRepresentation({
    serializeImpl: (encoder) => {
      encoder.staticType(staticTypeTable.object)
      return partial
    },
    children: [symbolPropertyGroup],
  })

  const serialized = serialize(objectMock)
  const values = decodeAllCbor(serialized)

  // Check for presence of the symbol property aspect type
  const hasSymbolPropertyAspect = values.some((v) => v === staticTypeTable.symbolPropertyAspect)
  t.true(hasSymbolPropertyAspect, 'Should contain symbol property aspect type')

  // Check that our symbol key and value made it into the output
  const containsSymbolKey1 = values.some((v) => v === 'Symbol(testSymbol1)')
  const containsSymbolKey2 = values.some((v) => v === 'Symbol(testSymbol2)')
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
    serializeImpl: (encoder) => {
      encoder.string('iterator item')
      return finished
    },
  })

  const iterableMock = new MockValueRepresentation({
    serializeImpl: (encoder) => {
      encoder.staticType(staticTypeTable.object) // Or some iterable type
      return partial
    },
    children: [new IteratorValueAccessor(0, iteratorValue), new IteratorValueAccessor(1, iteratorValue)],
  })

  const serialized = serialize(iterableMock)
  const values = decodeAllCbor(serialized)

  // Check for presence of the iterator value aspect type
  const hasIteratorValueAspect = values.some((v) => v === staticTypeTable.iteratorValueAspect)
  t.true(hasIteratorValueAspect, 'Should contain iterator value aspect type')

  // Check that our values made it into the output
  const containsString = values.some((v) => v === 'iterator item')
  t.true(containsString, 'Should contain iterator item string')
})

test('serialize handles MapEntryAccessor objects', (t) => {
  // Create a context for the accessors
  const context = new DescriptionContext()

  // Create key and value representations
  const keyValue = new MockValueRepresentation({
    serializeImpl: (encoder) => {
      encoder.string('map key')
      return finished
    },
  })

  const valueValue = new MockValueRepresentation({
    serializeImpl: (encoder) => {
      encoder.string('map value')
      return finished
    },
  })

  // Create a mock map representation that yields MapEntryAccessors
  const mapMock = new MockValueRepresentation({
    serializeImpl: (encoder) => {
      encoder.staticType(staticTypeTable.map)
      return partial
    },
    children: [new MapEntryAccessor(context, keyValue, valueValue)],
  })

  const serialized = serialize(mapMock)
  const values = decodeAllCbor(serialized)

  // Check for presence of the map entry aspect type
  const hasMapEntryAspect = values.some((v) => v === staticTypeTable.mapEntryAspect)
  t.true(hasMapEntryAspect, 'Should contain map entry aspect type')

  // Check that our key and value made it into the output
  const containsKey = values.some((v) => v === 'map key')
  const containsValue = values.some((v) => v === 'map value')
  t.true(containsKey, 'Should contain map key string')
  t.true(containsValue, 'Should contain map value string')
})

test('serialize handles partialStoreAsByteArray serialization results', (t) => {
  // Create a value that uses partialStoreAsByteArray
  const childMock = new MockValueRepresentation({
    serializeImpl: (encoder) => {
      encoder.string('123')
      return finished
    },
  })

  const parentMock = new MockValueRepresentation({
    serializeImpl: (encoder) => {
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
  t.is(decode(byteArray), '123')
})
