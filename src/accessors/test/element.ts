import test from 'ava'
import { ElementAccessor, ElementGroup, SparseValueRepresentation } from '../element.ts'
import { UndefinedRepresentation } from '../../values/primitives/undefined.ts'
import { StringRepresentation } from '../../values/primitives/string.ts'
import { Encoder } from '../../encoder.ts'
import { Decoder } from '../../decoder.ts'
import { DeserializationContext } from '../../deserialization-context.ts'
import type { ArrayRepresentation } from '../../values/objects/array.ts'
import { strictlyEqual, unequal, deeplyEqual, comparable } from '../../comparison.ts'
import { partial, finished } from '../../serialization-result.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { deriveTheme } from '../../theme.ts'
import { Formatter } from '../../formatter.ts'
import type { ValueRepresentation } from '../../value.d.ts'
import { representValue } from '../../represent.ts'
import { serialize } from '../../serialize.ts'
import { deserialize } from '../../deserialize.ts'
import { RealValueContext } from '../../real-value-context.ts'
import type { TakeWhile } from '../../stack.ts'

// SparseValueRepresentation Tests
test('SparseValueRepresentation - compare returns strictlyEqual for other sparse values', (t) => {
  const sparse1 = new SparseValueRepresentation()
  const sparse2 = new SparseValueRepresentation()

  t.is(sparse1.compare(sparse2, 'comprehensive'), strictlyEqual)
})

test('SparseValueRepresentation - compare returns deeplyEqual for undefined representations', (t) => {
  const sparse = new SparseValueRepresentation()
  const undef = new UndefinedRepresentation()

  t.is(sparse.compare(undef, 'comprehensive'), deeplyEqual)
})

test('SparseValueRepresentation - compare returns unequal for other values', (t) => {
  const sparse = new SparseValueRepresentation()
  const string = new StringRepresentation('test')

  t.is(sparse.compare(string, 'comprehensive'), unequal)
})

test('SparseValueRepresentation - formatShallow formats as sparse', (t) => {
  const sparse = new SparseValueRepresentation()
  const theme = deriveTheme()
  const formatter = new Formatter(theme)
  sparse.formatShallow(formatter)
  const rendered = formatter.close().render()
  t.is(rendered, theme.array.sparse)
})

test('SparseValueRepresentation - serializeShallow encodes as undefined', (t) => {
  const sparse = new SparseValueRepresentation()

  const encoder = new Encoder()
  const result = sparse.serializeShallow(encoder)

  t.is(result, finished)

  // Reset the encoder and encode a real undefined
  const encoder2 = new Encoder()
  const undef = new UndefinedRepresentation()
  undef.serializeShallow(encoder2)

  // Both should encode identically
  t.deepEqual(encoder.bytes, encoder2.bytes)
})

test('SparseValueRepresentation - deserialized property returns false', (t) => {
  const sparse = new SparseValueRepresentation()
  t.false(sparse.deserialized)
})

test('SparseValueRepresentation - acceptsComparisonFrom returns true for SparseValueRepresentation', (t) => {
  const sparse1 = new SparseValueRepresentation()
  const sparse2 = new SparseValueRepresentation()

  t.true(sparse1.acceptsComparisonFrom(sparse2))
})

test('SparseValueRepresentation - acceptsComparisonFrom returns false for non-SparseValueRepresentation', (t) => {
  const sparse = new SparseValueRepresentation()
  const stringRep = new StringRepresentation('test')

  t.false(sparse.acceptsComparisonFrom(stringRep))
})

// ElementAccessor Tests
test('ElementAccessor - constructor sets index and value, which iterator yields', (t) => {
  // Test with one index
  const value1 = new StringRepresentation('test')
  const element1 = new ElementAccessor(5, value1)

  // Test iterator behavior
  const values1 = [...element1]
  t.is(values1.length, 1)
  t.is(values1[0], value1, 'Iterator should yield the string value')

  // Test with another index
  const value2 = new StringRepresentation('another test')
  const element2 = new ElementAccessor(42, value2)

  // Test iterator behavior again
  const values2 = [...element2]
  t.is(values2.length, 1)
  t.is(values2[0], value2, 'Iterator should yield the string value')
})

