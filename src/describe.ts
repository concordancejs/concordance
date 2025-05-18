import type { ValueRepresentation } from './value.js'
import { DescriptionContext } from './description-context.ts'

export function describe(value: unknown): ValueRepresentation {
  return new DescriptionContext().represent(value)
}
