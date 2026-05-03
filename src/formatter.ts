import assert from 'node:assert'
import never from 'never'
import type { Theme } from './theme.ts'

const lineMarker = Symbol('lineMarker')

type AccumulatedValue = number | string | typeof lineMarker

// Type for paths that lead to objects in the theme
type WrappableThemePath = {
  [K in keyof Theme]: Theme[K] extends Record<string, unknown> ? K : never
}[keyof Theme]

// Type for theme paths that have standard open/close properties
type OpenCloseThemePath = {
  [K in keyof Theme]: Theme[K] extends { open: string; close: string } ? K : never
}[keyof Theme]

// Type for theme paths that need explicit property names
type CustomWrappableThemePath = Exclude<WrappableThemePath, OpenCloseThemePath>

// Get valid property names for a specific theme path
type ThemePathProperties<P extends WrappableThemePath> = keyof Theme[P] & string

export class Formatter {
  static readonly lineMarker: typeof lineMarker = lineMarker
  static readonly #indentations = Object.create(null) as Record<number, string> // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion

  readonly #accumulator: Array<AccumulatedValue | Iterable<AccumulatedValue>> = []
  readonly #depth: number
  readonly #maxDepth: number
  readonly #theme: Theme
  #closed = false
  #prefixAccumulator?: AccumulatedValue[]

  constructor(theme: Theme, depth = 1, maxDepth = Number.MAX_SAFE_INTEGER) {
    this.#theme = theme
    this.#depth = depth
    this.#maxDepth = maxDepth
  }

  get empty(): boolean {
    return this.#accumulator.length === 0
  }

  get maxDepthReached(): boolean {
    return this.#depth >= this.#maxDepth
  }

  get theme(): Theme {
    return this.#theme
  }