test('ElementAccessor.is correctly identifies ElementAccessor instances', (t) => {
  const value = new StringRepresentation('test')
  const element = new ElementAccessor(0, value)

  t.true(ElementAccessor.is(element))
  t.false(ElementAccessor.is({}))
  t.false(ElementAccessor.is(value))
})

test('ElementAccessor - compare returns unequal for non-ElementAccessor', (t) => {
  const value = new StringRepresentation('test')
  const element = new ElementAccessor(5, value)

  const nonElement = {
    compare: () => strictlyEqual,
    serialize: () => finished,
    *[Symbol.iterator]() {
      yield null
    },
  }

  t.is(element.compare(nonElement as unknown as ValueRepresentation, 'comprehensive'), unequal)
})

test('ElementAccessor - compare returns unequal for different indices', (t) => {
  const value = new StringRepresentation('test')

  const element1 = new ElementAccessor(5, value)
  const element2 = new ElementAccessor(10, value)

  t.is(element1.compare(element2, 'comprehensive'), unequal)
})

test('ElementAccessor - compare delegates to value comparison when indices match', (t) => {
  const value1 = new StringRepresentation('test')
  const value2 = new StringRepresentation('different')

  const element1 = new ElementAccessor(5, value1)
  const element2 = new ElementAccessor(5, value2)

  // Should return whatever the string comparison returns (unequal in this case)
  t.is(element1.compare(element2, 'comprehensive'), unequal)

  // When values are equal
  const value3 = new StringRepresentation('test')
  const element3 = new ElementAccessor(5, value3)
  t.is(element1.compare(element3, 'comprehensive'), strictlyEqual)
})

test('ElementAccessor - serialize delegates to value serializeShallow if available', (t) => {
  // Create a mock value with serializeShallow
  const mockValue = {
    compare: () => strictlyEqual,
    serialize: () => partial,
    serializeShallow(encoder: Encoder) {
      encoder.staticType(staticTypeTable.string)
      return finished
    },
    *[Symbol.iterator]() {
      yield null
    },
  }

  const element = new ElementAccessor(5, mockValue as unknown as ValueRepresentation)

  const encoder = new Encoder()
  const result = element.serialize(encoder)

  t.is(result, finished)
  t.is(encoder.bytes[0], staticTypeTable.string)
})

test('ElementAccessor - serialize returns partial when value has no serializeShallow', (t) => {
  // Create a mock value without serializeShallow
  const mockValue = {
    compare: () => strictlyEqual,
    serialize: () => finished,
    *[Symbol.iterator]() {
      yield null
    },
  }

  const element = new ElementAccessor(5, mockValue as unknown as ValueRepresentation)

  const encoder = new Encoder()
  const result = element.serialize(encoder)

  t.is(result, partial)
})

test('ElementAccessor - compare delegates comparison mode to value representation', (t) => {
  const context = new RealValueContext()

  // Create a plain object and a custom class instance
  class CustomClass {
    foo = 1
    bar = 2
  }
  const plain = { foo: 1, bar: 2 }
  const custom = new CustomClass()

  // Create element accessors with same indices but different value types
  const plainElement = new ElementAccessor(0, context.represent(plain))
  const customElement = new ElementAccessor(0, context.represent(custom))

  // In fuzzy mode, different object types should be comparable
  t.is(plainElement.compare(customElement, 'fuzzy'), comparable)
  t.is(customElement.compare(plainElement, 'fuzzy'), comparable)

  // In comprehensive mode, different object types should be unequal
  t.is(plainElement.compare(customElement, 'comprehensive'), unequal)
  t.is(customElement.compare(plainElement, 'comprehensive'), unequal)
})

test('ElementAccessor - handles complex nesting', (t) => {
  // Create a chain of element accessors
  const innerValue = new StringRepresentation('test')
  const inner = new ElementAccessor(2, innerValue)
  const outer = new ElementAccessor(1, inner)

  // Access via iteration
  const outerIteration = [...outer]
  t.is(outerIteration.length, 1)
  const innerIteration = [...(outerIteration[0] as any)] // eslint-disable-line @typescript-eslint/no-unsafe-assignment
  t.is(innerIteration.length, 1)
  t.is(innerIteration[0], innerValue)

  // Create a similar structure for comparison
  const innerValue2 = new StringRepresentation('test')
  const inner2 = new ElementAccessor(2, innerValue2)
  const outer2 = new ElementAccessor(1, inner2)

  // Deep comparison should work
  t.is(outer.compare(outer2, 'comprehensive'), strictlyEqual)
})

