import test from 'ava'
import { NullRepresentation } from '../null.ts'
import { Encoder } from '../../../encoder.ts'
import { strictlyEqual, unequal } from '../../../comparison.ts'
import { StringRepresentation } from '../string.ts'
import { finished } from '../../../serialization-result.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

test('compare returns strictlyEqual for NullRepresentation instances', (t) => {
  const a = new NullRepresentation()
  const b = new NullRepresentation()

  t.is(a.compare(b), strictlyEqual)
})

test('compare returns unequal for non-NullRepresentation values', (t) => {
  const a = new NullRepresentation()
  const nonNull = new StringRepresentation('null')

  t.is(a.compare(nonNull), unequal)
})

test('serializeShallow correctly encodes a null value', (t) => {
  const representation = new NullRepresentation()
  const encoder = new Encoder()

  const result = representation.serializeShallow(encoder)

  t.is(result, finished)
  snapshotEncoded(t, encoder)
})

test('formatShallow correctly formats null', (t) => {
  const representation = new NullRepresentation()
  const formatter = new Formatter(deriveTheme())

  representation.formatShallow(formatter)
  formatter.close()

  const rendered = formatter.render()
  t.snapshot(rendered)
  t.true(rendered.includes('null'))
})
