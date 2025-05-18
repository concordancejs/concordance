import test from 'ava'
import { Stack } from '../stack.ts'
import { ObjectRepresentation } from '../values/objects/object.ts'
import { DescriptionContext } from '../description-context.ts'

const representation = new ObjectRepresentation(new DescriptionContext(), {})

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
  t.truthy(stack.top?.iterator)
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
  t.false(stack.includes(new ObjectRepresentation(new DescriptionContext(), {})))
})

test('indexOf returns correct index for representations in the stack', (t) => {
  const stack = new Stack()
  stack.push(representation)
  const second = new ObjectRepresentation(new DescriptionContext(), {})
  stack.push(second)
  t.is(stack.indexOf(representation), 1)
  t.is(stack.indexOf(second), 2)
  t.is(stack.indexOf(new ObjectRepresentation(new DescriptionContext(), {})), -1)
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
  const arrayLike = { 0: 'foo', 1: 'bar' }
  Object.defineProperty(arrayLike, 'length', { value: 2, enumerable: false })
  stack.push(new ObjectRepresentation(new DescriptionContext(), arrayLike))

  const next1 = stack.iterateNext() as any
  t.false(next1.done)
  t.truthy(next1.value)

  const next2 = stack.iterateNext() as any
  t.false(next2.done)
  t.truthy(next2.value)

  const next3 = stack.iterateNext()
  t.true(next3.done)
})

test('iterateNext returns done for empty stack', (t) => {
  const stack = new Stack()
  t.true(stack.iterateNext().done)
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