test('ElementAccessor - finalFormat appends theme.element.after to formatter', (t) => {
  const value = new StringRepresentation('test')
  const element = new ElementAccessor(5, value)

  const theme = deriveTheme()
  const formatter = new Formatter(theme)

  // Call finalFormat
  element.finalFormat(formatter)

  // Render the formatter's content
  const rendered = formatter.render()

  // Should contain the theme's element.after value
  t.is(rendered, theme.element.after)
})

test('ElementAccessor - deserialized property delegates to value representation', (t) => {
  const arrayValue = representValue([])
  const deserializedArrayValue = deserialize(serialize(arrayValue))

  const element = new ElementAccessor(0, arrayValue)
  const elementWithDeserialized = new ElementAccessor(1, deserializedArrayValue)

  t.false(element.deserialized)
  t.true(elementWithDeserialized.deserialized)
})

// ElementAccessor groupForComparison Tests
test('ElementAccessor - groupForComparison creates group with consecutive element accessors in fuzzy mode', (t) => {
  const ctx = new RealValueContext()
  const value1 = representValue('a', ctx)
  const value2 = representValue('b', ctx)
  const value3 = representValue('c', ctx)

  const element1 = new ElementAccessor(0, value1)
  const element2 = new ElementAccessor(1, value2)
  const element3 = new ElementAccessor(2, value3)

  // Mock takeWhile to return consecutive element accessors
  const takeWhile: TakeWhile = function* (condition) {
    for (const accessor of [element2, element3]) {
      if (!condition(accessor)) return
      yield accessor
    }
  }

  // Mock parent that's not an ElementGroup
  const parent = value1

  const group = element1.groupForComparison(takeWhile, parent, 'fuzzy')

  if (t.truthy(group)) {
    t.true(ElementGroup.is(group))

    const elements = [...group]
    t.is(elements.length, 3)
    t.true(ElementAccessor.is(elements[0]))
    t.true(ElementAccessor.is(elements[1]))
    t.true(ElementAccessor.is(elements[2]))
  }
})

test('ElementAccessor - groupForComparison returns undefined in comprehensive mode', (t) => {
  const ctx = new RealValueContext()
  const value = representValue('test', ctx)
  const element = new ElementAccessor(0, value)

  const takeWhile: TakeWhile = function* () {
    // Empty generator
  }

  const parent = value

  const result = element.groupForComparison(takeWhile, parent, 'comprehensive')

  t.is(result, undefined)
})

test('ElementAccessor - groupForComparison returns undefined when parent is already an ElementGroup', (t) => {
  const ctx = new RealValueContext()
  const value = representValue('test', ctx)
  const element = new ElementAccessor(0, value)
  const parent = new ElementGroup([element])

  const takeWhile: TakeWhile = function* () {
    // Empty generator
  }

  const result = element.groupForComparison(takeWhile, parent, 'fuzzy')

  t.is(result, undefined)
})

test('ElementAccessor - groupForComparison works with empty takeWhile result', (t) => {
  const ctx = new RealValueContext()
  const value = representValue('test', ctx)
  const element = new ElementAccessor(0, value)

  const takeWhile: TakeWhile = function* () {
    // Empty generator
  }

  const parent = value

  const group = element.groupForComparison(takeWhile, parent, 'fuzzy')

  if (t.truthy(group)) {
    const elements = [...group]
    t.is(elements.length, 1)
    t.true(ElementAccessor.is(elements[0]))
  }
})

