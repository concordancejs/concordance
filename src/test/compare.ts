import test from 'ava'
import { compare, compareDescriptors } from '../compare.ts'
import {
  comparable,
  comparableAfterAlignment,
  deeplyEqual,
  unequal,
  strictlyEqual,
  type Comparison,
} from '../comparison.ts'
import { finished, type SerializationResult } from '../serialization-result.ts'
import type { ValueRepresentation } from '../value.ts'

// Mock ValueRepresentation implementation
class MockValueRepresentation {
  align?: (other: ValueRepresentation) => void
  children: ValueRepresentation[]
  readonly #compareResult: Comparison
  #aligned = false

  constructor(compareResult: Comparison = strictlyEqual, children: ValueRepresentation[] = [], hasAlign = false) {
    this.#compareResult = compareResult
    this.children = children

    if (hasAlign) {
      this.align = () => {
        this.#aligned = true
      }
    }
  }

  get aligned(): boolean {
    return this.#aligned
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

  t.true(compareDescriptors(lhs, rhs))
})

test('compareDescriptors returns false when value representations are unequal', (t) => {
  const lhs = new MockValueRepresentation(unequal)
  const rhs = new MockValueRepresentation(unequal)

  t.false(compareDescriptors(lhs, rhs))
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

  t.true(compareDescriptors(lhs, rhs))
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

  t.false(compareDescriptors(lhs, rhs))
})

test('compareDescriptors returns false when only rhs has circular reference', (t) => {
  // Create representations
  const lhs = new MockValueRepresentation(comparable)
  const rhs = new MockValueRepresentation(comparable)

  // Push them on the stacks
  lhs.children = [new MockValueRepresentation(comparable)]
  rhs.children = [rhs] // Direct circular reference in rhs

  // This will trigger the branch where rhsStack.includes(rhs) is true but lhsStack.includes(lhs) is false
  t.false(compareDescriptors(lhs, rhs))
})

test('compareDescriptors returns true when alignment is necessary', (t) => {
  const lhs = new MockValueRepresentation(comparableAfterAlignment, [], true)
  const rhs = new MockValueRepresentation(comparableAfterAlignment)

  t.true(compareDescriptors(lhs, rhs))
  t.true(lhs.aligned, 'lhs should be aligned with rhs')
})

test('compareDescriptors handles nested value traversal correctly', (t) => {
  // Create a tree of representations
  const lhsChild1 = new MockValueRepresentation(comparable)
  const lhsChild2 = new MockValueRepresentation(comparable)
  const lhs = new MockValueRepresentation(comparable, [lhsChild1, lhsChild2])

  const rhsChild1 = new MockValueRepresentation(comparable)
  const rhsChild2 = new MockValueRepresentation(comparable)
  const rhs = new MockValueRepresentation(comparable, [rhsChild1, rhsChild2])

  t.true(compareDescriptors(lhs, rhs))
})

test('compareDescriptors returns false when one representation has more children', (t) => {
  const lhsChild = new MockValueRepresentation(comparable)
  const lhs = new MockValueRepresentation(comparable, [lhsChild])

  const rhsChild1 = new MockValueRepresentation(comparable)
  const rhsChild2 = new MockValueRepresentation(comparable)
  const rhs = new MockValueRepresentation(comparable, [rhsChild1, rhsChild2])

  t.false(compareDescriptors(lhs, rhs))
})

test('compareDescriptors returns false when children are unequal', (t) => {
  const lhsChild1 = new MockValueRepresentation(comparable)
  const lhsChild2 = new MockValueRepresentation(unequal) // This child will cause the comparison to fail
  const lhs = new MockValueRepresentation(comparable, [lhsChild1, lhsChild2])

  const rhsChild1 = new MockValueRepresentation(comparable)
  const rhsChild2 = new MockValueRepresentation(comparable)
  const rhs = new MockValueRepresentation(comparable, [rhsChild1, rhsChild2])

  t.false(compareDescriptors(lhs, rhs))
})

test('compareDescriptors gracefully handles empty iterators', (t) => {
  const lhs = new MockValueRepresentation(comparable, [])
  const rhs = new MockValueRepresentation(comparable, [])

  t.true(compareDescriptors(lhs, rhs))
})
