import test from 'ava'
import { RealValueContext } from '../../../real-value-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { ObjectRepresentation, type ObjectAnnotations } from '../object.ts'
import { strictlyEqual, comparable, unequal } from '../../../comparison.ts'
import { NullRepresentation } from '../../primitives/null.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { BytesAccessor } from '../../../accessors/bytes.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'
import type { Opaque } from '../../../value.d.ts'
import { NamedPropertyAccessor, SymbolPropertyAccessor } from '../../../accessors/property.ts'

// Static method tests
test('static is method correctly identifies ObjectRepresentation instances', (t) => {
  const context = new RealValueContext()
  const object = { a: 1 }
  const rep = context.represent(object) as ObjectRepresentation

  t.true(ObjectRepresentation.is(rep))
  t.false(ObjectRepresentation.is({}))
})

test('static isPlain method correctly identifies ObjectRepresentation instances of plain objects', (t) => {
  const context = new RealValueContext()
  const object = { a: 1 }
  const rep = context.represent(object) as ObjectRepresentation

  t.true(ObjectRepresentation.isPlain(rep))
  t.false(ObjectRepresentation.isPlain(context.represent([])))
  class CustomClass {
    a = 1
  }
  t.false(ObjectRepresentation.isPlain(context.represent(new CustomClass())))
})

test('unpackAnnotations correctly unpacks object annotations', (t) => {
  const annotations = {
    a: true,
    c: 'TestClass',
    l: 5,
    n: true,
    p: 123,
    t: 'CustomTag',
  } satisfies ObjectAnnotations

  const unpacked = ObjectRepresentation.unpackAnnotations(annotations)

  t.is(unpacked.isArrayLike, true)
  t.is(unpacked.constructorName, 'TestClass')
  t.is(unpacked.length, 5)
  t.is(unpacked.isNullProto, true)
  t.is(unpacked.isObjectProto, false)
  t.is(unpacked.pointer, 123)
  t.is(unpacked.stringTag, 'CustomTag')
})

test('unpackAnnotations provides defaults for missing values', (t) => {
  const annotations = {
    p: 42, // Only required field
  }

  const unpacked = ObjectRepresentation.unpackAnnotations(annotations)

  t.false(unpacked.isArrayLike)
  t.is(unpacked.constructorName, undefined)
  t.is(unpacked.length, undefined)
  t.false(unpacked.isNullProto)
  t.false(unpacked.isObjectProto)
  t.is(unpacked.pointer, 42)
  t.is(unpacked.stringTag, undefined)
})

// Compare method tests
test('compare returns strictlyEqual for same object instance', (t) => {
  const object = {}
  const context = new RealValueContext()
  const a = context.represent(object) as ObjectRepresentation
  const b = context.represent(object) as ObjectRepresentation

  t.is(a.compare(b, 'comprehensive'), strictlyEqual)
})

test('compare returns unequal for non-ObjectRepresentation values', (t) => {
  const context = new RealValueContext()
  const a = context.represent({}) as ObjectRepresentation

  t.is(a.compare(new NullRepresentation(), 'comprehensive'), unequal)
})

test('compare returns unequal by default when one object has a null prototype and the other does not', (t) => {
  const context = new RealValueContext()
  const nullProtoObject = Object.create(null) as Record<string, never>
  const regularObject = {}

  const a = context.represent(nullProtoObject) as ObjectRepresentation
  const b = context.represent(regularObject) as ObjectRepresentation

  t.is(a.compare(b, 'comprehensive'), unequal)
  t.is(b.compare(a, 'comprehensive'), unequal)
})

test('compare returns comparable when compareNullProtoToObjectProto flag is true', (t) => {
  const context = new RealValueContext({ flags: { compareNullProtoToObjectProto: true } })
  const nullProtoObject = Object.create(null) as Record<string, never>
  const regularObject = {}

  const a = context.represent(nullProtoObject) as ObjectRepresentation
  const b = context.represent(regularObject) as ObjectRepresentation

  t.is(a.compare(b, 'comprehensive'), comparable)
  t.is(b.compare(a, 'comprehensive'), comparable)
})

