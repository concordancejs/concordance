import type { ValueRepresentation } from './value.d.ts'
import { RealValueContext } from './real-value-context.ts'
import type { Flags } from './flags.ts'

export type RepresentOptions = {
  flags?: Partial<Flags>
}

export function representValue(value: unknown, options?: RepresentOptions): ValueRepresentation {
  return new RealValueContext(options).represent(value)
}
