import { comparable, comparableAfterAlignment, deeplyEqual, unequal, type Comparison } from './comparison.ts'
import { describe } from './describe.ts'
import { isPrimitive } from './primitives.ts'
import { Stack } from './stack.ts'
import type { ValueRepresentation } from './value.js'

export type Result = { pass: boolean; actual?: ValueRepresentation; expected?: ValueRepresentation }

export function compare(actual: unknown, expected: unknown): Result {
  if (Object.is(actual, expected)) {
    return { pass: true }
  }

  // Primitive values should be the same, so if actual or expected is primitive
  // then the values will never compare.
  if (isPrimitive(actual) || isPrimitive(expected)) {
    return { pass: false }
  }

  const lhs = describe(actual)
  const rhs = describe(expected)
  const pass = compareDescriptors(lhs, rhs)
  return { pass, actual: lhs, expected: rhs }
}

export function compareDescriptors(lhs: ValueRepresentation, rhs: ValueRepresentation): boolean {
  const lhsStack = new Stack()
  const rhsStack = new Stack()

  do {
    let result: Comparison
    // Circular references are counted when they appear when walking the object graph. Both sides need to have a
    // circular reference with the same index in order to be equal. If one side has a circular reference and the other
    // does not, then the values are unequal.
    if (lhsStack.includes(lhs)) {
      result = lhsStack.indexOf(lhs) === rhsStack.indexOf(rhs) ? deeplyEqual : unequal
    } else if (rhsStack.includes(rhs)) {
      result = unequal
    } else {
      result = lhs.compare(rhs)
    }

    if (result === unequal) return false

    if (result === comparableAfterAlignment) {
      lhs.align?.(rhs)
      lhsStack.push(lhs)
      rhsStack.push(rhs)
    }

    if (result === comparable) {
      lhsStack.push(lhs)
      rhsStack.push(rhs)
    }

    while (!lhsStack.empty) {
      const lhsNext = lhsStack.iterateNext()
      const rhsNext = rhsStack.iterateNext()
      if (lhsNext.done && rhsNext.done) {
        lhsStack.pop()
        rhsStack.pop()
        continue
      }

      if (!lhsNext.done && !rhsNext.done) {
        lhs = lhsNext.value
        rhs = rhsNext.value
        break
      }

      return false
    }
  } while (!lhsStack.empty)

  return true
}
