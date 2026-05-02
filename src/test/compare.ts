import { mock } from 'node:test'
import test from 'ava'
import { compare, compareRepresentations } from '../compare.ts'
import { comparable, deeplyEqual, unequal, strictlyEqual, type Comparison, type Mode } from '../comparison.ts'
import { finished, type SerializationResult } from '../serialization-result.ts'
import type {
  AccessorFunctionality,
  CommonRepresentation,
  DeepFunctionality,
  GroupRepresentation,
  ValueRepresentation,
} from '../value.ts'
import type { TakeWhile } from '../stack.ts'

// Mock ValueRepresentation implementation
class MockValueRepresentation implements CommonRepresentation, DeepFunctionality {
  children: ValueRepresentation[]
  deserialized = false
  readonly #compareResult: Comparison

  constructor(compareResult: Comparison = strictlyEqual, children: ValueRepresentation[] = []) {
    this.#compareResult = compareResult
    this.children = children
  }

  acceptsComparisonFrom(): boolean {
    // For testing, we assume all comparisons are accepted
    return true
  }

  compare(_other: ValueRepresentation, _mode: Mode): Comparison {
    return this.#compareResult
  }

  finalFormat(): never {
    throw new Error('finalFormat should not be called on MockValueRepresentation')
  }

  serialize(): SerializationResult {
    return finished
  }

  *[Symbol.iterator]() {
    yield* this.children
  }
}

// Mock Groupable ValueRepresentation for testing groupForComparison
class MockGroupableRepresentation implements CommonRepresentation, AccessorFunctionality {
  deserialized = false
  readonly #compareResult: Comparison
  readonly #groupToReturn: MockGroupRepresentation | undefined

  constructor(compareResult: Comparison = strictlyEqual, groupToReturn?: MockGroupRepresentation) {
    this.#compareResult = compareResult
    this.#groupToReturn = groupToReturn
  }

  acceptsComparisonFrom(): boolean {
    // For testing, we assume all comparisons are accepted
    return true
  }

  compare(): Comparison {
    return this.#compareResult
  }

  finalFormat(): never {
    throw new Error('finalFormat should not be called on MockGroupableRepresentation')
  }

  serialize(): SerializationResult {
    return finished
  }

  groupForComparison(takeWhile: TakeWhile, parent: ValueRepresentation, _mode: Mode): GroupRepresentation | undefined {
    if (parent instanceof MockGroupRepresentation) return undefined
    if (!this.#groupToReturn) return undefined

    // Take the relevant representations using takeWhile
    const additionalItems = [...takeWhile((value) => value instanceof MockGroupableRepresentation)]

    // Add this item and the additional items to the group
    this.#groupToReturn.children = [this, ...additionalItems]

    return this.#groupToReturn
  }

  *[Symbol.iterator](): IterableIterator<ValueRepresentation> {
    // No children to iterate over in this simplified mock
  }
}

// Mock Group representation for testing align functionality
class MockGroupRepresentation implements GroupRepresentation {
  children: MockGroupableRepresentation[]
  deserialized = false
  readonly #compareResult: Comparison

  constructor(compareResult: Comparison = comparable) {
    this.#compareResult = compareResult
    this.children = [] // Start empty, items will be added via groupForComparison
  }

  acceptsComparisonFrom(): boolean {
    // For testing, we assume all comparisons are accepted
    return true
  }

