import test from 'ava'
import { describe } from '../describe.ts'
import { StringRepresentation } from '../values/primitives/string.ts'
import { NumberRepresentation } from '../values/primitives/number.ts'
import { NullRepresentation } from '../values/primitives/null.ts'
import { ObjectRepresentation } from '../values/objects/object.ts'

// These tests focus on the `describe` function itself, which is a thin wrapper
// around DescriptionContext

test('describe returns correct representation types', (t) => {
  // Test a few representative examples - the main type-specific tests
  // are in description-context.ts
  t.is(describe(42).constructor, NumberRepresentation)
  t.is(describe('hello').constructor, StringRepresentation)
  t.is(describe(null).constructor, NullRepresentation)
  t.is(describe({}).constructor, ObjectRepresentation)
})
