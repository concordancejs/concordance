import assert from 'node:assert'
import never from 'never'
import { Decoder } from './decoder.ts'
import { DeserializationContext } from './deserialization-context.ts'
import type { ValueRepresentation } from './value.d.ts'
import { version as expectedVersion } from './serialization-types.ts'
import type { Flags } from './flags.ts'
import { Stack } from './stack.ts'

export class UnsupportedVersion extends Error {
  readonly serializerVersion: number

  constructor(serializerVersion: number) {
    super('Could not deserialize buffer: a different serialization was expected')
    this.serializerVersion = serializerVersion
  }

  override get name() {
    return 'UnsupportedVersion'
  }
}

export type DeserializeOptions = {
  flags?: Partial<Flags>
}

export function deserialize(bytes: Uint8Array, options?: DeserializeOptions): ValueRepresentation {
  assert.ok(bytes.length > 0, 'Bytes must not be empty')

  const decoder = new Decoder(bytes)
  try {
    const version = decoder.int()
    if (version !== expectedVersion) throw new UnsupportedVersion(version)
  } catch {
    throw new UnsupportedVersion(bytes[0]!)
  }

  return new DeserializationContext(decoder, options).next() ?? never('No value was deserialized')
}

const knownFullDeserializations = new WeakSet<ValueRepresentation>()
export function fullyDeserialize<R extends ValueRepresentation>(representation: R): typeof representation {
  if (!representation.deserialized || knownFullDeserializations.has(representation)) {
    return representation
  }

  knownFullDeserializations.add(representation)
  const stack = new Stack()
  stack.push(representation)
  while (!stack.empty) {
    const next = stack.iterateNext()
    if (!next) {
      stack.pop()
      continue
    }

    if (!next.deserialized || knownFullDeserializations.has(next)) {
      continue
    }

    knownFullDeserializations.add(next)
    stack.push(next)
  }

  return representation
}
