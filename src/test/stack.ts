import test from 'ava'
import { Stack } from '../stack.ts'
import { ObjectRepresentation } from '../values/objects/object.ts'
import { RealValueContext } from '../real-value-context.ts'

const representation = new ObjectRepresentation(new RealValueContext(), {})

test('initializes empty', (t) => {
  const stack = new Stack()
  t.true(stack.empty)
})

test('top returns undefined for empty stack', (t) => {
  const stack = new Stack()
  t.is(stack.top, undefined)
})

test('push adds an entry to the stack', (t) => {
  const stack = new Stack()
  stack.push(representation)
  t.false(stack.empty)
  t.is(stack.top?.representation, representation)
})

test('push with fields adds fields to the entry', (t) => {
  const stack = new Stack<{ foo: string }>()
  stack.push(representation, { foo: 'bar' })
  t.is(stack.top?.foo, 'bar')
})

test('pop returns and removes the top entry', (t) => {
  const stack = new Stack()
  stack.push(representation)
  const popped = stack.pop()
  t.is(popped?.representation, representation)
  t.true(stack.empty)
})

test('pop returns undefined for empty stack', (t) => {
  const stack = new Stack()
  t.is(stack.pop(), undefined)
})

test('includes tests whether representation is in the stack', (t) => {
  const stack = new Stack()
  stack.push(representation)
  t.true(stack.includes(representation))
  t.false(stack.includes(new ObjectRepresentation(new RealValueContext(), {})))
})

test('indexOf returns correct index for representations in the stack', (t) => {
  const stack = new Stack()
  stack.push(representation)
  const second = new ObjectRepresentation(new RealValueContext(), {})
  stack.push(second)
  t.is(stack.indexOf(representation), 1)
  t.is(stack.indexOf(second), 2)
  t.is(stack.indexOf(new ObjectRepresentation(new RealValueContext(), {})), -1)
})

test('pop removes representation', (t) => {
  const stack = new Stack()
  stack.push(representation)
  t.true(stack.includes(representation))
  stack.pop()
  t.false(stack.includes(representation))
})

test('iterateNext returns next value from iterator', (t) => {
  const stack = new Stack()
  const arrayLike = { 0: 'foo', 1: 'bar' } // eslint-disable-line @typescript-eslint/naming-convention
  Object.defineProperty(arrayLike, 'length', { value: 2, enumerable: false })
  stack.push(new ObjectRepresentation(new RealValueContext(), arrayLike))

  t.truthy(stack.iterateNext()) // First value
  t.truthy(stack.iterateNext()) // Second value
  t.is(stack.iterateNext(), undefined) // No more values
})

test('iterateNext returns undefined for empty stack', (t) => {
  const stack = new Stack()
  t.is(stack.iterateNext(), undefined)
})

test('throws error when pushing already present representation', (t) => {
  const stack = new Stack()
  stack.push(representation)
  t.throws(
    () => {
      stack.push(representation)
    },
    { name: 'AssertionError', message: 'Already in stack' },
  )
})

test('peekNext returns undefined for empty stack', (t) => {
  const stack = new Stack()
  t.is(stack.peekNext(), undefined)
})

test('peekNext returns undefined when iterator is exhausted', (t) => {
  const stack = new Stack()
  const arrayLike = { 0: 'foo' } // eslint-disable-line @typescript-eslint/naming-convention
  Object.defineProperty(arrayLike, 'length', { value: 1, enumerable: false })
  stack.push(new ObjectRepresentation(new RealValueContext(), arrayLike))

  // Consume the only value
  stack.iterateNext()

  // Now peeking should return undefined
  t.is(stack.peekNext(), undefined)
})

test('peekNext and iterateNext interaction', (t) => {
  const stack = new Stack()
  const arrayLike = { 0: 'foo', 1: 'bar', 2: 'baz' } // eslint-disable-line @typescript-eslint/naming-convention
  Object.defineProperty(arrayLike, 'length', { value: 3, enumerable: false })
  stack.push(new ObjectRepresentation(new RealValueContext(), arrayLike))

  // Multiple peeks should return the same value
  const peek1 = stack.peekNext()
  const peek2 = stack.peekNext()
  t.is(peek1, peek2)

  // IterateNext should return the peeked value
  const iterated1 = stack.iterateNext()
  t.is(peek1, iterated1)

  // Peek and iterate the second value
  const peek3 = stack.peekNext()
  const iterated2 = stack.iterateNext()
  t.is(peek3, iterated2)
  t.not(iterated2, iterated1)

  // Final iteration without peeking
  const iterated3 = stack.iterateNext()
  t.truthy(iterated3)
  t.not(iterated3, iterated1)
  t.not(iterated3, iterated2)

  // Should be exhausted
  t.is(stack.iterateNext(), undefined)
  t.is(stack.peekNext(), undefined)
})
