import test from 'ava'
import { Stack } from '../stack.ts'
import { ObjectRepresentation } from '../values/objects/object.ts'
import { RealValueContext } from '../real-value-context.ts'
import type { ValueRepresentation } from '../value.d.ts'
import { Encoder } from '../encoder.ts'
import { staticTypeTable } from '../serialization-types.ts'
import { Decoder } from '../decoder.ts'
import { DeserializationContext } from '../deserialization-context.ts'
import { NamedPropertyAccessor } from '../accessors/property.ts'

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

test('takeWhile throws when stack is empty', (t) => {
  const stack = new Stack()
  t.throws(
    () => {
      stack.takeWhile((value): value is ObjectRepresentation => value instanceof ObjectRepresentation)
    },
    { message: 'Stack is empty' },
  )
})

test('takeWhile yields values while condition is true', (t) => {
  const stack = new Stack()

  // Create an object with multiple properties to iterate over
  const testObject = { a: 1, b: 2, c: 3 }
  const objectRepresentation = new ObjectRepresentation(new RealValueContext(), testObject)
  stack.push(objectRepresentation)

  // Take the first 2 values (should be property representations)
  let count = 0
  const condition = (_value: ValueRepresentation): _value is ValueRepresentation => {
    count++
    return count <= 2
  }

  const iterator = stack.takeWhile(condition)
  const results = [...iterator]

  t.is(results.length, 2)
  t.truthy(results[0])
  t.truthy(results[1])

  // There should be one more value available
  const remaining = stack.iterateNext()
  t.truthy(remaining)

  // And then it should be exhausted
  t.is(stack.iterateNext(), undefined)
})

test('takeWhile returns empty iterator when condition is false immediately', (t) => {
  const stack = new Stack()

  const testObject = { a: 1, b: 2 }
  const objectRepresentation = new ObjectRepresentation(new RealValueContext(), testObject)
  stack.push(objectRepresentation)

  // Condition that never matches
  const condition = (_value: ValueRepresentation): _value is never => false
  const iterator = stack.takeWhile(condition)

  const results = [...iterator]
  t.is(results.length, 0)

  // The first value should still be available
  const first = stack.peekNext()
  t.truthy(first)
})

test('takeWhile stops when stack top changes', (t) => {
  const stack = new Stack()

  const testObject = { a: 1, b: 2 }
  const objectRepresentation = new ObjectRepresentation(new RealValueContext(), testObject)
  stack.push(objectRepresentation)

  const condition = (_value: ValueRepresentation): _value is ValueRepresentation => true
  const iterator = stack.takeWhile(condition)

  // Get first value
  const firstResult = iterator.next()
  t.false(firstResult.done)
  t.truthy(firstResult.value)

  // Change the stack by popping
  stack.pop()

  // Iterator should now be done even though condition would match
  const secondResult = iterator.next()
  t.true(secondResult.done)
})

test('takeWhile fully deserializes yielded values', (t) => {
  const encoder = new Encoder()

  // First value: Complex nested object that requires full deserialization
  encoder
    .staticType(staticTypeTable.object)
    .annotations({ p: 1 })
    // Named property: 'foo'
    .staticType(staticTypeTable.namedPropertyAspect)
    .string('foo')
    // Value: Simple string
    .staticType(staticTypeTable.string)
    .string('bar')
    // Named property: 'nested'
    .staticType(staticTypeTable.namedPropertyAspect)
    .string('nested')
    // Value: Another object
    .staticType(staticTypeTable.object)
    .annotations({ p: 2 })
    // Named property: 'items'
    .staticType(staticTypeTable.namedPropertyAspect)
    .string('items')
    // Value: Array with multiple elements
    .staticType(staticTypeTable.array)
    .annotations({ p: 3 })
    // Element 0
    .staticType(staticTypeTable.elementAspect)
    .staticType(staticTypeTable.string)
    .string('first')
    // Element 1
    .staticType(staticTypeTable.elementAspect)
    .staticType(staticTypeTable.string)
    .string('second')
    .staticType(staticTypeTable.terminator) // End array
    .staticType(staticTypeTable.terminator) // End nested object
    .staticType(staticTypeTable.terminator) // End root object

  const decoder = new Decoder(encoder.bytes)
  const context = new DeserializationContext(decoder)

  const representation = context.next()!
  const stack = new Stack()
  stack.push(representation)
  const condition = (value: ValueRepresentation): value is NamedPropertyAccessor => {
    return NamedPropertyAccessor.is(value)
  }

  // Expect only two properties if takeWhile() fully deserialized each yielded value. If not, we should see three,
  // since the 'items' property would be attributed to the root object instead of the nested object.
  const properties = [...stack.takeWhile(condition)]
  t.is(properties.length, 2) // 'foo' and 'nested'
})
