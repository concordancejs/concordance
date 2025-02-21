import type { ExecutionContext } from 'ava'
import { Decoder } from '../../../deserialize.ts'
import type { Encoder } from '../../../serialize.ts'

export function snapshotEncoded(t: ExecutionContext, encoder: Encoder, name?: string) {
  const suffix = name ? ' (' + name + ')' : ''
  t.snapshot(encoder.bytes, `Serialized bytes${suffix}`)
  t.snapshot(
    Array.from(new Decoder(encoder.bytes), (tuple) => tuple.slice(0, 3)),
    `Decoded bytes${suffix}`,
  )
}
