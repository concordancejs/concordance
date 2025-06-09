import { NullRepresentation } from './values/primitives/null.ts'
import { UndefinedRepresentation } from './values/primitives/undefined.ts'
import { BooleanRepresentation } from './values/primitives/boolean.ts'
import { BigIntRepresentation } from './values/primitives/bigint.ts'
import { NumberRepresentation } from './values/primitives/number.ts'
import { StringRepresentation } from './values/primitives/string.ts'
import { SymbolRepresentation } from './values/primitives/symbol.ts'
import type { Opaque, PrimitiveRepresentation } from './value.d.ts'
import type { RealValueContext } from './real-value-context.ts'

// eslint-disable-next-line @typescript-eslint/no-restricted-types
export function isPrimitive(value: unknown): value is string | number | bigint | boolean | symbol | undefined | null {
  return value === null || (typeof value !== 'object' && typeof value !== 'function')
}

export function representPrimitive(context: RealValueContext, value: unknown): PrimitiveRepresentation {
  switch (typeof value) {
    case 'bigint': {
      return new BigIntRepresentation(value)
    }

    case 'boolean': {
      return new BooleanRepresentation(value)
    }

    case 'function': {
      throw new TypeError('Not a primitive value')
    }

    case 'number': {
      return new NumberRepresentation(value)
    }

    case 'object': {
      if (value === null) {
        return new NullRepresentation()
      }

      throw new TypeError('Not a primitive value')
    }

    case 'string': {
      return new StringRepresentation(value)
    }

    case 'symbol': {
      return new SymbolRepresentation(context, value as unknown as Opaque)
    }

    case 'undefined': {
      return new UndefinedRepresentation()
    }
  }
}
