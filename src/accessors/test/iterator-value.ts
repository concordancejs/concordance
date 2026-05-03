import test from 'ava'
import { IteratorValueAccessor, IteratorValueGroup } from '../iterator-value.ts'
import { StringRepresentation } from '../../values/primitives/string.ts'
import { NumberRepresentation } from '../../values/primitives/number.ts'
import { Encoder } from '../../encoder.ts'
import { strictlyEqual, unequal, comparable } from '../../comparison.ts'
import { partial, finished } from '../../serialization-result.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { Formatter } from '../../formatter.ts'
import { deriveTheme } from '../../theme.ts'
import type { ValueRepresentation } from '../../value.d.ts'
import { representValue } from '../../represent.ts'
import { serialize } from '../../serialize.ts'
import { deserialize } from '../../deserialize.ts'
import { RealValueContext } from '../../real-value-context.ts'
import type { TakeWhile } from '../../stack.ts'
import { Decoder } from '../../decoder.ts'
import { DeserializationContext } from '../../deserialization-context.ts'
import type { SetRepresentation } from '../../values/objects/set.ts'

test('IteratorValueAccessor - constructor sets index and value, which iterator yields', (t) => {
  // Test with one index
  const value1 = new StringRepresentation('test')
  const iteratorValue1 = new IteratorValueAccessor(5, value1)

  // Test iterator behavior
  const values1 = [...iteratorValue1]
  t.is(values1.length, 1)
  t.is(values1[0], value1, 'Iterator should yield the string value')

  // Test with another index and value type
  const value2 = new NumberRepresentation(42)
  const iteratorValue2 = new IteratorValueAccessor(10, value2)

  // Test iterator behavior again
  const values2 = [...iteratorValue2]
  t.is(values2.length, 1)
  t.is(values2[0], value2, 'Iterator should yield the number value')
})

test('IteratorValueAccessor.is correctly identifies instances', (t) => {
  const value = new StringRepresentation('test')
  const iteratorValue = new IteratorValueAccessor(0, value)

  t.true(IteratorValueAccessor.is(iteratorValue))
  t.false(IteratorValueAccessor.is({}))
  t.false(IteratorValueAccessor.is(value))
})

test('IteratorValueAccessor - compare returns unequal for non-IteratorValueAccessor', (t) => {
  const value = new StringRepresentation('test')
  const iteratorValue = new IteratorValueAccessor(5, value)

  const nonIteratorValue = {
    compare: () => strictlyEqual,
    serialize: () => finished,
    *[Symbol.iterator]() {
      yield null
    },
  }

  t.is(iteratorValue.compare(nonIteratorValue as unknown as ValueRepresentation, 'comprehensive'), unequal)
})

test('IteratorValueAccessor - compare returns unequal for different indices in comprehensive mode', (t) => {
  const value = new StringRepresentation('test')

  const iteratorValue1 = new IteratorValueAccessor(5, value)
  const iteratorValue2 = new IteratorValueAccessor(10, value)

  t.is(iteratorValue1.compare(iteratorValue2, 'comprehensive'), unequal)
})

test('IteratorValueAccessor - compare delegates to value comparison when indices match', (t) => {
  const value1 = new StringRepresentation('test')
  const value2 = new StringRepresentation('different')

  const iteratorValue1 = new IteratorValueAccessor(5, value1)
  const iteratorValue2 = new IteratorValueAccessor(5, value2)

  // Should return whatever the string comparison returns (unequal in this case)
  t.is(iteratorValue1.compare(iteratorValue2, 'comprehensive'), unequal)

  // When values are equal
  const value3 = new StringRepresentation('test')
  const iteratorValue3 = new IteratorValueAccessor(5, value3)
  t.is(iteratorValue1.compare(iteratorValue3, 'comprehensive'), strictlyEqual)
})

test('IteratorValueAccessor - compare delegates to value comparison when indices are unequal in fuzzy mode', (t) => {
  const value1 = new StringRepresentation('test')
  const value2 = new StringRepresentation('different')

  const iteratorValue1 = new IteratorValueAccessor(3, value1)
  const iteratorValue2 = new IteratorValueAccessor(5, value2)

  // Should return whatever the string comparison returns (unequal in this case)
  t.is(iteratorValue1.compare(iteratorValue2, 'fuzzy'), unequal)

  // When values are equal
  const value3 = new StringRepresentation('test')
  const iteratorValue3 = new IteratorValueAccessor(5, value3)
  t.is(iteratorValue1.compare(iteratorValue3, 'fuzzy'), strictlyEqual)
})

