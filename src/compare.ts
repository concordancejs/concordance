import never from 'never'
import { comparable, deeplyEqual, unequal, type Comparison, type Mode } from './comparison.ts'
import { representValue } from './represent.ts'
import type { Flags } from './flags.ts'
import { isPrimitive } from './primitives.ts'
import { Stack } from './stack.ts'
import type { ValueRepresentation } from './value.d.ts'

export type CompareOptions = {
  flags?: Partial<Flags>
  mode?: Mode
}

export type Result = { pass: boolean; actual?: ValueRepresentation; expected?: ValueRepresentation }

export function compare(actual: unknown, expected: unknown, options?: CompareOptions): Result {
  if (Object.is(actual, expected)) {
    return { pass: true }
  }

  // Primitive values should be the same, so if actual or expected is primitive
  // then the values will never compare.
  if (isPrimitive(actual) || isPrimitive(expected)) {
    return { pass: false }
  }

  const lhs = representValue(actual, options)
  const rhs = representValue(expected, options)
  const pass = compareRepresentations(lhs, rhs, options?.mode)
  return { pass, actual: lhs, expected: rhs }
}

// eslint-disable-next-line complexity
export function compareRepresentations(
  lhs: ValueRepresentation,
  rhs: ValueRepresentation,
  mode: Mode = 'comprehensive',
): boolean {
  let lhsCurrent: ValueRepresentation | undefined = lhs
  let rhsCurrent: ValueRepresentation | undefined = rhs

  const lhsStack = new Stack()
  const rhsStack = new Stack()

  do {
    let result: Comparison | undefined
    // Circular references are counted when they appear when walking the object graph. Both sides need to have a
    // circular reference with the same index in order to be equal. If one side has a circular reference and the other
    // does not, then the values are unequal.
    if (lhsCurrent && lhsStack.includes(lhsCurrent)) {
      result = rhsCurrent && lhsStack.indexOf(lhsCurrent) === rhsStack.indexOf(rhsCurrent) ? deeplyEqual : unequal
    } else if (lhsCurrent && rhsCurrent && rhsStack.includes(rhsCurrent)) {
      result = unequal
    } else {
      let lhsGroup
      if (lhsCurrent && 'groupForComparison' in lhsCurrent) {
        lhsGroup = lhsCurrent.groupForComparison?.(lhsStack.takeWhile, lhsStack.top?.representation ?? never(), mode)
      }

      let rhsGroup
      if (rhsCurrent && 'groupForComparison' in rhsCurrent) {
        rhsGroup = rhsCurrent.groupForComparison?.(rhsStack.takeWhile, rhsStack.top?.representation ?? never(), mode)
      }

      lhsCurrent = lhsGroup ?? lhsCurrent
      rhsCurrent = rhsGroup ?? rhsCurrent
      if (lhsGroup && rhsGroup && 'align' in lhsGroup) {
        lhsGroup.align?.(rhsGroup, mode)
      }

      if (mode === 'comprehensive') {
        // If we are in comprehensive mode and one of the values is undefined, then we consider them unequal. This is
        // because in comprehensive mode we expect both sides to have the same structure, and undefined means that the
        // structure is not present.
        result = lhsCurrent === undefined || rhsCurrent === undefined ? unequal : lhsCurrent.compare(rhsCurrent, mode)
      } else if (mode === 'fuzzy') {
        // In fuzzy mode, only groups can shape the comparison algorithm to allow for partial and unordered matches.
        if (lhsGroup && !rhsCurrent) {
          // If we have a group on the left side, but no current value on the right side, we consider the result to be
          // deeply equal. The right side sets the partial expectation, in this case an empty one.
          //
          // N.B. We won't iterate through lhsCurrent and we assume it's already been fully deserialized.
          result = deeplyEqual
        } else if (rhsCurrent && !lhsCurrent) {
          // If we have a group *or value* on the right side, but no current value on the left, we consider the result to be
          // unequal. The right side sets the partial expectation and the left can't match it.
          result = unequal
        } else {
          result = lhsCurrent?.compare(rhsCurrent ?? never(), mode) ?? never()
        }
      }
    }

    if (result === unequal) return false

    if (result === comparable) {
      lhsStack.push(lhsCurrent ?? never())
      rhsStack.push(rhsCurrent ?? never())
    }

    while (!lhsStack.empty) {
      lhsCurrent = lhsStack.iterateNext()
      rhsCurrent = rhsStack.iterateNext()
      if (lhsCurrent !== undefined || rhsCurrent !== undefined) {
        break
      }

      lhsStack.pop()
      rhsStack.pop()
      continue
    }
  } while (!lhsStack.empty)

  return true
}