  close(value?: string): this {
    assert.ok(!this.#closed, 'Formatter is already closed')
    this.#closed = true

    if (value !== undefined) {
      this.#accumulator.push(Math.max(this.#depth - 1, 0), value)
    }

    return this
  }

  *[Symbol.iterator](): Generator<AccumulatedValue> {
    assert.ok(this.#closed, 'Formatter is not closed')
    yield this.#depth // Always yield the depth first, so following items are indented correctly
    for (const item of this.#accumulator) {
      if (typeof item === 'object') {
        yield* item
        yield this.#depth // Yield the depth again to ensure correct indentation for remaining items
      } else {
        yield item
      }
    }
  }

  /** Call on the parent formatter to obtain a new formatter one level deeper. */
  open(): Formatter {
    assert.ok(!this.#closed, 'Formatter is closed')
    const result = new Formatter(this.#theme, this.#depth + 1, this.#maxDepth)
    this.#accumulator.push(result[Symbol.iterator]())
    return result
  }

  append(...values: Array<Exclude<AccumulatedValue, number>>): this {
    assert.ok(!this.#closed, 'Formatter is closed')
    this.#accumulator.push(...values)
    return this
  }

  prepend(...values: Array<Exclude<AccumulatedValue, number>>): this {
    assert.ok(!this.#closed, 'Formatter is closed')
    this.#accumulator.unshift(...values)
    return this
  }

  prefix(...values: Array<Exclude<AccumulatedValue, number>>): this {
    assert.ok(!this.#closed, 'Formatter is closed')
    if (this.#prefixAccumulator === undefined) {
      this.#prefixAccumulator = []
      this.#accumulator.unshift(this.#prefixAccumulator[Symbol.iterator]())
    }

    this.#prefixAccumulator.push(...values)
    return this
  }

  /**
   * Encode the string like it was an identifier.
   *
   * That is, escape certain whitespace and control characters, as well as quotes and other non-identifier characters.
   * The result can then be rendered in places where typical values are identifiers, like constructor names.
   */
  encodeTypicalIdentifier(value: string): string {
    return value.replaceAll(/[^\p{L}\p{Nl}\p{Mn}\p{Mc}\p{Nd}\p{Pc}_$␛]/gu, (match) => {
      // Use simple escapes for common characters
      const codePoint = match.codePointAt(0) ?? never()
      switch (codePoint) {
        case 0: {
          return String.raw`\0`
        }

        case 8: {
          return String.raw`\b`
        }

        case 12: {
          return String.raw`\f`
        }

        case 10: {
          return String.raw`\n`
        }

        case 13: {
          return String.raw`\r`
        }

        case 9: {
          return String.raw`\t`
        }

        case 11: {
          return String.raw`\v`
        }

        case 27: {
          return '␛' // ANSI escape code needs escaping in case the theme uses ANSI codes for styling.
        }

        case 34: {
          return String.raw`\"`
        }

        case 39: {
          return String.raw`\'`
        }

        case 92: {
          return '\\\\'
        }

        default: {
          break
        }
      }

      // Use \u notation for BMP characters (0-FFFF)
      if (codePoint <= 0xff_ff) {
        return String.raw`\u${codePoint.toString(16).padStart(4, '0')}`
      }

      // Use \u{...} notation for astral symbols
      return String.raw`\u{${codePoint.toString(16)}}`
    })
  }

  /**
   * Encode the string so it can be rendered in a string context, on a single line.
   *
   * That is, escape certain whitespace and control characters, as well as quotes. The result can then be rendered in
   * places where typical values are simple strings, like symbol descriptions and property names, while still being able
   * to represent adverserial strings containing ANSI escape codes or linebreaks.
   */
  encodeTypicalSimpleString(value: string): string {
    // eslint-disable-next-line no-control-regex
    return value.replaceAll(/[\u0000-\u001F\u007F-\u009F\\\t\v\f\r\n'"\u001B␛]/g, (match) => {
      // Use simple escapes for common characters
      const codePoint = match.codePointAt(0) ?? never()
      switch (codePoint) {
        case 0: {
          return String.raw`\0`
        }

        case 8: {
          return String.raw`\b`
        }

        case 9: {
          return String.raw`\t`
        }

        case 10: {
          return String.raw`\n`
        }

        case 11: {
          return String.raw`\v`
        }

        case 12: {
          return String.raw`\f`
        }

        case 13: {
          return String.raw`\r`
        }

        case 27: {
          return '␛' // ANSI escape code needs escaping in case the theme uses ANSI codes for styling.
        }

        case 34: {
          return String.raw`\"`
        }

        case 39: {
          return String.raw`\'`
        }

        case 92: {
          return '\\\\'
        }

        default: {
          // Handle other control characters and non-visible characters. This also escapes ␛ which is
          // reserved for replacing the corresponding control character.
          return String.raw`\u${codePoint.toString(16).padStart(4, '0')}`
        }
      }
    })
  }

  wrap<P extends OpenCloseThemePath>(
    themePath: P,
    value?: string,
    openProperty?: 'open',
    closeProperty?: 'close',
  ): string
  wrap<P extends CustomWrappableThemePath, O extends ThemePathProperties<P>, C extends ThemePathProperties<P>>(
    themePath: P,
    value: string,
    openProperty: O,
    closeProperty: C,
  ): string
  wrap<P extends WrappableThemePath, O extends ThemePathProperties<P>, C extends ThemePathProperties<P>>(
    themePath: P,
    value = '',
    openProperty?: O,
    closeProperty?: C,
  ): string {
    const { [openProperty ?? 'open']: open, [closeProperty ?? 'close']: close } = this.#theme[themePath]
    return `${open as string}${value}${close as string}` // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
  }

  appendWrapped<P extends OpenCloseThemePath>(
    themePath: P,
    value?: string,
    openProperty?: 'open',
    closeProperty?: 'close',
  ): this
  appendWrapped<P extends CustomWrappableThemePath, O extends ThemePathProperties<P>, C extends ThemePathProperties<P>>(
    themePath: P,
    value: string,
    openProperty: O,
    closeProperty: C,
  ): this
  appendWrapped<P extends WrappableThemePath, O extends ThemePathProperties<P>, C extends ThemePathProperties<P>>(
    themePath: P,
    value = '',
    openProperty?: O,
    closeProperty?: C,
  ): this {
    const { [openProperty ?? 'open']: open, [closeProperty ?? 'close']: close } = this.#theme[themePath]
    return this.append(`${open as string}${value}${close as string}`) // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
  }

  prefixWrapped<P extends OpenCloseThemePath>(
    themePath: P,
    value?: string,
    openProperty?: 'open',
    closeProperty?: 'close',
  ): this
  prefixWrapped<P extends CustomWrappableThemePath, O extends ThemePathProperties<P>, C extends ThemePathProperties<P>>(
    themePath: P,
    value: string,
    openProperty: O,
    closeProperty: C,
  ): this
  prefixWrapped<P extends WrappableThemePath, O extends ThemePathProperties<P>, C extends ThemePathProperties<P>>(
    themePath: P,
    value = '',
    openProperty?: O,
    closeProperty?: C,
  ): this {
    const { [openProperty ?? 'open']: open, [closeProperty ?? 'close']: close } = this.#theme[themePath]
    return this.prefix(`${open as string}${value}${close as string}`) // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion
  }

  render(): string {
    assert.ok(this.#closed, 'Formatter is not closed')

    let result = ''
    let currentIndent = ''
    let shouldIndentNext = false

    // Process all items in the accumulator
    for (const item of this) {
      if (typeof item === 'number') {
        // Numbers set the indentation level for subsequent content
        Formatter.#indentations[item] ??= this.#theme.indent.repeat(item)
        currentIndent = Formatter.#indentations[item]
      } else if (typeof item === 'string') {
        if (shouldIndentNext && item !== '') {
          // Indent the string if the previous item was a line marker
          result += currentIndent + item
          shouldIndentNext = false
        } else {
          // Append the string directly
          result += item
        }
      } else if (item === lineMarker) {
        // Line marker outputs the newline value and marks next string for indentation
        result += this.#theme.newline
        shouldIndentNext = true
      }
    }

    return result
  }
}