test('IteratorValueAccessor - compare delegates comparison mode to value representation', (t) => {
  const context = new RealValueContext()

  // Create a plain object and a custom class instance
  class CustomClass {
    foo = 1
    bar = 2
  }
  const plain = { foo: 1, bar: 2 }
  const custom = new CustomClass()

  // Create iterator value accessors with same indices but different value types
  const plainIteratorValue = new IteratorValueAccessor(0, context.represent(plain))
  const customIteratorValue = new IteratorValueAccessor(0, context.represent(custom))

  // In fuzzy mode, different object types should be comparable
  t.is(plainIteratorValue.compare(customIteratorValue, 'fuzzy'), comparable)
  t.is(customIteratorValue.compare(plainIteratorValue, 'fuzzy'), comparable)

  // In comprehensive mode, different object types should be unequal
  t.is(plainIteratorValue.compare(customIteratorValue, 'comprehensive'), unequal)
  t.is(customIteratorValue.compare(plainIteratorValue, 'comprehensive'), unequal)
})

test('IteratorValueAccessor - acceptsComparisonFrom returns true for IteratorValueAccessor', (t) => {
  const value1 = new StringRepresentation('test1')
  const value2 = new StringRepresentation('test2')
  const iteratorValue1 = new IteratorValueAccessor(0, value1)
  const iteratorValue2 = new IteratorValueAccessor(1, value2)

  t.true(iteratorValue1.acceptsComparisonFrom(iteratorValue2))
})

test('IteratorValueAccessor - acceptsComparisonFrom returns false for non-IteratorValueAccessor', (t) => {
  const value = new StringRepresentation('test')
  const iteratorValue = new IteratorValueAccessor(0, value)
  const stringRep = new StringRepresentation('other')

  t.false(iteratorValue.acceptsComparisonFrom(stringRep))
})

test('IteratorValueAccessor - serialize delegates to value serializeShallow if available', (t) => {
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

  const iteratorValue = new IteratorValueAccessor(5, mockValue as unknown as ValueRepresentation)

  const encoder = new Encoder()
  const result = iteratorValue.serialize(encoder)

  t.is(result, finished)
  t.is(encoder.bytes[0], staticTypeTable.string)
})

test('IteratorValueAccessor - serialize returns partial when value has no serializeShallow', (t) => {
  // Create a mock value without serializeShallow
  const mockValue = {
    compare: () => strictlyEqual,
    serialize: () => finished,
    *[Symbol.iterator]() {
      yield null
    },
  }

  const iteratorValue = new IteratorValueAccessor(5, mockValue as unknown as ValueRepresentation)

  const encoder = new Encoder()
  const result = iteratorValue.serialize(encoder)

  t.is(result, partial)
})

test('IteratorValueAccessor - works with primitive values', (t) => {
  const numberValue = new NumberRepresentation(42)
  const iteratorValue = new IteratorValueAccessor(0, numberValue)

  // Iteration
  const values = [...iteratorValue]
  t.is(values.length, 1)
  t.is(values[0], numberValue)

  // Comparison
  const iteratorValue2 = new IteratorValueAccessor(0, new NumberRepresentation(42))
  t.is(iteratorValue.compare(iteratorValue2, 'comprehensive'), strictlyEqual)

  const iteratorValue3 = new IteratorValueAccessor(0, new NumberRepresentation(43))
  t.is(iteratorValue.compare(iteratorValue3, 'comprehensive'), unequal)
})

