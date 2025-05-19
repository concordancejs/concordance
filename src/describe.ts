import type { ValueRepresentation } from './value.js'
import { DescriptionContext } from './description-context.ts'
import type { Flags } from './flags.ts'

export type DescribeOptions = {
  flags?: Partial<Flags>
}

export function describe(value: unknown, options?: DescribeOptions): ValueRepresentation {
  return new DescriptionContext(options).represent(value)
}