test('compare returns unequal for objects with different string tags', (t) => {
  const context = new RealValueContext()

  // Create an object with custom toString tag
  const object1 = {}
  Object.defineProperty(object1, Symbol.toStringTag, {
    value: 'CustomTag',
    enumerable: false, // Explicitly set to non-enumerable to match real-world usage
  })
  const object2 = {}

  const a = context.represent(object1) as ObjectRepresentation
  const b = context.represent(object2) as ObjectRepresentation

  t.is(a.compare(b, 'comprehensive'), unequal)
})

test('compare returns unequal for objects with different constructor names', (t) => {
  const context = new RealValueContext()

  class Custom1 {
    foo = 'bar'
  }
  class Custom2 {
    foo = 'baz'
  }

  const a = context.represent(new Custom1()) as ObjectRepresentation
  const b = context.represent(new Custom2()) as ObjectRepresentation

  t.is(a.compare(b, 'comprehensive'), unequal)
})

test('compare returns unequal when comparing objects with empty string vs undefined constructor names', (t) => {
  const context = new RealValueContext()

  // Create an object with empty string constructor name
  const EmptyNameClass = new Function('return function() {}')() // eslint-disable-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, no-new-func
  const objectWithEmptyConstructorName = new EmptyNameClass() // eslint-disable-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call

  // Create an object with undefined constructor name
  const objectWithUndefinedConstructorName = Object.create(null) as Record<'constructor', undefined>
  objectWithUndefinedConstructorName.constructor = undefined

  const a = context.represent(objectWithEmptyConstructorName) as ObjectRepresentation
  const b = context.represent(objectWithUndefinedConstructorName) as ObjectRepresentation

  // They should be treated as unequal since empty string and undefined are different
  t.is(a.compare(b, 'comprehensive'), unequal)
})

test('compare returns comparable for plain object vs custom class instance in fuzzy mode', (t) => {
  class CustomClass {
    foo = 1
    bar = 2
  }
  const plain = { foo: 1, bar: 2 }
  const context = new RealValueContext()
  const a = context.represent(plain) as ObjectRepresentation
  const b = context.represent(new CustomClass()) as ObjectRepresentation
  t.is(a.compare(b, 'fuzzy'), comparable)
  t.is(b.compare(a, 'fuzzy'), comparable)
  t.is(a.compare(b, 'comprehensive'), unequal)
  t.is(b.compare(a, 'comprehensive'), unequal)
})

// Array-like objects tests
test('iterateArrayLike yields elements for array-like objects', (t) => {
  const arrayLike = {
    0: 'first', // eslint-disable-line @typescript-eslint/naming-convention
    1: 'second', // eslint-disable-line @typescript-eslint/naming-convention
    length: 2,
  }
  const context = new RealValueContext()
  const representation = context.represent(arrayLike) as ObjectRepresentation

  const elements = [...representation.iterateArrayLike()]

  t.is(elements.length, 2)
})

test('iterateArrayLike yields no elements for non-array-like objects', (t) => {
  const object = {}
  const context = new RealValueContext()
  const representation = context.represent(object) as ObjectRepresentation

  const elements = [...representation.iterateArrayLike()]

  t.is(elements.length, 0)
})

// Property iteration tests
test('iterateProperties yields properties', (t) => {
  const object = {
    foo: 'bar',
    [Symbol('')]: 'thud',
  }

  const context = new RealValueContext()
  const representation = context.represent(object) as ObjectRepresentation

  const properties = [...representation.iterateProperties()]

  t.is(properties.length, 2)
  t.true(NamedPropertyAccessor.is(properties[0]!))
  t.true(SymbolPropertyAccessor.is(properties[1]!))
})

test('iterateProperties ignores non-enumerable properties', (t) => {
  const object = {
    baz: 42,
    qux: true,
  }
  Object.defineProperty(object, 'foo', {
    value: 'bar',
    enumerable: false,
  })

  const context = new RealValueContext()
  const representation = context.represent(object) as ObjectRepresentation

  const properties = [...representation.iterateProperties()]
  t.is(properties.length, 2)
})