test('IteratorValueAccessor - handles nested iterator values', (t) => {
  // Create a chain of iterator values
  const innerValue = new StringRepresentation('test')
  const inner = new IteratorValueAccessor(2, innerValue)
  const outer = new IteratorValueAccessor(1, inner)

  // Access via iteration
  const outerIteration = [...outer]
  t.is(outerIteration.length, 1)
  const innerIteration = [...(outerIteration[0] as any)] // eslint-disable-line @typescript-eslint/no-unsafe-assignment
  t.is(innerIteration.length, 1)
  t.is(innerIteration[0], innerValue)

  // Create a similar structure for comparison
  const innerValue2 = new StringRepresentation('test')
  const inner2 = new IteratorValueAccessor(2, innerValue2)
  const outer2 = new IteratorValueAccessor(1, inner2)

  // Deep comparison should work
  t.is(outer.compare(outer2, 'comprehensive'), strictlyEqual)
})

test('IteratorValueAccessor - finalFormat appends theme.iteratorValue.after to formatter', (t) => {
  const value = new StringRepresentation('test')
  const iteratorValue = new IteratorValueAccessor(5, value)

  const theme = deriveTheme()
  const formatter = new Formatter(theme)

  // Call finalFormat
  iteratorValue.finalFormat(formatter)

  // Render the formatter's content
  const rendered = formatter.render()

  // Should contain the theme's iteratorValue.after value
  t.is(rendered, theme.iteratorValue.after)
})

test('IteratorValueAccessor - deserialized property delegates to value representation', (t) => {
  const arrayValue = representValue([])
  const deserializedArrayValue = deserialize(serialize(arrayValue))

  const iteratorWithValue = new IteratorValueAccessor(0, arrayValue)
  const iteratorWithDeserialized = new IteratorValueAccessor(1, deserializedArrayValue)

  t.false(iteratorWithValue.deserialized)
  t.true(iteratorWithDeserialized.deserialized)
})

test('IteratorValueAccessor - groupForComparison creates group with consecutive iterator values when parent is SetRepresentation', (t) => {
  const context = new RealValueContext()
  const setValue = context.represent(new Set(['test1', 'test2']))

  const value1 = new StringRepresentation('value1')
  const value2 = new StringRepresentation('value2')
  const value3 = new StringRepresentation('value3')

  const iteratorValue1 = new IteratorValueAccessor(0, value1)
  const iteratorValue2 = new IteratorValueAccessor(1, value2)
  const iteratorValue3 = new IteratorValueAccessor(2, value3)

  // Mock takeWhile that returns consecutive IteratorValueAccessors
  const takeWhile: TakeWhile = function* (condition) {
    for (const value of [iteratorValue2, iteratorValue3]) {
      if (!condition(value)) return
      yield value
    }
  }

  // Test groupForComparison with SetRepresentation parent
  const group = iteratorValue1.groupForComparison(takeWhile, setValue, 'fuzzy')

  if (t.truthy(group)) {
    t.true(IteratorValueGroup.is(group))

    // Verify the group contains all iterator values
    const groupedValues = [...group]
    t.is(groupedValues.length, 3)
    t.is(groupedValues[0], iteratorValue1)
    t.is(groupedValues[1], iteratorValue2)
    t.is(groupedValues[2], iteratorValue3)
  }
})

test('IteratorValueAccessor - groupForComparison returns undefined when mode is full', (t) => {
  const context = new RealValueContext()
  const setValue = context.represent(new Set(['test1']))

  const iteratorValue = new IteratorValueAccessor(0, new StringRepresentation('value'))
  const takeWhile: TakeWhile = function* () {
    // No-op
  }

  const result = iteratorValue.groupForComparison(takeWhile, setValue, 'comprehensive')
  t.is(result, undefined)
})

test('IteratorValueAccessor - groupForComparison returns undefined when parent is not a SetRepresentation', (t) => {
  const iteratorValue = new IteratorValueAccessor(0, new StringRepresentation('value'))
  const parent = new StringRepresentation('parent')
  const takeWhile: TakeWhile = function* () {
    // No-op
  }

  const result = iteratorValue.groupForComparison(takeWhile, parent, 'fuzzy')
  t.is(result, undefined)
})

test('IteratorValueAccessor - groupForComparison returns undefined when parent is already an IteratorValueGroup', (t) => {
  const iteratorValue = new IteratorValueAccessor(0, new StringRepresentation('value'))
  const parent = new IteratorValueGroup([])
  const takeWhile: TakeWhile = function* () {
    // No-op
  }

  const result = iteratorValue.groupForComparison(takeWhile, parent, 'fuzzy')
  t.is(result, undefined)
})

