import test from 'ava'
import { representValue } from '../represent.ts'
import { StringRepresentation } from '../values/primitives/string.ts'
import { NumberRepresentation } from '../values/primitives/number.ts'
import { NullRepresentation } from '../values/primitives/null.ts'
import { ObjectRepresentation } from '../values/objects/object.ts'

// These tests focus on the `representValue` function itself, which is a thin wrapper
// around RealValueContext

test('representValue returns correct representation types', (t) => {
  // Test a few representative examples - the main type-specific tests
  // are in real-value-context.ts
  t.is(representValue(42).constructor, NumberRepresentation)
  t.is(representValue('hello').constructor, StringRepresentation)
  t.is(representValue(null).constructor, NullRepresentation)
  t.is(representValue({}).constructor, ObjectRepresentation)
})
