import assert from 'node:assert'
import type { ValueRepresentation } from './value.js'

type OptionalFields = Partial<Record<string, unknown>>

export type StackEntry<Fields extends OptionalFields> = {
  readonly representation: ValueRepresentation
  readonly iterator?: IterableIterator<ValueRepresentation>
} & Fields

export class Stack<Fields extends OptionalFields = {}> {
  readonly #entries: Array<StackEntry<Fields>> = []
  readonly #values = new Map<ValueRepresentation, number>()

  get empty() {
    return this.#entries.length === 0
  }

  get top(): StackEntry<Fields> | undefined {
    return this.#entries.at(-1)
  }

  push(representation: ValueRepresentation, fields?: Fields): void {
    assert(!this.#values.has(representation), 'Already in stack')

    this.#values.set(representation, this.#values.size + 1)

    this.#entries.push({
      representation,
      iterator: representation[Symbol.iterator]?.(),
      ...fields,
    } as StackEntry<Fields>)
  }

  pop(): Readonly<StackEntry<Fields>> | undefined {
    const entry = this.#entries.pop()

    if (entry?.representation) {
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

  iterateNext(): { done: true } | { value: ValueRepresentation; done: false } {
    const next = this.top?.iterator?.next()
    if (!next || next.done) return { done: true }

    return { value: next.value, done: false }
  }
}
