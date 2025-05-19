import test from 'ava'
import { ElementAccessor, SparseValueRepresentation } from '../element.ts'
import { UndefinedRepresentation } from '../../values/primitives/undefined.ts'
import { StringRepresentation } from '../../values/primitives/string.ts'
import { Encoder } from '../../encoder.ts'
import { strictlyEqual, unequal, deeplyEqual } from '../../comparison.ts'
import { partial, finished } from '../../serialization-result.ts'
import { staticTypeTable } from '../../serialization-types.ts'

// SparseValueRepresentation Tests
test('SparseValueRepresentation - compare returns strictlyEqual for other sparse values', (t) => {
  const sparse1 = new SparseValueRepresentation()
  const sparse2 = new SparseValueRepresentation()

  t.is(sparse1.compare(sparse2), strictlyEqual)
})

test('SparseValueRepresentation - compare returns deeplyEqual for undefined representations', (t) => {
  const sparse = new SparseValueRepresentation()
  const undef = new UndefinedRepresentation()

  t.is(sparse.compare(undef), deeplyEqual)
})

test('SparseValueRepresentation - compare returns unequal for other values', (t) => {
  const sparse = new SparseValueRepresentation()
  const str = new StringRepresentation('test')

  t.is(sparse.compare(str), unequal)
})

test('SparseValueRepresentation - serialize encodes as undefined', (t) => {
  const sparse = new SparseValueRepresentation()

  const encoder = new Encoder()
  const result = sparse.serialize(encoder)

  t.is(result, finished)

  // Reset the encoder and encode a real undefined
  const encoder2 = new Encoder()
  const undef = new UndefinedRepresentation()
  undef.serialize(encoder2)

  // Both should encode identically
  t.deepEqual(encoder.bytes, encoder2.bytes)
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
    [Symbol.iterator]: function* () {
      yield null
    },
  }

  t.is(element.compare(nonElement as any), unequal)
})

test('ElementAccessor - compare returns unequal for different indices', (t) => {
  const value = new StringRepresentation('test')

  const element1 = new ElementAccessor(5, value)
  const element2 = new ElementAccessor(10, value)

  t.is(element1.compare(element2), unequal)
})

test('ElementAccessor - compare delegates to value comparison when indices match', (t) => {
  const value1 = new StringRepresentation('test')
  const value2 = new StringRepresentation('different')

  const element1 = new ElementAccessor(5, value1)
  const element2 = new ElementAccessor(5, value2)

  // Should return whatever the string comparison returns (unequal in this case)
  t.is(element1.compare(element2), unequal)

  // When values are equal
  const value3 = new StringRepresentation('test')
  const element3 = new ElementAccessor(5, value3)
  t.is(element1.compare(element3), strictlyEqual)
})

test('ElementAccessor - serialize delegates to value serializeShallow if available', (t) => {
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

  const element = new ElementAccessor(5, mockValue as any)

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
    [Symbol.iterator]: function* () {
      yield null
    },
  }

  const element = new ElementAccessor(5, mockValue as any)

  const encoder = new Encoder()
  const result = element.serialize(encoder)

  t.is(result, partial)
})

test('ElementAccessor - handles complex nesting', (t) => {
  // Create a chain of element accessors
  const innerValue = new StringRepresentation('test')
  const inner = new ElementAccessor(2, innerValue)
  const outer = new ElementAccessor(1, inner)

  // Access via iteration
  const outerIteration = [...outer]
  t.is(outerIteration.length, 1)
  const innerIteration = [...(outerIteration[0] as any)]
  t.is(innerIteration.length, 1)
  t.is(innerIteration[0], innerValue)

  // Create a similar structure for comparison
  const innerValue2 = new StringRepresentation('test')
  const inner2 = new ElementAccessor(2, innerValue2)
  const outer2 = new ElementAccessor(1, inner2)

  // Deep comparison should work
  t.is(outer.compare(outer2), strictlyEqual)
})
