import { mock } from 'node:test'
import test from 'ava'
import { compare, compareRepresentations } from '../compare.ts'
import { comparable, deeplyEqual, unequal, strictlyEqual, type Comparison } from '../comparison.ts'
import { finished, type SerializationResult } from '../serialization-result.ts'
import type {
  AccessorFunctionality,
  CommonRepresentation,
  DeepFunctionality,
  GroupRepresentation,
  ValueRepresentation,
} from '../value.ts'
import type { TakeWhile } from '../stack.ts'
import { Encoder } from '../encoder.ts'
import { staticTypeTable, version } from '../serialization-types.ts'
import { deserialize } from '../deserialize.ts'
import { representValue } from '../represent.ts'

// Mock ValueRepresentation implementation
class MockValueRepresentation implements CommonRepresentation, DeepFunctionality {
  children: ValueRepresentation[]
  deserialized = false
  readonly #compareResult: Comparison

  constructor(compareResult: Comparison = strictlyEqual, children: ValueRepresentation[] = []) {
    this.#compareResult = compareResult
    this.children = children
  }

  compare(): Comparison {
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
  static is(value: unknown): value is MockGroupableRepresentation {
    return value instanceof MockGroupableRepresentation
  }

  deserialized = false
  readonly #compareResult: Comparison
  readonly #groupToReturn: MockGroupRepresentation | undefined

  constructor(compareResult: Comparison = strictlyEqual, groupToReturn?: MockGroupRepresentation) {
    this.#compareResult = compareResult
    this.#groupToReturn = groupToReturn
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

  groupForComparison(takeWhile: TakeWhile, parent: ValueRepresentation): GroupRepresentation | undefined {
    if (MockGroupRepresentation.is(parent)) return undefined
    if (!this.#groupToReturn) return undefined

    // Take the relevant representations using takeWhile
    const additionalItems = [...takeWhile((value) => MockGroupableRepresentation.is(value))]

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
  static is(value: unknown): value is MockGroupRepresentation {
    return value instanceof MockGroupRepresentation
  }

  children: MockGroupableRepresentation[]
  deserialized = false
  readonly #compareResult: Comparison

  constructor(compareResult: Comparison = comparable) {
    this.#compareResult = compareResult
    this.children = [] // Start empty, items will be added via groupForComparison
  }

  compare(other?: ValueRepresentation): Comparison {
    // If we're comparing with another MockGroupRepresentation,
    // return unequal if either this or the other has unequal as its result
    if (MockGroupRepresentation.is(other) && (this.#compareResult === unequal || other.#compareResult === unequal)) {
      return unequal
    }

    return this.#compareResult
  }

  align(_other: ValueRepresentation): void {
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

  const ungroupedLhs = new MockValueRepresentation(comparable, [ungroupedLhsItem])
  const groupedRhs = new MockValueRepresentation(comparable, [groupedRhsItem])

  t.false(compareRepresentations(ungroupedLhs, groupedRhs), 'Should fail when RHS is grouped but LHS is not')
})

test('representations are fully deserialized before grouping', (t) => {
  // Rather than using mocks, perform an actual comparison that is expected to succeed only when full deserialization
  // is performed.
  const { bytes } = new Encoder()
    .int(version)
    .staticType(staticTypeTable.object)
    .annotations({ p: 1, c: 'Object' })
    // Add symbol property aspect
    .staticType(staticTypeTable.symbolPropertyAspect)
    // First symbol property with object value (complex enough to test fullyDeserialize)
    .staticType(staticTypeTable.symbol)
    .annotations({ s: 'Symbol(objectValue)' })
    // Object as the complex value
    .staticType(staticTypeTable.object)
    .annotations({ p: 2, c: 'Object' })
    .staticType(staticTypeTable.symbolPropertyAspect)
    // Nested symbol property
    .staticType(staticTypeTable.symbol)
    .annotations({ s: 'Symbol(nested)' })
    // Add the value (string 'nested')
    .staticType(staticTypeTable.string)
    .string('nested')
    .staticType(staticTypeTable.terminator)
    // Second symbol property with simple string value
    .staticType(staticTypeTable.symbol)
    .annotations({ s: 'Symbol(simple)' })
    .staticType(staticTypeTable.string)
    .string('simpleStringValue')
    // End symbol properties
    .staticType(staticTypeTable.terminator)

  const expected = {
    [Symbol('objectValue')]: {
      [Symbol('nested')]: 'nested',
    },
    [Symbol('simple')]: 'simpleStringValue',
  }

  const representation = representValue(expected)

  t.true(compareRepresentations(representation, deserialize(bytes)))
  t.true(compareRepresentations(deserialize(bytes), representation))
})
