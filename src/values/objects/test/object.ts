import test from 'ava'
import { DescriptionContext } from '../../../description-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { ObjectRepresentation, type ObjectAnnotations } from '../object.ts'
import { strictlyEqual, comparable, unequal } from '../../../comparison.ts'
import { NamedPropertyGroup, SymbolPropertyGroup } from '../../../accessors/property.ts'
import { NullRepresentation } from '../../primitives/null.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import never from 'never'
import { staticTypeTable } from '../../../serialization-types.ts'
import { BytesAccessor } from '../../../accessors/bytes.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

// Static method tests
test('static is method correctly identifies ObjectRepresentation instances', (t) => {
  const context = new DescriptionContext()
  const obj = { a: 1 }
  const rep = context.represent(obj) as ObjectRepresentation

  t.true(ObjectRepresentation.is(rep))
  t.false(ObjectRepresentation.is({}))
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
  const obj = {}
  const context = new DescriptionContext()
  const a = context.represent(obj) as ObjectRepresentation
  const b = context.represent(obj) as ObjectRepresentation

  t.is(a.compare(b), strictlyEqual)
})

test('compare returns unequal for non-ObjectRepresentation values', (t) => {
  const context = new DescriptionContext()
  const a = context.represent({}) as ObjectRepresentation

  t.is(a.compare(new NullRepresentation()), unequal)
})

test('compare returns unequal by default when one object has a null prototype and the other does not', (t) => {
  const context = new DescriptionContext()
  const nullProtoObj = Object.create(null)
  const regularObj = {}

  const a = context.represent(nullProtoObj) as ObjectRepresentation
  const b = context.represent(regularObj) as ObjectRepresentation

  t.is(a.compare(b), unequal)
  t.is(b.compare(a), unequal)
})

test('compare returns comparable when compareNullProtoToObjectProto flag is true', (t) => {
  const context = new DescriptionContext({ flags: { compareNullProtoToObjectProto: true } })
  const nullProtoObj = Object.create(null)
  const regularObj = {}

  const a = context.represent(nullProtoObj) as ObjectRepresentation
  const b = context.represent(regularObj) as ObjectRepresentation

  t.is(a.compare(b), comparable)
  t.is(b.compare(a), comparable)
})

test('compare returns unequal for objects with different string tags', (t) => {
  const context = new DescriptionContext()

  // Create an object with custom toString tag
  const obj1 = {}
  Object.defineProperty(obj1, Symbol.toStringTag, {
    value: 'CustomTag',
    enumerable: false, // Explicitly set to non-enumerable to match real-world usage
  })
  const obj2 = {}

  const a = context.represent(obj1) as ObjectRepresentation
  const b = context.represent(obj2) as ObjectRepresentation

  t.is(a.compare(b), unequal)
})

test('compare returns unequal for objects with different constructor names', (t) => {
  const context = new DescriptionContext()

  class Custom1 {}
  class Custom2 {}

  const a = context.represent(new Custom1()) as ObjectRepresentation
  const b = context.represent(new Custom2()) as ObjectRepresentation

  t.is(a.compare(b), unequal)
})

test('compare returns unequal when comparing objects with empty string vs undefined constructor names', (t) => {
  const context = new DescriptionContext()

  // Create an object with empty string constructor name
  const EmptyNameClass = Function('return function() {}')()
  const objWithEmptyConstructorName = new EmptyNameClass()

  // Create an object with undefined constructor name
  const objWithUndefinedConstructorName = Object.create(null)
  objWithUndefinedConstructorName.constructor = undefined

  const a = context.represent(objWithEmptyConstructorName) as ObjectRepresentation
  const b = context.represent(objWithUndefinedConstructorName) as ObjectRepresentation

  // They should be treated as unequal since empty string and undefined are different
  t.is(a.compare(b), unequal)
})

// Array-like objects tests
test('iterateArrayLike yields elements for array-like objects', (t) => {
  const arrayLike = {
    0: 'first',
    1: 'second',
    length: 2,
  }
  const context = new DescriptionContext()
  const representation = context.represent(arrayLike) as ObjectRepresentation

  const elements = [...representation.iterateArrayLike()]

  t.is(elements.length, 2)
})

test('iterateArrayLike yields no elements for non-array-like objects', (t) => {
  const obj = {}
  const context = new DescriptionContext()
  const representation = context.represent(obj) as ObjectRepresentation

  const elements = [...representation.iterateArrayLike()]

  t.is(elements.length, 0)
})

