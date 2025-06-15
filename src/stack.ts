import assert from 'node:assert'
import never from 'never'
import type { ValueRepresentation } from './value.d.ts'

type OptionalFields = Partial<Record<string, unknown>>

export type StackEntry<Fields extends OptionalFields> = Fields & {
  readonly representation: ValueRepresentation
}

type InternalEntryState = {
  readonly iterator?: IterableIterator<ValueRepresentation>
}

export class Stack<Fields extends OptionalFields = OptionalFields> {
  readonly #entries: Array<StackEntry<Fields>> = []
  readonly #internal = new WeakMap<StackEntry<Fields>, InternalEntryState>()
  readonly #values = new Map<ValueRepresentation, number>()

  get empty() {
    return this.#entries.length === 0
  }

  get top(): StackEntry<Fields> | undefined {
    return this.#entries.at(-1)
  }

  push(representation: ValueRepresentation, fields?: Fields): void {
    assert.ok(!this.#values.has(representation), 'Already in stack')

    this.#values.set(representation, this.#values.size + 1)

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const entry = {
      representation,
      ...fields,
    } as StackEntry<Fields>
    this.#entries.push(entry)
    this.#internal.set(entry, {
      iterator: representation[Symbol.iterator]?.(),
    })
  }

  pop(): Readonly<StackEntry<Fields>> | undefined {
    const entry = this.#entries.pop()

    if (entry?.representation) {
      this.#internal.delete(entry)
      this.#values.delete(entry.representation)
    }

    return entry
  }

  includes(representation: ValueRepresentation): boolean {
    return this.#values.has(representation)
  }

  indexOf(representation: ValueRepresentation): number {
    return this.#values.get(representation) ?? -1
  }

  iterateNext(): ValueRepresentation | undefined {
    const { top } = this
    if (!top) return

    const internal = this.#internal.get(top) ?? never('Internal state not found for stack entry')
    const next = internal.iterator?.next()
    if (!next || next.done) return

    return next?.value
  }
}