test('IteratorValueAccessor - groupForComparison works with empty takeWhile result', (t) => {
  const context = new RealValueContext()
  const setValue = context.represent(new Set(['test1']))

  const iteratorValue = new IteratorValueAccessor(0, new StringRepresentation('value'))

  // Mock takeWhile that returns no additional values
  const takeWhile: TakeWhile = function* () {
    // No-op
  }

  const group = iteratorValue.groupForComparison(takeWhile, setValue, 'fuzzy')

  if (t.truthy(group)) {
    t.true(IteratorValueGroup.is(group))

    // Should only contain the original iterator value
    const groupedValues = [...group]
    t.is(groupedValues.length, 1)
    t.is(groupedValues[0], iteratorValue)
  }
})

test('IteratorValueAccessor - groupForComparison fully deserializes its accessor', (t) => {
  const { bytes } = new Encoder()
    .staticType(staticTypeTable.set)
    .annotations({ s: 1, p: 1, c: 'Set' })
    // Add iterator value aspect
    .staticType(staticTypeTable.iteratorValueAspect)
    // First iterator value with nested set as value (complex enough to test fullyDeserialize)
    .staticType(staticTypeTable.set)
    .annotations({ s: 1, p: 2, c: 'Set' })
    .staticType(staticTypeTable.iteratorValueAspect)
    // Nested iterator value
    .staticType(staticTypeTable.string)
    .string('nestedValue')
    .staticType(staticTypeTable.terminator)
    // Second iterator value with simple string value
    .staticType(staticTypeTable.string)
    .string('simpleValue')
    // End iterator values
    .staticType(staticTypeTable.terminator)

  const decoder = new Decoder(bytes)
  const context = new DeserializationContext(decoder)

  const setRep = context.next() as SetRepresentation
  const iterator = setRep.iterateIterable()
  const { value: accessor } = iterator.next() as { value: ValueRepresentation | undefined }
  if (!accessor || !IteratorValueAccessor.is(accessor) || !('groupForComparison' in accessor)) {
    t.fail('Expected first value to be an IteratorValueAccessor with groupForComparison method')
    return
  }

  // Mock takeWhile that returns no additional values
  const takeWhile: TakeWhile = function* () {
    // No-op
  }

  const group = accessor.groupForComparison(takeWhile, setRep, 'fuzzy')
  t.truthy(group, 'Group should be created from IteratorValueAccessor')

  const { value: nextAccessor } = iterator.next() as { value: ValueRepresentation | undefined }
  if (!nextAccessor || !IteratorValueAccessor.is(nextAccessor)) {
    t.fail('Expected second value to be an IteratorValueAccessor')
    return
  }

  const expected = new IteratorValueAccessor(1, new StringRepresentation('simpleValue'))
  t.is(
    expected.compare(nextAccessor, 'comprehensive'),
    strictlyEqual,
    'Next accessor should match expected simple accessor',
  )
})

test('IteratorValueAccessor.alignForComparison orders values by intersection', (t) => {
  const value1 = new StringRepresentation('value1')
  const value2 = new StringRepresentation('value2')
  const value3 = new StringRepresentation('value3')
  const value4 = new StringRepresentation('value4')

  const iteratorA = new IteratorValueAccessor(0, value1)
  const iteratorB = new IteratorValueAccessor(1, value2)
  const iteratorC = new IteratorValueAccessor(2, value3)
  const iteratorD = new IteratorValueAccessor(3, value4)

  // LHS: [A, B, C] with values [value1, value2, value3]
  // RHS: [D, B] with values [value4, value2]
  // Intersection: B (value2) - should be placed first in result
  const lhsValues = [iteratorA, iteratorB, iteratorC]
  const rhsValues = [iteratorD, iteratorB]

  // Order by intersection
  const [lhsOrdered, rhsOrdered] = IteratorValueAccessor.alignForComparison(lhsValues, rhsValues, 'comprehensive')

  // Verify the matching iterator is first in both arrays
  t.is(lhsOrdered[0], iteratorB, 'Intersecting iterator should be first in LHS result')
  t.is(rhsOrdered[0], iteratorB, 'Intersecting iterator should be first in RHS result')

  // Verify non-intersecting values maintain their relative order
  t.is(lhsOrdered[1], iteratorA, 'Non-intersecting iterator A should maintain its relative position')
  t.is(lhsOrdered[2], iteratorC, 'Non-intersecting iterator C should maintain its relative position')
  t.is(rhsOrdered[1], iteratorD, 'Non-intersecting iterator D should maintain its relative position')
})

