import never from 'never'
import { comparable, deeplyEqual, unequal, type Comparison } from './comparison.ts'
import { representValue } from './represent.ts'
import type { Flags } from './flags.ts'
import { isPrimitive } from './primitives.ts'
import { Stack } from './stack.ts'
import type { ValueRepresentation } from './value.d.ts'
import { fullyDeserialize } from './deserialize.ts'

export type CompareOptions = {
  flags?: Partial<Flags>
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
  const pass = compareRepresentations(lhs, rhs)
  return { pass, actual: lhs, expected: rhs }
}

// eslint-disable-next-line complexity
export function compareRepresentations(lhs: ValueRepresentation, rhs: ValueRepresentation): boolean {
  const lhsStack = new Stack()
  const rhsStack = new Stack()

  do {
    let result: Comparison | undefined
    // Circular references are counted when they appear when walking the object graph. Both sides need to have a
    // circular reference with the same index in order to be equal. If one side has a circular reference and the other
    // does not, then the values are unequal.
    if (lhsStack.includes(lhs)) {
      result = lhsStack.indexOf(lhs) === rhsStack.indexOf(rhs) ? deeplyEqual : unequal
    } else if (rhsStack.includes(rhs)) {
      result = unequal
    } else {
      let lhsGroup
      if ('groupForComparison' in lhs) {
        fullyDeserialize(lhs)
        lhsGroup = lhs.groupForComparison?.(lhsStack.takeWhile, lhsStack.top?.representation ?? never())
      }

      let rhsGroup
      if ('groupForComparison' in rhs) {
        fullyDeserialize(rhs)
        rhsGroup = rhs.groupForComparison?.(rhsStack.takeWhile, rhsStack.top?.representation ?? never())
      }

      if (lhsGroup !== undefined || rhsGroup !== undefined) {
        lhs = lhsGroup ?? lhs
        rhs = rhsGroup ?? rhs
      }

      result = lhs.compare(rhs)
      if (result === comparable && lhsGroup && rhsGroup && 'align' in lhsGroup) {
        lhsGroup.align?.(rhsGroup)
      }
    }

    if (result === unequal) return false

    if (result === comparable) {
      lhsStack.push(lhs)
      rhsStack.push(rhs)
    }

    while (!lhsStack.empty) {
      const lhsNext = lhsStack.iterateNext()
      const rhsNext = rhsStack.iterateNext()
      if (!lhsNext && !rhsNext) {
        lhsStack.pop()
        rhsStack.pop()
        continue
      }

      if (lhsNext && rhsNext) {
        lhs = lhsNext
        rhs = rhsNext
        break
      }

      return false
    }
  } while (!lhsStack.empty)

  return true
}
