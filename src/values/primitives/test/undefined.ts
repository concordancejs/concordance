import test from 'ava'
import { UndefinedRepresentation } from '../undefined.ts'
import { Encoder } from '../../../encoder.ts'
import { strictlyEqual, unequal } from '../../../comparison.ts'
import { StringRepresentation } from '../string.ts'
import { NullRepresentation } from '../null.ts'
import { finished } from '../../../serialization-result.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

test('compare returns strictlyEqual for UndefinedRepresentation instances', (t) => {
  const a = new UndefinedRepresentation()
  const b = new UndefinedRepresentation()

  t.is(a.compare(b), strictlyEqual)
})

test('compare returns unequal for non-UndefinedRepresentation values', (t) => {
  const a = new UndefinedRepresentation()
  const nonUndefined = new StringRepresentation('undefined')

  t.is(a.compare(nonUndefined), unequal)
})

test('compare returns unequal for NullRepresentation', (t) => {
  const undefinedRepr = new UndefinedRepresentation()
  const nullRepr = new NullRepresentation()

  t.is(undefinedRepr.compare(nullRepr), unequal)
})

test('acceptsComparisonFrom returns true for UndefinedRepresentation', (t) => {
  const undefined1 = new UndefinedRepresentation()
  const undefined2 = new UndefinedRepresentation()

  t.true(undefined1.acceptsComparisonFrom(undefined2, 'comprehensive'))
  t.true(undefined1.acceptsComparisonFrom(undefined2, 'fuzzy'))
})

test('acceptsComparisonFrom returns false for non-UndefinedRepresentation', (t) => {
  const undefinedRep = new UndefinedRepresentation()
  const nullRep = new NullRepresentation()

  t.false(undefinedRep.acceptsComparisonFrom(nullRep, 'comprehensive'))
  t.false(undefinedRep.acceptsComparisonFrom(nullRep, 'fuzzy'))
})

test('acceptsComparisonFrom returns true for from-sparse condition', (t) => {
  const undefinedRep = new UndefinedRepresentation()
  const nullRep = new NullRepresentation()

  t.true(undefinedRep.acceptsComparisonFrom(nullRep, 'comprehensive', 'from-sparse'))
  t.true(undefinedRep.acceptsComparisonFrom(nullRep, 'fuzzy', 'from-sparse'))
})

test('serializeShallow correctly encodes an undefined value', (t) => {
  const representation = new UndefinedRepresentation()
  const encoder = new Encoder()

  const result = representation.serializeShallow(encoder)

  t.is(result, finished)
  snapshotEncoded(t, encoder)
})

test('formatShallow correctly formats undefined', (t) => {
  const representation = new UndefinedRepresentation()
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('undefined'))
})

test('deserialized property returns false for UndefinedRepresentation', (t) => {
  const representation = new UndefinedRepresentation()
  t.false(representation.deserialized)
})
