import test from 'ava'
import { UndefinedRepresentation } from '../undefined.ts'
import { Encoder } from '../../../serialize.ts'
import { strictlyEqual, unequal } from '../../../comparison.ts'
import { StringRepresentation } from '../string.ts'
import { NullRepresentation } from '../null.ts'
import { finished } from '../../../serialization-result.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'

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
  const undefined = new UndefinedRepresentation()
  const null_ = new NullRepresentation()

  t.is(undefined.compare(null_), unequal)
})

test('static is() correctly identifies UndefinedRepresentation instances', (t) => {
  const undefined = new UndefinedRepresentation()
  const string = new StringRepresentation('undefined')
  const null_ = new NullRepresentation()

  t.true(UndefinedRepresentation.is(undefined))
  t.false(UndefinedRepresentation.is(string))
  t.false(UndefinedRepresentation.is(null_))
})

test('serializeShallow correctly encodes an undefined value', (t) => {
  const representation = new UndefinedRepresentation()
  const encoder = new Encoder()

  const result = representation.serializeShallow(encoder)

  t.is(result, finished)
  snapshotEncoded(t, encoder)
})

test('serialize calls serializeShallow', (t) => {
  const representation = new UndefinedRepresentation()
  const encoder = new Encoder()

  const result = representation.serialize(encoder)

  t.is(result, finished)

  const encoder2 = new Encoder()
  representation.serializeShallow(encoder2)
  t.deepEqual(encoder.bytes, encoder2.bytes)
})
