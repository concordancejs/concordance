import test from 'ava'
import { IteratorValueAccessor } from '../iterator-value.ts'
import { StringRepresentation } from '../../values/primitives/string.ts'
import { NumberRepresentation } from '../../values/primitives/number.ts'
import { Encoder } from '../../encoder.ts'
import { strictlyEqual, unequal } from '../../comparison.ts'
import { partial, finished } from '../../serialization-result.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { Formatter } from '../../formatter.ts'
import { deriveTheme } from '../../theme.ts'

// Test constructor and basic properties
test('constructor sets index and value, which iterator yields', (t) => {
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

// Test is static method
test('is correctly identifies IteratorValueAccessor instances', (t) => {
  const value = new StringRepresentation('test')
  const iteratorValue = new IteratorValueAccessor(0, value)

  t.true(IteratorValueAccessor.is(iteratorValue))
  t.false(IteratorValueAccessor.is({}))
  t.false(IteratorValueAccessor.is(value))
})

// Test compare
test('compare returns unequal for non-IteratorValueAccessor', (t) => {
  const value = new StringRepresentation('test')
  const iteratorValue = new IteratorValueAccessor(5, value)

  const nonIteratorValue = {
    compare: () => strictlyEqual,
    serialize: () => finished,
    [Symbol.iterator]: function* () {
      yield null
    },
  }

  t.is(iteratorValue.compare(nonIteratorValue as any), unequal)
})

test('compare returns unequal for different indices', (t) => {
  const value = new StringRepresentation('test')

  const iteratorValue1 = new IteratorValueAccessor(5, value)
  const iteratorValue2 = new IteratorValueAccessor(10, value)

  t.is(iteratorValue1.compare(iteratorValue2), unequal)
})

test('compare delegates to value comparison when indices match', (t) => {
  const value1 = new StringRepresentation('test')
  const value2 = new StringRepresentation('different')

  const iteratorValue1 = new IteratorValueAccessor(5, value1)
  const iteratorValue2 = new IteratorValueAccessor(5, value2)

  // Should return whatever the string comparison returns (unequal in this case)
  t.is(iteratorValue1.compare(iteratorValue2), unequal)

  // When values are equal
  const value3 = new StringRepresentation('test')
  const iteratorValue3 = new IteratorValueAccessor(5, value3)
  t.is(iteratorValue1.compare(iteratorValue3), strictlyEqual)
})

// Test serialize
test('serialize delegates to value serializeShallow if available', (t) => {
  // Create a mock value with serializeShallow
  const mockValue = {
    compare: () => strictlyEqual,
    serialize: () => partial,
    serializeShallow: (encoder: Encoder) => {
      encoder.staticType(staticTypeTable.string)
      return finished
    },
    [Symbol.iterator]: function* () {
      yield null
    },
  }

  const iteratorValue = new IteratorValueAccessor(5, mockValue as any)

  const encoder = new Encoder()
  const result = iteratorValue.serialize(encoder)

  t.is(result, finished)
  t.is(encoder.bytes[0], staticTypeTable.string)
})

test('serialize returns partial when value has no serializeShallow', (t) => {
  // Create a mock value without serializeShallow
  const mockValue = {
    compare: () => strictlyEqual,
    serialize: () => finished,
    [Symbol.iterator]: function* () {
      yield null
    },
  }

  const iteratorValue = new IteratorValueAccessor(5, mockValue as any)

  const encoder = new Encoder()
  const result = iteratorValue.serialize(encoder)

  t.is(result, partial)
})

// Test with real values
test('works with primitive values', (t) => {
  const numValue = new NumberRepresentation(42)
  const iteratorValue = new IteratorValueAccessor(0, numValue)

  // Iteration
  const values = [...iteratorValue]
  t.is(values.length, 1)
  t.is(values[0], numValue)

  // Comparison
  const iteratorValue2 = new IteratorValueAccessor(0, new NumberRepresentation(42))
  t.is(iteratorValue.compare(iteratorValue2), strictlyEqual)

  const iteratorValue3 = new IteratorValueAccessor(0, new NumberRepresentation(43))
  t.is(iteratorValue.compare(iteratorValue3), unequal)
})

test('handles nested iterator values', (t) => {
  // Create a chain of iterator values
  const innerValue = new StringRepresentation('test')
  const inner = new IteratorValueAccessor(2, innerValue)
  const outer = new IteratorValueAccessor(1, inner)

  // Access via iteration
  const outerIteration = [...outer]
  t.is(outerIteration.length, 1)
  const innerIteration = [...(outerIteration[0] as any)]
  t.is(innerIteration.length, 1)
  t.is(innerIteration[0], innerValue)

  // Create a similar structure for comparison
  const innerValue2 = new StringRepresentation('test')
  const inner2 = new IteratorValueAccessor(2, innerValue2)
  const outer2 = new IteratorValueAccessor(1, inner2)

  // Deep comparison should work
  t.is(outer.compare(outer2), strictlyEqual)
})

// Test finalFormat
test('finalFormat appends theme.iteratorValue.after to formatter', (t) => {
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