// Property iteration tests
test('iterateProperties yields property groups', (t) => {
  const obj = {
    foo: 'bar',
    [Symbol()]: 'thud',
  }

  const context = new DescriptionContext()
  const representation = context.represent(obj) as ObjectRepresentation

  const propertyGroups = [...representation.iterateProperties()]

  t.is(propertyGroups.length, 2)
  const [named = never(), symbols = never()] = propertyGroups
  t.true(named instanceof NamedPropertyGroup)
  t.true(symbols instanceof SymbolPropertyGroup)
  t.is([...named].length, 1)
  t.is([...symbols].length, 1)
})

test('iterateProperties ignores non-enumerable properties', (t) => {
  const obj = {
    baz: 42,
    qux: true,
  }
  Object.defineProperty(obj, 'foo', {
    value: 'bar',
    enumerable: false,
  })

  const context = new DescriptionContext()
  const representation = context.represent(obj) as ObjectRepresentation

  // Include specific property
  const propertyGroups = [...representation.iterateProperties()]

  t.is(propertyGroups.length, 1)
  const [named = never()] = propertyGroups
  t.is([...named].length, 2)
})

test('iterateProperties accepts specific property names to include', (t) => {
  const obj = {
    baz: 42,
    qux: true,
  }
  Object.defineProperty(obj, 'foo', {
    value: 'bar',
    enumerable: false,
  })

  const context = new DescriptionContext()
  const representation = context.represent(obj) as ObjectRepresentation

  // Include specific property
  const propertyGroups = [...representation.iterateProperties('foo')]

  t.is(propertyGroups.length, 1)
  const [named = never()] = propertyGroups
  t.is([...named].length, 3)
})

// Iterable tests
test('iterateIterable yields no entries for non-iterable objects', (t) => {
  const obj = {}
  const context = new DescriptionContext()
  const representation = context.represent(obj) as ObjectRepresentation

  const iterables = [...representation.iterateIterable()]

  t.is(iterables.length, 0)
})

test('iterateIterable yields no entries for array-like objects even with Symbol.iterator', (t) => {
  // Create an array-like object that also has Symbol.iterator
  const arrayLikeWithIterator = {
    0: 'first',
    1: 'second',
    length: 2,
    *[Symbol.iterator]() {
      yield 'a'
      yield 'b'
      yield 'c'
    },
  }

  const context = new DescriptionContext()
  const representation = context.represent(arrayLikeWithIterator) as ObjectRepresentation

  // Should yield no values for array-like objects, ignoring the iterator
  const iterables = [...representation.iterateIterable()]
  t.is(iterables.length, 0)

  // Confirm it's recognized as array-like
  const arrayLikeElements = [...representation.iterateArrayLike()]
  t.is(arrayLikeElements.length, 2)
})

test('iterateIterable yields values for objects with Symbol.iterator', (t) => {
  const iterableObj = {
    *[Symbol.iterator]() {
      yield 'a'
      yield 'b'
    },
  }

  const context = new DescriptionContext()
  const representation = context.represent(iterableObj) as ObjectRepresentation

  const iterables = [...representation.iterateIterable()]

  t.is(iterables.length, 2)
})

// Symbol.iterator tests
test('Symbol.iterator yields array-like elements and property groups for array-like objects', (t) => {
  const context = new DescriptionContext()
  const obj = {
    0: 'a',
    1: 'b',
    length: 2,
    foo: 'bar',
    [Symbol()]: 'Test',
  }
  const rep = context.represent(obj) as ObjectRepresentation

  const allItems = [...rep]

  // Should include array-like elements and property groups
  t.is(allItems.length, 4) // At least array elements (2) + property group(s)
})

test('Symbol.iterator yields iterator values and property groups for iterable non-array-like objects', (t) => {
  const context = new DescriptionContext()
  const obj = {
    foo: 'bar',
    [Symbol()]: 'Test',
    // Iterable but not array-like
    *[Symbol.iterator]() {
      yield 'a'
      yield 'b'
      yield 'c'
    },
  }
  const rep = context.represent(obj) as ObjectRepresentation

  const allItems = [...rep]

  // Should include iterator values and property groups
  t.is(allItems.length, 5) // At least iterator values (3) + property groups
})