  compare(other?: ValueRepresentation): Comparison {
    // If we're comparing with another MockGroupRepresentation,
    // return unequal if either this or the other has unequal as its result
    if (
      other instanceof MockGroupRepresentation &&
      (this.#compareResult === unequal || other.#compareResult === unequal)
    ) {
      return unequal
    }

    return this.#compareResult
  }

  align(_other: ValueRepresentation, _mode: Mode): void {
    // Default implementation does nothing
    // Tests can spy on this method if needed
  }

  *[Symbol.iterator]() {
    yield* this.children
  }
}

// Tests for compare() function
test('compare returns true for same objects', (t) => {
  const object = {}
  t.true(compare(object, object).pass)
})

test('compare returns true for equal primitive values', (t) => {
  t.true(compare(1, 1).pass)
  t.true(compare('test', 'test').pass)
  t.true(compare(true, true).pass)
  t.true(compare(null, null).pass)
  t.true(compare(undefined, undefined).pass)
})

test('compare returns false when comparing different primitive values', (t) => {
  t.false(compare(1, '1').pass)
  t.false(compare(null, undefined).pass)
  t.false(compare(true, 1).pass)
})

test('compare returns false when one value is primitive and the other is not', (t) => {
  t.false(compare({}, null).pass)
  t.false(compare([], 5).pass)
  t.false(compare('string', {}).pass)
})

test('compare passes complex objects to compareDescriptors', (t) => {
  const object1 = { a: 1, b: 2 }
  const object2 = { a: 1, b: 2 }
  const result = compare(object1, object2)
  t.true(result.pass)
  t.truthy(result.actual)
  t.truthy(result.expected)
})

// Tests for compareDescriptors() function
test('compareDescriptors returns true when both value representations are deeply equal', (t) => {
  const lhs = new MockValueRepresentation(deeplyEqual)
  const rhs = new MockValueRepresentation(deeplyEqual)

  t.true(compareRepresentations(lhs, rhs))
})

test('compareDescriptors returns false when value representations are unequal', (t) => {
  const lhs = new MockValueRepresentation(unequal)
  const rhs = new MockValueRepresentation(unequal)

  t.false(compareRepresentations(lhs, rhs))
})

test('compareDescriptors handles circular references correctly', (t) => {
  // Create representations with circular references
  const lhs = new MockValueRepresentation(comparable)
  const rhs = new MockValueRepresentation(comparable)

  // Create children that reference their parents (circular reference)
  const lhsChild = new MockValueRepresentation(comparable, [lhs])
  const rhsChild = new MockValueRepresentation(comparable, [rhs])

  // Update parents to reference their children
  lhs.children = [lhsChild]
  rhs.children = [rhsChild]

  t.true(compareRepresentations(lhs, rhs))
})

test('compareDescriptors returns false when circular references are at different depths', (t) => {
  const lhs = new MockValueRepresentation(comparable)
  const rhs = new MockValueRepresentation(comparable)

  const lhsChild = new MockValueRepresentation(comparable, [lhs])
  const rhsChild = new MockValueRepresentation(comparable)
  const rhsGrandchild = new MockValueRepresentation(comparable, [rhs])

  lhs.children = [lhsChild]
  rhs.children = [rhsChild]
  rhsChild.children = [rhsGrandchild]

  t.false(compareRepresentations(lhs, rhs))
})

test('compareDescriptors returns false when only rhs has circular reference', (t) => {
  // Create representations
  const lhs = new MockValueRepresentation(comparable)
  const rhs = new MockValueRepresentation(comparable)

  // Push them on the stacks
  lhs.children = [new MockValueRepresentation(comparable)]
  rhs.children = [rhs] // Direct circular reference in rhs

  // This will trigger the branch where rhsStack.includes(rhs) is true but lhsStack.includes(lhs) is false
  t.false(compareRepresentations(lhs, rhs))
})

test('compareDescriptors handles nested value traversal correctly', (t) => {
  // Create a tree of representations
  const lhsChild1 = new MockValueRepresentation(comparable)
  const lhsChild2 = new MockValueRepresentation(comparable)
  const lhs = new MockValueRepresentation(comparable, [lhsChild1, lhsChild2])

  const rhsChild1 = new MockValueRepresentation(comparable)
  const rhsChild2 = new MockValueRepresentation(comparable)
  const rhs = new MockValueRepresentation(comparable, [rhsChild1, rhsChild2])

  t.true(compareRepresentations(lhs, rhs))
})

test('compareDescriptors returns false when one representation has more children', (t) => {
  const lhsChild = new MockValueRepresentation(comparable)
  const lhs = new MockValueRepresentation(comparable, [lhsChild])

  const rhsChild1 = new MockValueRepresentation(comparable)
  const rhsChild2 = new MockValueRepresentation(comparable)
  const rhs = new MockValueRepresentation(comparable, [rhsChild1, rhsChild2])

  t.false(compareRepresentations(lhs, rhs))
})

test('compareDescriptors returns false when children are unequal', (t) => {
  const lhsChild1 = new MockValueRepresentation(comparable)
  const lhsChild2 = new MockValueRepresentation(unequal) // This child will cause the comparison to fail
  const lhs = new MockValueRepresentation(comparable, [lhsChild1, lhsChild2])

  const rhsChild1 = new MockValueRepresentation(comparable)
  const rhsChild2 = new MockValueRepresentation(comparable)
  const rhs = new MockValueRepresentation(comparable, [rhsChild1, rhsChild2])

  t.false(compareRepresentations(lhs, rhs))
})

test('compareDescriptors gracefully handles empty iterators', (t) => {
  const lhs = new MockValueRepresentation(comparable, [])
  const rhs = new MockValueRepresentation(comparable, [])

  t.true(compareRepresentations(lhs, rhs))
})

test('compareDescriptors correctly uses groupForComparison', (t) => {
  // SUCCESS CASE: When items can be grouped and groups are comparable
  const successLhsGroup = new MockGroupRepresentation(comparable)
  const successRhsGroup = new MockGroupRepresentation(comparable)

  const successLhsItem = new MockGroupableRepresentation(comparable, successLhsGroup)
  const successRhsItem = new MockGroupableRepresentation(comparable, successRhsGroup)

  const successLhs = new MockValueRepresentation(comparable, [successLhsItem])
  const successRhs = new MockValueRepresentation(comparable, [successRhsItem])

  t.true(compareRepresentations(successLhs, successRhs), 'Should succeed when groups are comparable')

  // FAILURE CASE: Same setup but one group returns unequal
  const failureLhsGroup = new MockGroupRepresentation(comparable)
  const failureRhsGroup = new MockGroupRepresentation(unequal) // This makes it fail

  const failureLhsItem = new MockGroupableRepresentation(comparable, failureLhsGroup)
  const failureRhsItem = new MockGroupableRepresentation(comparable, failureRhsGroup)

  const failureLhs = new MockValueRepresentation(comparable, [failureLhsItem])
  const failureRhs = new MockValueRepresentation(comparable, [failureRhsItem])

  t.false(compareRepresentations(failureLhs, failureRhs), 'Should fail when one group is unequal')
})

test('compareDescriptors aligns groups', (t) => {
  const lhsGroup = new MockGroupRepresentation(comparable)
  const rhsGroup = new MockGroupRepresentation(comparable)

  // Create spies to track align calls
  const lhsAlignSpy = mock.method(lhsGroup, 'align')

  // Test direct align call
  t.is(lhsAlignSpy.mock.callCount(), 0, 'Align should not be called initially')

  // Test with comparison (align may or may not be called depending on implementation)
  const lhsItem = new MockGroupableRepresentation(comparable, lhsGroup)
  const rhsItem = new MockGroupableRepresentation(comparable, rhsGroup)

  const lhs = new MockValueRepresentation(comparable, [lhsItem])
  const rhs = new MockValueRepresentation(comparable, [rhsItem])

  t.true(compareRepresentations(lhs, rhs), 'Comparison should succeed')
  // Note: Whether align is called during comparison depends on the implementation
  t.is(lhsAlignSpy.mock.callCount(), 1, 'Align should be called once')
})

test('compareDescriptors handles asymmetric grouping', (t) => {
  // FAILURE CASE: LHS gets grouped, RHS doesn't
  const lhsGroup = new MockGroupRepresentation(comparable)
  const lhsItem = new MockGroupableRepresentation(comparable, lhsGroup) // This will be grouped
  const rhsItem = new MockGroupableRepresentation(comparable) // This won't be grouped (no group provided)

  const lhs = new MockValueRepresentation(comparable, [lhsItem])
  const rhs = new MockValueRepresentation(comparable, [rhsItem])

  t.false(compareRepresentations(lhs, rhs), 'Should fail when LHS is grouped but RHS is not')

  // FAILURE CASE: RHS gets grouped, LHS doesn't
  const rhsGroup = new MockGroupRepresentation(comparable)
  const ungroupedLhsItem = new MockGroupableRepresentation(comparable) // This won't be grouped
  const groupedRhsItem = new MockGroupableRepresentation(comparable, rhsGroup) // This will be grouped

  const ungroupgedLhs = new MockValueRepresentation(comparable, [ungroupedLhsItem])
  const groupedRhs = new MockValueRepresentation(comparable, [groupedRhsItem])

  t.false(compareRepresentations(ungroupgedLhs, groupedRhs), 'Should fail when RHS is grouped but LHS is not')
})

test('compareDescriptors passes default mode to compare, groupForComparison, and align', (t) => {
  const group = new MockGroupRepresentation(comparable)
  const groupable = new MockGroupableRepresentation(comparable, group)
  const lhs = new MockValueRepresentation(comparable, [groupable])
  const rhs = new MockValueRepresentation(comparable, [groupable])

  const compareSpy = mock.method(lhs, 'compare')
  const groupForComparisonSpy = mock.method(groupable, 'groupForComparison')
  const alignSpy = mock.method(group, 'align')

  compareRepresentations(lhs, rhs)

  t.is(compareSpy.mock.calls[0]?.arguments[1], 'comprehensive', 'compare called with default mode')
  t.is(
    groupForComparisonSpy.mock.calls[0]?.arguments[2],
    'comprehensive',
    'groupForComparison called with default mode',
  )
  t.is(alignSpy.mock.calls[0]?.arguments[1], 'comprehensive', 'align called with default mode')
})

test('compareDescriptors forwards explicit mode to compare, groupForComparison, and align', (t) => {
  const group = new MockGroupRepresentation(comparable)
  const groupable = new MockGroupableRepresentation(comparable, group)
  const lhs = new MockValueRepresentation(comparable, [groupable])
  const rhs = new MockValueRepresentation(comparable, [groupable])

  const compareSpy = mock.method(lhs, 'compare')
  const groupForComparisonSpy = mock.method(groupable, 'groupForComparison')
  const alignSpy = mock.method(group, 'align')

  compareRepresentations(lhs, rhs, 'fuzzy')

  t.is(compareSpy.mock.calls[0]?.arguments[1], 'fuzzy', 'compare called with explicit mode')
  t.is(groupForComparisonSpy.mock.calls[0]?.arguments[2], 'fuzzy', 'groupForComparison called with explicit mode')
  t.is(alignSpy.mock.calls[0]?.arguments[1], 'fuzzy', 'align called with explicit mode')
})

// Tests for fuzzy comparison mode
// In fuzzy mode:
// - Objects: Only intersecting properties are compared (actual can have extra properties)
// - Sets/Maps: Only intersecting elements are compared, but all expected elements must exist in actual
// - Arrays: Ordered, but actual may have more elements than expected (prefix matching)
// - Order doesn't matter for Sets, Maps, and object properties

test('fuzzy: object properties - subset matching', (t) => {
  // Expected has subset of actual properties - should pass
  const actual = { a: 1, b: 2, c: 3 }
  const expected = { a: 1, c: 3 }

  t.true(compare(actual, expected, { mode: 'fuzzy' }).pass)
  t.false(compare(expected, actual, { mode: 'fuzzy' }).pass) // Reversed should fail
})

test('fuzzy: object properties - missing property in actual', (t) => {
  // Expected has property not in actual - should fail
  const actual = { a: 1, b: 2 }
  const expected = { a: 1, c: 3 }

  t.false(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: object properties - value mismatch', (t) => {
  // Expected property has different value - should fail
  const actual = { a: 1, b: 2 }
  const expected = { a: 1, b: 3 }

  t.false(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: symbol properties - subset matching', (t) => {
  // Expected has subset of actual symbol properties - should pass
  const sym1 = Symbol('sym1')
  const sym2 = Symbol('sym2')
  const sym3 = Symbol('sym3')

  const actual = { [sym1]: 'value1', [sym2]: 'value2', [sym3]: 'value3' }
  const expected = { [sym1]: 'value1', [sym3]: 'value3' }

  t.true(compare(actual, expected, { mode: 'fuzzy' }).pass)
  t.false(compare(expected, actual, { mode: 'fuzzy' }).pass) // Reversed should fail
})

test('fuzzy: symbol properties - missing symbol in actual', (t) => {
  // Expected has symbol not in actual - should fail
  const sym1 = Symbol('sym1')
  const sym2 = Symbol('sym2')
  const sym3 = Symbol('sym3')

  const actual = { [sym1]: 'value1', [sym2]: 'value2' }
  const expected = { [sym1]: 'value1', [sym3]: 'value3' }

  t.false(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: Set values - subset matching', (t) => {
  // Only intersection of values should be compared
  const actual = new Set([1, 2, 3, 4])
  const expected = new Set([2, 4]) // Only these values will be compared

  t.true(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: Set values - missing value in actual', (t) => {
  // Expected has value not in actual - should fail
  const actual = new Set([1, 2, 3])
  const expected = new Set([1, 4]) // 4 is not in actual

  t.false(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: Set values - unordered matching', (t) => {
  // Order shouldn't matter in Sets
  const actual = new Set([1, 2, 3, 4])
  const expected = new Set([4, 2]) // Different order, subset of actual

  t.true(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: Map entries - subset matching', (t) => {
  // Expected has subset of actual Map entries - should pass
  const actual = new Map([
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ])
  const expected = new Map([
    ['a', 1],
    ['c', 3],
  ]) // Subset of actual

  t.true(compare(actual, expected, { mode: 'fuzzy' }).pass)
  t.false(compare(expected, actual, { mode: 'fuzzy' }).pass) // Reversed should fail
})

test('fuzzy: Map entries - missing key in actual', (t) => {
  // Expected has key not in actual - should fail
  const actual = new Map([
    ['a', 1],
    ['b', 2],
  ])
  const expected = new Map([
    ['a', 1],
    ['c', 3],
  ]) // 'c' key not in actual

  t.false(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: Map entries - key exists but value differs', (t) => {
  // Expected has same key but different value - should fail
  const actual = new Map([
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ])
  const expected = new Map([
    ['a', 1],
    ['b', 99],
  ]) // 'b' has different value

  t.false(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: Map entries - unordered matching', (t) => {
  // Order shouldn't matter in Maps
  const actual = new Map([
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ])
  const expected = new Map([
    ['c', 3],
    ['a', 1],
  ]) // Different order, subset of actual

  t.true(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: nested objects - subset matching', (t) => {
  // Expected has subset at multiple nesting levels - should pass
  const actual = {
    level1: {
      a: 1,
      b: 2,
      level2: {
        x: 10,
        y: 20,
        z: 30,
      },
    },
    other: 'value',
  }

  const expected = {
    level1: {
      a: 1,
      level2: {
        x: 10,
        z: 30,
      },
    },
  }

  t.true(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: nested objects - missing nested property', (t) => {
  // Expected has property not in actual at nested level - should fail
  const actual = {
    level1: {
      a: 1,
      level2: {
        x: 10,
        y: 20,
      },
    },
  }

  const expected = {
    level1: {
      a: 1,
      level2: {
        x: 10,
        z: 30, // This property doesn't exist in actual
      },
    },
  }

  t.false(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: nested structures with Sets and Maps', (t) => {
  // Complex nested structure with objects, Sets, and Maps
  const actual = {
    data: new Set([1, 2, 3]),
    mapping: new Map([
      ['key1', 'value1'],
      ['key2', 'value2'],
      ['key3', 'value3'],
    ]),
    nested: {
      innerSet: new Set(['a', 'b', 'c']),
      innerMap: new Map([
        [1, 'one'],
        [2, 'two'],
        [3, 'three'],
      ]),
    },
    extra: 'ignored',
  }

  const expected = {
    data: new Set([2, 3]), // Subset of actual Set
    mapping: new Map([
      ['key1', 'value1'],
      ['key3', 'value3'],
    ]), // Subset of actual Map
    nested: {
      innerSet: new Set(['a', 'c']), // Subset of actual inner Set
      innerMap: new Map([
        [1, 'one'],
        [3, 'three'],
      ]), // Subset of actual inner Map
    },
  }

  t.true(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: arrays are treated as ordered structures', (t) => {
  // Arrays should still be treated as ordered, not like Sets
  const actual = [1, 2, 3, 4]
  const expected = [1, 3, 2, 4] // Unequal elements at index 1 and 2

  t.false(compare(actual, expected, { mode: 'fuzzy' }).pass)
})

test('fuzzy: primitives use exact comparison', (t) => {
  // Primitive values should use exact comparison regardless of mode
  t.true(compare(42, 42, { mode: 'fuzzy' }).pass)
  t.false(compare(42, 43, { mode: 'fuzzy' }).pass)
  t.false(compare('hello', 'world', { mode: 'fuzzy' }).pass)
  t.true(compare(null, null, { mode: 'fuzzy' }).pass)
  t.false(compare(null, undefined, { mode: 'fuzzy' }).pass)
})

test('fuzzy: edge case - empty expected structures', (t) => {
  // Empty expected should match any actual (vacuous truth)
  t.true(compare({ a: 1, b: 2 }, {}, { mode: 'fuzzy' }).pass)
  t.true(compare(new Set([1, 2, 3]), new Set(), { mode: 'fuzzy' }).pass)
  t.true(compare(new Map([['a', 1]]), new Map(), { mode: 'fuzzy' }).pass)
})

test('fuzzy: edge case - identical structures', (t) => {
  // Identical structures should always pass
  const structure = {
    obj: { a: 1, b: 2 },
    set: new Set([1, 2, 3]),
    map: new Map([
      ['x', 10],
      ['y', 20],
    ]),
  }

  t.true(compare(structure, structure, { mode: 'fuzzy' }).pass)

  // Deep copy should also pass
  const copy = {
    obj: { a: 1, b: 2 },
    set: new Set([1, 2, 3]),
    map: new Map([
      ['x', 10],
      ['y', 20],
    ]),
  }

  t.true(compare(structure, copy, { mode: 'fuzzy' }).pass)
})

test('fuzzy: arrays - actual longer than expected passes', (t) => {
  // Fuzzy mode allows actual to have more elements than expected (prefix matching)
  t.true(compare([1, 2, 3, 4], [1, 2, 3], { mode: 'fuzzy' }).pass)
  t.true(compare([1, 2, 3, 4, 5], [1, 2], { mode: 'fuzzy' }).pass)

  // Same length still passes
  t.true(compare([1, 2, 3], [1, 2, 3], { mode: 'fuzzy' }).pass)
})

test('fuzzy: arrays - actual shorter than expected fails', (t) => {
  // Actual has fewer elements than expected - should fail even in fuzzy mode
  t.false(compare([1, 2, 3], [1, 2, 3, 4], { mode: 'fuzzy' }).pass)
  t.false(compare([], [1], { mode: 'fuzzy' }).pass)
})

test('fuzzy: arrays - element mismatch fails even when actual is longer', (t) => {
  // Actual is longer but a compared element differs - should still fail
  t.false(compare([1, 9, 3, 4], [1, 2, 3], { mode: 'fuzzy' }).pass)
  t.false(compare([99, 2, 3, 4], [1, 2, 3], { mode: 'fuzzy' }).pass)
})

test('fuzzy: object properties - no intersection fails', (t) => {
  // Expected properties have no overlap with actual properties - should fail
  t.false(compare({ a: 1, b: 2 }, { c: 3, d: 4 }, { mode: 'fuzzy' }).pass)

  // Empty actual with non-empty expected also fails
  t.false(compare({}, { a: 1 }, { mode: 'fuzzy' }).pass)
})

test('fuzzy: class instances - constructor check is bypassed', (t) => {
  class Fruit {
    name: string // eslint-disable-line @typescript-eslint/parameter-properties
    color: string // eslint-disable-line @typescript-eslint/parameter-properties
    constructor(name: string, color: string) {
      this.name = name
      this.color = color
    }
  }

  // In fuzzy mode, comparing a class instance against a plain object subset passes
  t.true(compare(new Fruit('apple', 'red'), { name: 'apple' }, { mode: 'fuzzy' }).pass)
  t.true(compare(new Fruit('apple', 'red'), { name: 'apple', color: 'red' }, { mode: 'fuzzy' }).pass)

  // Reversed: plain actual vs class expected fails when expected has properties not in actual
  t.false(compare({ name: 'apple' }, new Fruit('apple', 'red'), { mode: 'fuzzy' }).pass)

  // Two instances of the same class compare normally
  t.true(compare(new Fruit('apple', 'red'), new Fruit('apple', 'red'), { mode: 'fuzzy' }).pass)
  t.false(compare(new Fruit('apple', 'red'), new Fruit('apple', 'green'), { mode: 'fuzzy' }).pass)

  // In comprehensive mode the same plain-object comparison fails due to constructor mismatch
  t.false(compare(new Fruit('apple', 'red'), { name: 'apple' }, { mode: 'comprehensive' }).pass)
})