test('iterateProperties accepts specific property names to include', (t) => {
  const object = {
    baz: 42,
    qux: true,
  }
  Object.defineProperty(object, 'foo', {
    value: 'bar',
    enumerable: false,
  })

  const context = new RealValueContext()
  const representation = context.represent(object) as ObjectRepresentation

  // Include specific property
  const properties = [...representation.iterateProperties({ include: ['foo'] })]
  t.is(properties.length, 3)
})

test('iterateProperties yields no properties when all are excluded', (t) => {
  const object = { only: 123 }
  const context = new RealValueContext()
  const representation = context.represent(object) as ObjectRepresentation

  const properties = [...representation.iterateProperties({ exclude: ['only'] })]
  t.is(properties.length, 0)
})

// Iterable tests
test('iterateIterable yields no entries for non-iterable objects', (t) => {
  const object = {}
  const context = new RealValueContext()
  const representation = context.represent(object) as ObjectRepresentation

  const iterables = [...representation.iterateIterable()]

  t.is(iterables.length, 0)
})

test('iterateIterable yields no entries for array-like objects even with Symbol.iterator', (t) => {
  // Create an array-like object that also has Symbol.iterator
  const arrayLikeWithIterator = {
    0: 'first', // eslint-disable-line @typescript-eslint/naming-convention
    1: 'second', // eslint-disable-line @typescript-eslint/naming-convention
    length: 2,
    *[Symbol.iterator]() {
      yield 'a'
      yield 'b'
      yield 'c'
    },
  }

  const context = new RealValueContext()
  const representation = context.represent(arrayLikeWithIterator) as ObjectRepresentation

  // Should yield no values for array-like objects, ignoring the iterator
  const iterables = [...representation.iterateIterable()]
  t.is(iterables.length, 0)

  // Confirm it's recognized as array-like
  const arrayLikeElements = [...representation.iterateArrayLike()]
  t.is(arrayLikeElements.length, 2)
})

test('iterateIterable yields values for objects with Symbol.iterator', (t) => {
  const iterableObject = {
    *[Symbol.iterator]() {
      yield 'a'
      yield 'b'
    },
  }

  const context = new RealValueContext()
  const representation = context.represent(iterableObject) as ObjectRepresentation

  const iterables = [...representation.iterateIterable()]

  t.is(iterables.length, 2)
})

// Symbol.iterator tests
test('Symbol.iterator yields array-like elements and property groups for array-like objects', (t) => {
  const context = new RealValueContext()
  const object = {
    0: 'a', // eslint-disable-line @typescript-eslint/naming-convention
    1: 'b', // eslint-disable-line @typescript-eslint/naming-convention
    length: 2,
    foo: 'bar',
    [Symbol('')]: 'Test',
  }
  const rep = context.represent(object) as ObjectRepresentation

  const allItems = [...rep]

  // Should include array-like elements and properties groups
  t.is(allItems.length, 5) // At least array elements (2) + named properties (2) + symbol properties (1)
})

test('Symbol.iterator yields iterator values and property groups for iterable non-array-like objects', (t) => {
  const context = new RealValueContext()
  const object = {
    foo: 'bar',
    [Symbol('')]: 'Test',
    // Iterable but not array-like
    *[Symbol.iterator]() {
      yield 'a'
      yield 'b'
      yield 'c'
    },
  }
  const rep = context.represent(object) as ObjectRepresentation

  const allItems = [...rep]

  // Should include iterator values and property groups
  t.is(allItems.length, 6) // Three iterator values, one named property group, 2 symbol properties
})