test('ElementAccessor - groupForComparison fully deserializes its accessor', (t) => {
  const { bytes } = new Encoder()
    .staticType(staticTypeTable.array)
    .annotations({ p: 1, c: 'Array', l: 2 })
    // Add element aspect
    .staticType(staticTypeTable.elementAspect)
    // First element with nested array as value (complex enough to test fullyDeserialize)
    .staticType(staticTypeTable.array)
    .annotations({ p: 2, c: 'Array', l: 1 })
    .staticType(staticTypeTable.elementAspect)
    // Nested element
    .staticType(staticTypeTable.string)
    .string('nestedValue')
    .staticType(staticTypeTable.terminator)
    // Second element with simple string value
    .staticType(staticTypeTable.string)
    .string('simpleValue')
    // End elements
    .staticType(staticTypeTable.terminator)

  const decoder = new Decoder(bytes)
  const context = new DeserializationContext(decoder)

  const arrayRep = context.next() as ArrayRepresentation
  const iterator = arrayRep.iterateElements()
  const { value: accessor } = iterator.next() as { value: ValueRepresentation | undefined }
  if (!accessor || !ElementAccessor.is(accessor) || !('groupForComparison' in accessor)) {
    t.fail('Expected first element to be an ElementAccessor with groupForComparison method')
    return
  }

  // Mock takeWhile that returns no additional values
  const takeWhile: TakeWhile = function* () {
    // No-op
  }

  const group = accessor.groupForComparison(takeWhile, arrayRep, 'fuzzy')
  t.truthy(group, 'Group should be created from ElementAccessor')

  const { value: nextAccessor } = iterator.next() as { value: ValueRepresentation | undefined }
  if (!nextAccessor || !ElementAccessor.is(nextAccessor)) {
    t.fail('Expected second element to be an ElementAccessor')
    return
  }

  const expected = new ElementAccessor(1, new StringRepresentation('simpleValue'))
  t.is(
    expected.compare(nextAccessor, 'comprehensive'),
    strictlyEqual,
    'Next accessor should match expected simple accessor',
  )
})

test('ElementAccessor - acceptsComparisonFrom returns true for ElementAccessor', (t) => {
  const value1 = new StringRepresentation('test1')
  const value2 = new StringRepresentation('test2')
  const element1 = new ElementAccessor(0, value1)
  const element2 = new ElementAccessor(1, value2)

  t.true(element1.acceptsComparisonFrom(element2))
})

test('ElementAccessor - acceptsComparisonFrom returns false for non-ElementAccessor', (t) => {
  const value = new StringRepresentation('test')
  const element = new ElementAccessor(0, value)
  const sparse = new SparseValueRepresentation()

  t.false(element.acceptsComparisonFrom(sparse))
})

// ElementGroup Tests
test('ElementGroup - is method identifies ElementGroup instances', (t) => {
  const ctx = new RealValueContext()
  const value = representValue('test', ctx)
  const element = new ElementAccessor(0, value)
  const group = new ElementGroup([element])

  t.true(ElementGroup.is(group))
  t.false(ElementGroup.is(element))
  t.false(ElementGroup.is(value))
})

test('ElementGroup - compare returns unequal for non-ElementGroup values', (t) => {
  const ctx = new RealValueContext()
  const value = representValue('test', ctx)
  const element = new ElementAccessor(0, value)
  const group = new ElementGroup([element])

  t.is(group.compare(value), unequal)
  t.is(group.compare(element), unequal)
})

test('ElementGroup - compare returns comparable when lhs has equal elements as rhs', (t) => {
  const ctx = new RealValueContext()
  const value1 = representValue('a', ctx)
  const value2 = representValue('b', ctx)

  const element1 = new ElementAccessor(0, value1)
  const element2 = new ElementAccessor(1, value2)

  const group1 = new ElementGroup([element1, element2])
  const group2 = new ElementGroup([element1])
  const group3 = new ElementGroup([element1, element2])

  t.is(group1.compare(group2), unequal)
  t.is(group2.compare(group1), unequal)
  t.is(group1.compare(group3), comparable)
})

