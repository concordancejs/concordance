import { NullRepresentation } from './values/primitives/null.ts'
import { UndefinedRepresentation } from './values/primitives/undefined.ts'
import { BooleanRepresentation } from './values/primitives/boolean.ts'
import { BigIntRepresentation } from './values/primitives/bigint.ts'
import { NumberRepresentation } from './values/primitives/number.ts'
import { StringRepresentation } from './values/primitives/string.ts'
import { SymbolRepresentation } from './values/primitives/symbol.ts'
import type { ValueRepresentation } from './value.d.ts'
import type { DescriptionContext } from './description-context.ts'

export function isPrimitive(value: unknown): value is string | number | bigint | boolean | symbol | undefined | null {
  return value === null || (typeof value !== 'object' && typeof value !== 'function')
}

export function representPrimitive(context: DescriptionContext, value: unknown): ValueRepresentation {
  if (value === null) return new NullRepresentation()
  if (value === undefined) return new UndefinedRepresentation()
  if (value === true || value === false) return new BooleanRepresentation(value)

  switch (typeof value) {
    case 'bigint': {
      return new BigIntRepresentation(value)
    }

    case 'number': {
      return new NumberRepresentation(value)
    }

    case 'string': {
      return new StringRepresentation(value)
    }

    case 'symbol': {
      return new SymbolRepresentation(context, value as unknown as object)
    }

    default: {
      throw new TypeError('Not a primitive value')
    }
  }
}