// Serialization tests
test('serialize includes annotations', (t) => {
  {
    // Create object representation
    class CustomClass {
      length = 2
      0 = 'a' // eslint-disable-line @typescript-eslint/naming-convention
      1 = 'b'; // eslint-disable-line @typescript-eslint/naming-convention
      [Symbol.toStringTag] = 'CustomTag'
    }
    const context = new RealValueContext()
    const custom = context.represent(new CustomClass()) as ObjectRepresentation
    const encoder = new Encoder()
    custom.serialize(encoder)
    snapshotEncoded(t, encoder, 'object start & annotations')

    // Ensure the correct static type was used
    const decoder = new Decoder(encoder.bytes)
    t.is(decoder.staticType(), staticTypeTable.object)
  }

  {
    const object = Object.create(null) as Record<string, never>
    const context = new RealValueContext()
    const representation = context.represent(object) as ObjectRepresentation
    const encoder = new Encoder()
    representation.serialize(encoder)
    snapshotEncoded(t, encoder, 'null proto object start & annotations')
  }

  {
    const object = { length: 2, 0: 'a', 1: 'b' } // eslint-disable-line @typescript-eslint/naming-convention
    const context = new RealValueContext()
    const representation = context.represent(object) as ObjectRepresentation
    const encoder = new Encoder()
    const bytes = new TextEncoder().encode('👋')
    representation.serialize(encoder, staticTypeTable.object, {
      b: new BytesAccessor(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    })
    snapshotEncoded(t, encoder, 'object start & annotations with bytes and length property')
  }
})

test('compare returns comparable for deserialized objects with same structure', (t) => {
  // Create object representation
  class CustomClass {
    length = 2;
    [Symbol.toStringTag] = 'CustomTag'
  }
  const object = new CustomClass()
  const context = new RealValueContext()
  const representation = context.represent(object) as ObjectRepresentation

  const encoder = new Encoder()
  representation.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType()
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ObjectRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original but not strictly equal
  t.is(representation.compare(deserialized, 'comprehensive'), comparable)
})

// FinalFormat tests
test('finalFormat prefixes & appends correctly for basic object', (t) => {
  const context = new RealValueContext()
  const object = {}
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with stringTag', (t) => {
  const context = new RealValueContext()
  const object = {}
  Object.defineProperty(object, Symbol.toStringTag, {
    value: 'CustomTag',
    enumerable: false,
  })
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with constructor name', (t) => {
  const context = new RealValueContext()
  class TestClass {
    foo = 'bar'
  }
  const object = new TestClass()
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for null prototype object', (t) => {
  const context = new RealValueContext()
  const object = Object.create(null) as Record<string, never>
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly when max depth reached', (t) => {
  const context = new RealValueContext()
  const object = {}
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme(), 10, 5) // Depth > maxDepth
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly when max depth reached and formatter is not empty', (t) => {
  const context = new RealValueContext()
  const object = {}
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme(), 10, 5) // Depth > maxDepth
  // Add some content to make the formatter non-empty
  formatter.append('test content')
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with undefined constructor name but defined string tag', (t) => {
  const context = new RealValueContext()
  // Create an object with no constructor name but with a string tag
  const object = {}
  // Delete constructor property to simulate undefined constructor name
  Object.defineProperty(object, 'constructor', { value: undefined })
  // Add a string tag
  Object.defineProperty(object, Symbol.toStringTag, {
    value: 'CustomTag',
    enumerable: false,
  })
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with undefined constructor name and empty string tag', (t) => {
  const context = new RealValueContext()
  // Create an object with no constructor name but with an empty string tag
  const object = {}
  // Delete constructor property to simulate undefined constructor name
  Object.defineProperty(object, 'constructor', { value: undefined })
  // Add an empty string tag
  Object.defineProperty(object, Symbol.toStringTag, {
    value: '',
    enumerable: false,
  })
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with non-Object constructor name and matching string tag', (t) => {
  const context = new RealValueContext()
  // Create a class with a matching string tag
  class TestClass {
    static get [Symbol.toStringTag]() {
      return 'TestClass'
    }

    foo = 'bar'
  }
  // Ensure the string tag is the same as the constructor name
  const object = new TestClass()
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with non-Object constructor name and different string tag', (t) => {
  const context = new RealValueContext()
  // Create a class with a different string tag
  class TestClass {
    foo = 'bar'
  }
  const object = new TestClass()
  // Add a different string tag
  Object.defineProperty(object, Symbol.toStringTag, {
    value: 'DifferentTag',
    enumerable: false,
  })
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with non-Object constructor name and empty string tag', (t) => {
  const context = new RealValueContext()
  // Create a class with custom constructor name
  class TestClass {
    foo = 'bar'
  }
  const object = new TestClass()
  // Add an empty string tag
  Object.defineProperty(object, Symbol.toStringTag, {
    value: '',
    enumerable: false,
  })
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with empty string constructor name', (t) => {
  const context = new RealValueContext()

  // Create an object with empty string constructor name
  const EmptyNameClass = new Function('return function() {}')() // eslint-disable-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, no-new-func
  const object = new EmptyNameClass() // eslint-disable-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call

  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

// Add another test for empty string constructor name but with a string tag
test('finalFormat prefixes & appends correctly for object with empty string constructor name and string tag', (t) => {
  const context = new RealValueContext()

  // Create an object with empty string constructor name
  const EmptyNameClass = new Function('return function() {}')() // eslint-disable-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, no-new-func
  const object = new EmptyNameClass() // eslint-disable-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call

  // Add a string tag
  Object.defineProperty(object, Symbol.toStringTag, {
    value: 'CustomTag',
    enumerable: false,
  })

  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly with non-empty formatter', (t) => {
  const context = new RealValueContext()
  const object = {}
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())

  // Add some content to the formatter to make it non-empty
  formatter.append('some content')

  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat encodes identifier-like strings correctly', (t) => {
  class TestClass {
    get [Symbol.toStringTag]() {
      return 'String\nTag🎉'
    }
  }

  Object.defineProperty(TestClass, 'name', { value: 'Test\nClass🎉' })

  {
    const context = new RealValueContext()
    const object = new TestClass()
    const representation = context.represent(object) as ObjectRepresentation
    const formatter = new Formatter(deriveTheme())
    representation.finalFormat(formatter)
    const rendered = formatter.render()
    t.snapshot(rendered, 'Constructor name and string tag with newlines and emojis')

    t.true(rendered.includes(String.raw`String\nTag\u{1f389}`)) // Encoded string tag
    t.true(rendered.includes(String.raw`Test\nClass\u{1f389}`)) // Encoded constructor name
  }

  Object.defineProperty(TestClass, 'name', { value: undefined }) // Reset name to undefined
  {
    const context = new RealValueContext()
    const object = new TestClass()
    const representation = context.represent(object) as ObjectRepresentation
    const formatter = new Formatter(deriveTheme())
    representation.finalFormat(formatter)
    const rendered = formatter.render()
    t.snapshot(rendered, 'String tag with newlines and emojis but no constructor name')
    t.true(rendered.includes(String.raw`String\nTag\u{1f389}`)) // Encoded string tag
  }
})