// Serialization tests
test('serialize includes annotations', (t) => {
  {
    // Create object representation
    class CustomClass {
      length = 2
      0 = 'a'
      1 = 'b';
      [Symbol.toStringTag] = 'CustomTag'
    }
    const context = new DescriptionContext()
    const custom = context.represent(new CustomClass()) as ObjectRepresentation
    const encoder = new Encoder()
    custom.serialize(encoder)
    snapshotEncoded(t, encoder, 'object start & annotations')

    // Ensure the correct static type was used
    const decoder = new Decoder(encoder.bytes)
    t.is(decoder.staticType(), staticTypeTable.object)
  }

  {
    const obj = Object.create(null)
    const context = new DescriptionContext()
    const representation = context.represent(obj) as ObjectRepresentation
    const encoder = new Encoder()
    representation.serialize(encoder)
    snapshotEncoded(t, encoder, 'null proto object start & annotations')
  }

  {
    const obj = { length: 2, 0: 'a', 1: 'b' }
    const context = new DescriptionContext()
    const representation = context.represent(obj) as ObjectRepresentation
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
  const obj = new CustomClass()
  const context = new DescriptionContext()
  const representation = context.represent(obj) as ObjectRepresentation

  const encoder = new Encoder()
  representation.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType()
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ObjectRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original but not strictly equal
  t.is(representation.compare(deserialized), comparable)
})

// finalFormat tests
test('finalFormat prefixes & appends correctly for basic object', (t) => {
  const context = new DescriptionContext()
  const obj = {}
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with stringTag', (t) => {
  const context = new DescriptionContext()
  const obj = {}
  Object.defineProperty(obj, Symbol.toStringTag, {
    value: 'CustomTag',
    enumerable: false,
  })
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with constructor name', (t) => {
  const context = new DescriptionContext()
  class TestClass {}
  const obj = new TestClass()
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for null prototype object', (t) => {
  const context = new DescriptionContext()
  const obj = Object.create(null)
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly when max depth reached', (t) => {
  const context = new DescriptionContext()
  const obj = {}
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme(), 10, 5) // depth > maxDepth
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly when max depth reached and formatter is not empty', (t) => {
  const context = new DescriptionContext()
  const obj = {}
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme(), 10, 5) // depth > maxDepth
  // Add some content to make the formatter non-empty
  formatter.append('test content')
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with undefined constructor name but defined string tag', (t) => {
  const context = new DescriptionContext()
  // Create an object with no constructor name but with a string tag
  const obj = {}
  // Delete constructor property to simulate undefined constructor name
  Object.defineProperty(obj, 'constructor', { value: undefined })
  // Add a string tag
  Object.defineProperty(obj, Symbol.toStringTag, {
    value: 'CustomTag',
    enumerable: false,
  })
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with undefined constructor name and empty string tag', (t) => {
  const context = new DescriptionContext()
  // Create an object with no constructor name but with an empty string tag
  const obj = {}
  // Delete constructor property to simulate undefined constructor name
  Object.defineProperty(obj, 'constructor', { value: undefined })
  // Add an empty string tag
  Object.defineProperty(obj, Symbol.toStringTag, {
    value: '',
    enumerable: false,
  })
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with non-Object constructor name and matching string tag', (t) => {
  const context = new DescriptionContext()
  // Create a class with a matching string tag
  class TestClass {
    static get [Symbol.toStringTag]() {
      return 'TestClass'
    }
  }
  // Ensure the string tag is the same as the constructor name
  const obj = new TestClass()
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with non-Object constructor name and different string tag', (t) => {
  const context = new DescriptionContext()
  // Create a class with a different string tag
  class TestClass {}
  const obj = new TestClass()
  // Add a different string tag
  Object.defineProperty(obj, Symbol.toStringTag, {
    value: 'DifferentTag',
    enumerable: false,
  })
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with non-Object constructor name and empty string tag', (t) => {
  const context = new DescriptionContext()
  // Create a class with custom constructor name
  class TestClass {}
  const obj = new TestClass()
  // Add an empty string tag
  Object.defineProperty(obj, Symbol.toStringTag, {
    value: '',
    enumerable: false,
  })
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly for object with empty string constructor name', (t) => {
  const context = new DescriptionContext()

  // Create an object with empty string constructor name
  const EmptyNameClass = Function('return function() {}')()
  const obj = new EmptyNameClass()

  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

// Add another test for empty string constructor name but with a string tag
test('finalFormat prefixes & appends correctly for object with empty string constructor name and string tag', (t) => {
  const context = new DescriptionContext()

  // Create an object with empty string constructor name
  const EmptyNameClass = Function('return function() {}')()
  const obj = new EmptyNameClass()

  // Add a string tag
  Object.defineProperty(obj, Symbol.toStringTag, {
    value: 'CustomTag',
    enumerable: false,
  })

  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter)

  const rendered = formatter.render()
  t.snapshot(rendered)
})