test('IteratorValueAccessor.alignForComparison drops non-intersecting lhs values in fuzzy mode', (t) => {
  const value1 = new StringRepresentation('value1')
  const value2 = new StringRepresentation('value2')
  const value3 = new StringRepresentation('value3')
  const value4 = new StringRepresentation('value4')

  const iteratorA = new IteratorValueAccessor(0, value1)
  const iteratorB = new IteratorValueAccessor(1, value2)
  const iteratorC = new IteratorValueAccessor(2, value3)
  const iteratorD = new IteratorValueAccessor(3, value4)

  // LHS: [A, B, C] with values [value1, value2, value3]
  // RHS: [D, B] with values [value4, value2]
  // Intersection: B (value2) - should be placed first in result
  const lhsValues = [iteratorA, iteratorB, iteratorC]
  const rhsValues = [iteratorD, iteratorB]

  // Order by intersection in fuzzy mode
  const [lhsOrdered, rhsOrdered] = IteratorValueAccessor.alignForComparison(lhsValues, rhsValues, 'fuzzy')

  // Verify the matching iterator is first in both arrays
  t.is(lhsOrdered[0], iteratorB, 'Intersecting iterator should be first in LHS result')
  t.is(rhsOrdered[0], iteratorB, 'Intersecting iterator should be first in RHS result')

  // Verify non-intersecting lhs values are dropped in fuzzy mode
  t.is(lhsOrdered.length, 1, 'LHS should only contain intersecting values in fuzzy mode')

  // Verify non-intersecting rhs values maintain their position
  t.is(rhsOrdered[1], iteratorD, 'Non-intersecting iterator D should maintain its relative position')
})

test('IteratorValueGroup - constructor sets values array', (t) => {
  const value1 = new IteratorValueAccessor(0, new StringRepresentation('value1'))
  const value2 = new IteratorValueAccessor(1, new StringRepresentation('value2'))

  const group = new IteratorValueGroup([value1, value2])

  const values = [...group]
  t.is(values.length, 2)
  t.is(values[0], value1)
  t.is(values[1], value2)
})

test('IteratorValueGroup.is correctly identifies instances', (t) => {
  const value = new IteratorValueAccessor(0, new StringRepresentation('value'))
  const group = new IteratorValueGroup([value])

  t.true(IteratorValueGroup.is(group))
  t.false(IteratorValueGroup.is(value))
  t.false(IteratorValueGroup.is(new StringRepresentation('not a group')))
})

test('IteratorValueGroup - compare returns comparable for another IteratorValueGroup', (t) => {
  const value1 = new IteratorValueAccessor(0, new StringRepresentation('value1'))
  const value2 = new IteratorValueAccessor(1, new StringRepresentation('value2'))

  const group1 = new IteratorValueGroup([value1])
  const group2 = new IteratorValueGroup([value2])

  t.is(group1.compare(group2), comparable)
})

test('IteratorValueGroup - compare returns unequal for non-IteratorValueGroup', (t) => {
  const value = new IteratorValueAccessor(0, new StringRepresentation('value'))
  const group = new IteratorValueGroup([value])

  t.is(group.compare(value), unequal)
})

test('IteratorValueGroup - compare returns unequal for different lengths', (t) => {
  const value1 = new IteratorValueAccessor(0, new StringRepresentation('value1'))
  const value2 = new IteratorValueAccessor(1, new StringRepresentation('value2'))

  const group1 = new IteratorValueGroup([value1])
  const group2 = new IteratorValueGroup([value1, value2])

  t.is(group1.compare(group2), unequal)
})

test('IteratorValueGroup - deserialized property returns false for empty group and checks first value when present', (t) => {
  const emptyGroup = new IteratorValueGroup([])
  t.false(emptyGroup.deserialized)

  const arrayValue = representValue([])
  const deserializedArrayValue = deserialize(serialize(arrayValue))

  const normalIterator = new IteratorValueAccessor(0, arrayValue)
  const deserializedIterator = new IteratorValueAccessor(1, deserializedArrayValue)

  const normalGroup = new IteratorValueGroup([normalIterator])
  const deserializedGroup = new IteratorValueGroup([deserializedIterator])

  t.false(normalGroup.deserialized)
  t.true(deserializedGroup.deserialized)
})