test('finalFormat uses array brackets when options.array is true', (t) => {
  const context = new RealValueContext()
  const object = { a: 1, b: 2 } // Regular object, not array-like
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter, { array: true })

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('['), 'Should use array opening bracket')
  t.true(rendered.includes(']'), 'Should use array closing bracket')
})

test('finalFormat uses array brackets when object is array-like', (t) => {
  const context = new RealValueContext()
  const arrayLike = {
    0: 'first', // eslint-disable-line @typescript-eslint/naming-convention
    1: 'second', // eslint-disable-line @typescript-eslint/naming-convention
    length: 2,
  }
  const representation = context.represent(arrayLike) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('['), 'Should use array opening bracket')
  t.true(rendered.includes(']'), 'Should use array closing bracket')
})

test('finalFormat uses array brackets with maxDepthReached when options.array is true', (t) => {
  const context = new RealValueContext()
  const object = { a: 1, b: 2 }
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme(), 10, 5) // Depth > maxDepth
  representation.finalFormat(formatter, { array: true })

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('['), 'Should use array opening bracket with maxDepth')
  t.true(rendered.includes(']'), 'Should use array closing bracket with maxDepth')
})

test('finalFormat uses array brackets with empty formatter when options.array is true', (t) => {
  const context = new RealValueContext()
  const object = {} // Empty object
  const representation = context.represent(object) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  // Formatter is empty by default
  representation.finalFormat(formatter, { array: true })

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('[]'), 'Should use empty array brackets')
  t.false(rendered.includes('{}'), 'Should not use empty object brackets')
})