test('finalFormat prefixes & appends correctly with non-empty formatter', (t) => {
  const context = new DescriptionContext()
  const obj = {}
  const representation = context.represent(obj) as ObjectRepresentation

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
    const context = new DescriptionContext()
    const obj = new TestClass()
    const representation = context.represent(obj) as ObjectRepresentation
    const formatter = new Formatter(deriveTheme())
    representation.finalFormat(formatter)
    const rendered = formatter.render()
    t.snapshot(rendered, 'Constructor name and string tag with newlines and emojis')

    t.true(rendered.includes('String\\nTag\\u{1f389}')) // Encoded string tag
    t.true(rendered.includes('Test\\nClass\\u{1f389}')) // Encoded constructor name
  }

  Object.defineProperty(TestClass, 'name', { value: undefined }) // Reset name to undefined
  {
    const context = new DescriptionContext()
    const obj = new TestClass()
    const representation = context.represent(obj) as ObjectRepresentation
    const formatter = new Formatter(deriveTheme())
    representation.finalFormat(formatter)
    const rendered = formatter.render()
    t.snapshot(rendered, 'String tag with newlines and emojis but no constructor name')
    t.true(rendered.includes('String\\nTag\\u{1f389}')) // Encoded string tag
  }
})

test('finalFormat uses array brackets when options.array is true', (t) => {
  const context = new DescriptionContext()
  const obj = { a: 1, b: 2 } // Regular object, not array-like
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  representation.finalFormat(formatter, { array: true })

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('['), 'Should use array opening bracket')
  t.true(rendered.includes(']'), 'Should use array closing bracket')
})

test('finalFormat uses array brackets when object is array-like', (t) => {
  const context = new DescriptionContext()
  const arrayLike = {
    0: 'first',
    1: 'second',
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
  const context = new DescriptionContext()
  const obj = { a: 1, b: 2 }
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme(), 10, 5) // depth > maxDepth
  representation.finalFormat(formatter, { array: true })

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('['), 'Should use array opening bracket with maxDepth')
  t.true(rendered.includes(']'), 'Should use array closing bracket with maxDepth')
})

test('finalFormat uses array brackets with empty formatter when options.array is true', (t) => {
  const context = new DescriptionContext()
  const obj = {} // Empty object
  const representation = context.represent(obj) as ObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  // formatter is empty by default
  representation.finalFormat(formatter, { array: true })

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('[]'), 'Should use empty array brackets')
  t.false(rendered.includes('{}'), 'Should not use empty object brackets')
})

test('finalFormat does not render Array constructor name when options.array is true', (t) => {
  // Create a "fake" Array class by defining a custom class and setting its name to 'Array'
  class Fake {}
  // Set name property to 'Array' to simulate Array constructor name
  Object.defineProperty(Fake, 'name', { value: 'Array' })

  const fakeArray = new Fake()

  const context = new DescriptionContext()
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
    const context = new DescriptionContext()
    const empty = {}
    const representation = context.represent(empty) as ObjectRepresentation

    const formatter = new Formatter(deriveTheme())
    representation.finalFormat(formatter, { disambiguationHint: 'Test Hint' })

    const rendered = formatter.render()
    t.snapshot(rendered, 'Empty object with disambiguation hint')
    t.true(rendered.includes('Test Hint'), 'Should include disambiguation hint in output')
  }

  {
    const context = new DescriptionContext()
    const obj = {}
    const representation = context.represent(obj) as ObjectRepresentation

    const formatter = new Formatter(deriveTheme(), 10, 5)
    representation.finalFormat(formatter, { disambiguationHint: 'Test Hint' })

    const rendered = formatter.render()
    t.snapshot(rendered, 'Object with max depth and disambiguation hint')
    t.true(rendered.includes('Test Hint'), 'Should include disambiguation hint in max depth output')
  }

  {
    const context = new DescriptionContext()
    const obj = {}
    const representation = context.represent(obj) as ObjectRepresentation

    const formatter = new Formatter(deriveTheme())
    formatter.append('some content') // Make formatter non-empty
    representation.finalFormat(formatter, { disambiguationHint: 'Test Hint' })

    const rendered = formatter.render()
    t.snapshot(rendered, 'Object with non-empty formatter and disambiguation hint')
    t.true(rendered.includes('Test Hint'), 'Should include disambiguation hint in non-empty output')
  }
})