test('IteratorValueGroup - align reorders values based on intersection', (t) => {
  const value1 = new StringRepresentation('value1')
  const value2 = new StringRepresentation('value2')
  const value3 = new StringRepresentation('value3')

  const iteratorA = new IteratorValueAccessor(0, value1)
  const iteratorB = new IteratorValueAccessor(1, value2)
  const iteratorC = new IteratorValueAccessor(2, value3)

  // Create groups with different orders
  const group1 = new IteratorValueGroup([iteratorA, iteratorB])
  const group2 = new IteratorValueGroup([iteratorB, iteratorC])

  // Before alignment
  const values1Before = [...group1]
  const values2Before = [...group2]
  t.is(values1Before[0], iteratorA)
  t.is(values1Before[1], iteratorB)
  t.is(values2Before[0], iteratorB)
  t.is(values2Before[1], iteratorC)

  // Align groups
  group1.align(group2, 'comprehensive')

  // After alignment, intersecting values should be first
  const values1After = [...group1]
  const values2After = [...group2]

  // Group1 should have iteratorB first (intersection), then iteratorA
  t.is(values1After[0], iteratorB)
  t.is(values1After[1], iteratorA)

  // Group2 should have iteratorB first (intersection), then iteratorC
  t.is(values2After[0], iteratorB)
  t.is(values2After[1], iteratorC)
})

test('IteratorValueGroup - align does nothing when other is not an IteratorValueGroup', (t) => {
  const value = new IteratorValueAccessor(0, new StringRepresentation('value'))
  const group = new IteratorValueGroup([value])
  const nonGroup = new StringRepresentation('notgroup')

  const originalValues = [...group]

  group.align(nonGroup, 'comprehensive')

  // Should remain unchanged
  const newValues = [...group]
  t.is(newValues.length, originalValues.length)
  t.is(newValues[0], originalValues[0])
})

test('IteratorValueGroup - align drops non-intersecting lhs values in fuzzy mode', (t) => {
  const value1 = new StringRepresentation('value1')
  const value2 = new StringRepresentation('value2')
  const value3 = new StringRepresentation('value3')

  const iteratorA = new IteratorValueAccessor(0, value1)
  const iteratorB = new IteratorValueAccessor(1, value2)
  const iteratorC = new IteratorValueAccessor(2, value3)

  // Only iteratorB intersects between the groups
  const group1 = new IteratorValueGroup([iteratorA, iteratorB])
  const group2 = new IteratorValueGroup([iteratorB, iteratorC])

  group1.align(group2, 'fuzzy')

  const values1After = [...group1]
  const values2After = [...group2]

  // Group1 should only contain iteratorB (intersection) in fuzzy mode
  t.is(values1After.length, 1)
  t.is(values1After[0], iteratorB)

  // Group2 should have iteratorB first, then iteratorC
  t.is(values2After.length, 2)
  t.is(values2After[0], iteratorB)
  t.is(values2After[1], iteratorC)
})

test('IteratorValueGroup - acceptsComparisonFrom returns true for IteratorValueGroup', (t) => {
  const value1 = new StringRepresentation('value1')
  const value2 = new StringRepresentation('value2')
  const iteratorValue1 = new IteratorValueAccessor(0, value1)
  const iteratorValue2 = new IteratorValueAccessor(1, value2)
  const group1 = new IteratorValueGroup([iteratorValue1])
  const group2 = new IteratorValueGroup([iteratorValue2])

  t.true(group1.acceptsComparisonFrom(group2))
})

test('IteratorValueGroup - acceptsComparisonFrom returns false for non-IteratorValueGroup', (t) => {
  const value = new StringRepresentation('value')
  const iteratorValue = new IteratorValueAccessor(0, value)
  const group = new IteratorValueGroup([iteratorValue])
  const stringRep = new StringRepresentation('other')

  t.false(group.acceptsComparisonFrom(stringRep))
})