test('finalFormat does not render Array constructor name when options.array is true', (t) => {
  // Create a "fake" Array class by defining a custom class and setting its name to 'Array'
  class Fake {
    foo = 'bar'
  }
  // Set name property to 'Array' to simulate Array constructor name
  Object.defineProperty(Fake, 'name', { value: 'Array' })

  const fakeArray = new Fake()

  const context = new RealValueContext()
  const representation = context.represent(fakeArray) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter, { array: true })

  const rendered = formatter.render()
  t.snapshot(rendered)

  // Should use array brackets
  t.true(rendered.includes('['), 'Should use array opening bracket')
  t.true(rendered.includes(']'), 'Should use array closing bracket')

  // Should NOT include "Array" constructor name in output
  t.false(rendered.includes('Array'), 'Should not include Array constructor name')
})

test('finalFormat renders disambiguationHint when provided', (t) => {
  {
    const context = new RealValueContext()
    const empty = {}
    const representation = context.represent(empty) as ObjectRepresentation

    const formatter = new Formatter(deriveTheme())
    representation.finalFormat(formatter, { disambiguationHint: 'Test Hint' })

    const rendered = formatter.render()
    t.snapshot(rendered, 'Empty object with disambiguation hint')
    t.true(rendered.includes('Test Hint'), 'Should include disambiguation hint in output')
  }

  {
    const context = new RealValueContext()
    const object = {}
    const representation = context.represent(object) as ObjectRepresentation

    const formatter = new Formatter(deriveTheme(), 10, 5)
    representation.finalFormat(formatter, { disambiguationHint: 'Test Hint' })

    const rendered = formatter.render()
    t.snapshot(rendered, 'Object with max depth and disambiguation hint')
    t.true(rendered.includes('Test Hint'), 'Should include disambiguation hint in max depth output')
  }

  {
    const context = new RealValueContext()
    const object = {}
    const representation = context.represent(object) as ObjectRepresentation

    const formatter = new Formatter(deriveTheme())
    formatter.append('some content') // Make formatter non-empty
    representation.finalFormat(formatter, { disambiguationHint: 'Test Hint' })

    const rendered = formatter.render()
    t.snapshot(rendered, 'Object with non-empty formatter and disambiguation hint')
    t.true(rendered.includes('Test Hint'), 'Should include disambiguation hint in non-empty output')
  }
})

test('deserialized property delegates to context', (t) => {
  const realContext = new RealValueContext()
  const deserializationContext = new DeserializationContext(new Decoder(new Uint8Array()))

  const opaque: Opaque = {}
  const realRep = new ObjectRepresentation(realContext, opaque)
  const deserializedRep = new ObjectRepresentation(deserializationContext, opaque)

  t.false(realRep.deserialized)
  t.true(deserializedRep.deserialized)
})

// Fuzzy comparison with ArrayRepresentation tests
test('ObjectRepresentation - fuzzy compare allows array-like objects to compare with ArrayRepresentation', (t) => {
  const context = new RealValueContext()

  // Create an array-like object (arguments object simulation)
  const arrayLikeObject: Record<string | number, unknown> = { length: 2 }
  arrayLikeObject[0] = 'a'
  arrayLikeObject[1] = 'b'

  // Create a real array
  const realArray = ['a', 'b']

  const arrayLikeRep = context.represent(arrayLikeObject)
  const arrayRep = context.represent(realArray)

  // In fuzzy mode, array-like objects should be comparable to arrays
  t.is(arrayLikeRep.compare(arrayRep, 'fuzzy'), comparable)
})

test('ObjectRepresentation - fuzzy compare does not allow non-array-like objects to compare with ArrayRepresentation', (t) => {
  const context = new RealValueContext()

  // Create a regular object
  const regularObject = { foo: 'bar' }

  // Create a real array
  const realArray = ['a', 'b']

  const objectRep = context.represent(regularObject)
  const arrayRep = context.represent(realArray)

  // In fuzzy mode, regular objects should still be unequal to arrays
  t.is(objectRep.compare(arrayRep, 'fuzzy'), unequal)
})
