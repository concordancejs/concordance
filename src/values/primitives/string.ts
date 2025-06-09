import never from 'never'
import { type Comparison, strictlyEqual, unequal } from '../../comparison.ts'
import type { Decoder } from '../../decoder.ts'
import type { Encoder } from '../../encoder.ts'
import { staticTypeTable } from '../../serialization-types.ts'
import { type ShallowSerializationResult, finished } from '../../serialization-result.ts'
import type {
  CommonRepresentation,
  PrimitiveRepresentation,
  ShallowFunctionality,
  ValueRepresentation,
} from '../../value.d.ts'
import { Formatter } from '../../formatter.ts'

const controlPictures = new Map<string, string>([
  ['\r\n', '␍␊'],
  ['\n', '␊'],
  ['\r', '␍'],
])

export class StringRepresentation implements CommonRepresentation, ShallowFunctionality {
  static deserialize(decoder: Decoder): StringRepresentation {
    return new this(decoder.string())
  }

  static is(other: ValueRepresentation): other is StringRepresentation {
    return #value in other
  }

  readonly #value: string

  constructor(value: string) {
    this.#value = value
  }

  get deserialized() {
    return false
  }

  compare(other: ValueRepresentation): Comparison {
    return #value in other && this.#value === other.#value ? strictlyEqual : unequal
  }

  formatTypicalIdentifier(formatter: Formatter, method: 'append' | 'prepend' | 'prefix' = 'append'): void {
    formatter[method](formatter.encodeTypicalIdentifier(this.#value))
  }

  formatRaw(formatter: Formatter, method: 'append' | 'prepend' | 'prefix' = 'append'): void {
    formatter[method](this.#value)
  }

  formatShallow(formatter: Formatter): void {
    const tokens = this.#value.split(/(\r\n|\r|\n)/)
    const lineTheme = formatter.theme.string[tokens.length > 1 ? 'multiline' : 'line']
    formatter.append(lineTheme.open)
    for (const token of tokens) {
      // Visualize typical linebreaks using control pictures.
      if (controlPictures.has(token)) {
        formatter.appendWrapped('string.controlPicture', controlPictures.get(token) ?? never())
        formatter.append(Formatter.lineMarker)
        continue
      }

      const string = token
        // eslint-disable-next-line no-control-regex
        .replaceAll(/[\u0000-\u001F\u007F-\u009F\\\t\v\f\u001B\u241B\u240A\u240D]/g, (match) => {
          const codePoint = match.codePointAt(0) ?? never()
          switch (codePoint) {
            // Use simple escapes for common characters
            case 0: {
              return String.raw`\0`
            }

            case 8: {
              return String.raw`\b`
            }

            case 9: {
              return String.raw`\t`
            }

            case 11: {
              return String.raw`\v`
            }

            case 12: {
              return String.raw`\f`
            }

            case 27: {
              return '␛' // ANSI escape code needs escaping in case the theme uses ANSI codes for styling.
            }

            case 92: {
              return '\\\\'
            }

            default: {
              // Handle other control characters and non-visible characters. This also escapes ␛, ␊ and ␍ as these are
              // reserved for replacing the corresponding control characters.
              return `\\u${codePoint.toString(16).padStart(4, '0')}`
            }
          }
        })
        .replaceAll(lineTheme.escapeQuote, `\\${lineTheme.escapeQuote}`)
      formatter.append(string)
    }

    formatter.append(lineTheme.close)
  }

  serializeShallow(encoder: Encoder): ShallowSerializationResult {
    encoder.staticType(staticTypeTable.string).string(this.#value)
    return finished
  }
}

void (StringRepresentation satisfies new (
  ...arguments_: ConstructorParameters<typeof StringRepresentation>
) => PrimitiveRepresentation)