test('ElementGroup - align slices lhs elements in fuzzy mode when lhs is longer', (t) => {
  const ctx = new RealValueContext()
  const value1 = representValue('a', ctx)
  const value2 = representValue('b', ctx)
  const value3 = representValue('c', ctx)

  const element1 = new ElementAccessor(0, value1)
  const element2 = new ElementAccessor(1, value2)
  const element3 = new ElementAccessor(2, value3)

  const lhsGroup = new ElementGroup([element1, element2, element3])
  const rhsGroup = new ElementGroup([element1])

  // Before alignment
  t.is([...lhsGroup].length, 3)

  lhsGroup.align(rhsGroup, 'fuzzy')

  // After alignment, lhs should be sliced to match rhs length
  t.is([...lhsGroup].length, 1)
})

test('ElementGroup - align does nothing when lhs is shorter or equal', (t) => {
  const ctx = new RealValueContext()
  const value1 = representValue('a', ctx)
  const value2 = representValue('b', ctx)

  const element1 = new ElementAccessor(0, value1)
  const element2 = new ElementAccessor(1, value2)

  const lhsGroup = new ElementGroup([element1])
  const rhsGroup = new ElementGroup([element1, element2])

  // Before alignment
  t.is([...lhsGroup].length, 1)

  lhsGroup.align(rhsGroup, 'fuzzy')

  // After alignment, lhs should remain unchanged
  t.is([...lhsGroup].length, 1)
})

test('ElementGroup - align does nothing in comprehensive mode', (t) => {
  const ctx = new RealValueContext()
  const value1 = representValue('a', ctx)
  const value2 = representValue('b', ctx)
  const value3 = representValue('c', ctx)

  const element1 = new ElementAccessor(0, value1)
  const element2 = new ElementAccessor(1, value2)
  const element3 = new ElementAccessor(2, value3)

  const lhsGroup = new ElementGroup([element1, element2, element3])
  const rhsGroup = new ElementGroup([element1])

  // Before alignment
  t.is([...lhsGroup].length, 3)

  lhsGroup.align(rhsGroup, 'comprehensive')

  // After alignment in comprehensive mode, lhs should remain unchanged
  t.is([...lhsGroup].length, 3)
})

test('ElementGroup - align does nothing for non-ElementGroup other', (t) => {
  const ctx = new RealValueContext()
  const value1 = representValue('a', ctx)
  const value2 = representValue('b', ctx)

  const element1 = new ElementAccessor(0, value1)
  const element2 = new ElementAccessor(1, value2)

  const group = new ElementGroup([element1, element2])
  const other = value1

  // Before alignment
  t.is([...group].length, 2)

  group.align(other, 'fuzzy')

  // After alignment with non-group, should remain unchanged
  t.is([...group].length, 2)
})

test('ElementGroup - deserialized property reflects first element', (t) => {
  const ctx = new RealValueContext()
  const value = representValue('test', ctx)
  const element = new ElementAccessor(0, value)
  const group = new ElementGroup([element])

  t.is(group.deserialized, element.deserialized)
})

test('ElementGroup - deserialized property returns false for empty group', (t) => {
  const group = new ElementGroup([])

  t.false(group.deserialized)
})

test('ElementGroup - iterator yields all elements', (t) => {
  const ctx = new RealValueContext()
  const value1 = representValue('a', ctx)
  const value2 = representValue('b', ctx)

  const element1 = new ElementAccessor(0, value1)
  const element2 = new ElementAccessor(1, value2)

  const group = new ElementGroup([element1, element2])

  const elements = [...group]
  t.is(elements.length, 2)
  t.is(elements[0], element1)
  t.is(elements[1], element2)
})

test('ElementGroup - acceptsComparisonFrom returns true for ElementGroup', (t) => {
  const ctx = new RealValueContext()
  const value1 = representValue('a', ctx)
  const value2 = representValue('b', ctx)

  const element1 = new ElementAccessor(0, value1)
  const element2 = new ElementAccessor(1, value2)

  const group1 = new ElementGroup([element1])
  const group2 = new ElementGroup([element2])

  t.true(group1.acceptsComparisonFrom(group2))
})

test('ElementGroup - acceptsComparisonFrom returns false for non-ElementGroup', (t) => {
  const ctx = new RealValueContext()
  const value = representValue('a', ctx)
  const element = new ElementAccessor(0, value)
  const group = new ElementGroup([element])
  const sparse = new SparseValueRepresentation()

  t.false(group.acceptsComparisonFrom(sparse))
})
