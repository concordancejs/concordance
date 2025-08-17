/* eslint-disable prefer-rest-params */
import test from 'ava'
import { RealValueContext } from '../../../real-value-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { ArgumentsRepresentation } from '../arguments.ts'
import type { ArrayRepresentation } from '../array.ts'
import { strictlyEqual, comparable, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'
import { ElementAccessor } from '../../../accessors/element.ts'

// Helper function to create an arguments object
function getArgumentsObject(...args: unknown[]) {
  return Reflect.apply(
    function () {
      return arguments
    },
    undefined,
    args,
  ) as IArguments
}

// Deserialize method test
test('deserialize creates an ArgumentsRepresentation from decoder data', (t) => {
  const originalContext = new RealValueContext()
  const argsObject = getArgumentsObject('a', 'b', 'c')
  const original = originalContext.represent(argsObject) as ArgumentsRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType()
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ArgumentsRepresentation.deserialize(deserializationContext, decoder)

  t.true(deserialized instanceof ArgumentsRepresentation)
})

// Never array-like
test('isArrayLike returns false for ArgumentsRepresentation', (t) => {
  const context = new RealValueContext()
  const argsObject = getArgumentsObject('a', 'b', 'c')
  const argsRep = context.represent(argsObject) as ArgumentsRepresentation
  t.false(argsRep.isArrayLike)
})

// Compare method tests - focusing on the overridden behavior
test('compare returns comparable when comparing arguments object to array with same length and elements', (t) => {
  const context = new RealValueContext({ flags: { compareArgumentsToArrays: true } })
  const argsObject = getArgumentsObject('a', 'b', 'c')
  const array = ['a', 'b', 'c']

  const argsRep = context.represent(argsObject) as ArgumentsRepresentation
  const arrayRep = context.represent(array) as ArrayRepresentation

  t.is(argsRep.compare(arrayRep, 'comprehensive'), comparable)
})

test('compare returns comparable when comparing arguments object to array with different length', (t) => {
  const context = new RealValueContext({ flags: { compareArgumentsToArrays: true } })
  const argsObject = getArgumentsObject('a', 'b', 'c')
  const array = ['a', 'b']

  const argsRep = context.represent(argsObject) as ArgumentsRepresentation
  const arrayRep = context.represent(array) as ArrayRepresentation

  t.is(argsRep.compare(arrayRep, 'comprehensive'), comparable)
})

test('compare returns unequal when comparing arguments object to array with default flags (compareArgumentsToArrays disabled)', (t) => {
  // Use default flags (no explicit configuration provided)
  const context = new RealValueContext()
  const argsObject = getArgumentsObject('a', 'b', 'c')
  const array = ['a', 'b', 'c']

  const argsRep = context.represent(argsObject) as ArgumentsRepresentation
  const arrayRep = context.represent(array) as ArrayRepresentation

  // With default flags (compareArgumentsToArrays: false), comparing arguments to array should return unequal
  t.is(argsRep.compare(arrayRep, 'comprehensive'), unequal)
})

test('compare returns unequal when comparing arguments object to array with explicitly disabled compareArgumentsToArrays flag', (t) => {
  // Explicitly disable the flag
  const context = new RealValueContext({ flags: { compareArgumentsToArrays: false } })
  const argsObject = getArgumentsObject('a', 'b', 'c')
  const array = ['a', 'b', 'c']

  const argsRep = context.represent(argsObject) as ArgumentsRepresentation
  const arrayRep = context.represent(array) as ArrayRepresentation

  // Should return unequal since the flag is explicitly disabled
  t.is(argsRep.compare(arrayRep, 'comprehensive'), unequal)
})

test('compare returns unequal when comparing to non-ArgumentsRepresentation and non-ArrayRepresentation', (t) => {
  const context = new RealValueContext()
  const argsObject = getArgumentsObject('a', 'b')
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const object = { 0: 'a', 1: 'b', length: 2 } // Array-like but not an actual array

  const argsRep = context.represent(argsObject) as ArgumentsRepresentation
  const objectRep = context.represent(object)

  t.is(argsRep.compare(objectRep, 'comprehensive'), unequal)
})

test('compare returns strictlyEqual when comparing to same instance', (t) => {
  const context = new RealValueContext()
  const argsObject = getArgumentsObject('a', 'b')

  const argsRep1 = context.represent(argsObject) as ArgumentsRepresentation
  const argsRep2 = context.represent(argsObject) as ArgumentsRepresentation

  t.is(argsRep1.compare(argsRep2, 'comprehensive'), strictlyEqual)
})

test('compare returns unequal when comparing different arguments objects with different lengths', (t) => {
  const context = new RealValueContext()
  const argsObject1 = getArgumentsObject('a', 'b', 'c')
  const argsObject2 = getArgumentsObject('a', 'b')

  const argsRep1 = context.represent(argsObject1) as ArgumentsRepresentation
  const argsRep2 = context.represent(argsObject2) as ArgumentsRepresentation

  t.is(argsRep1.compare(argsRep2, 'comprehensive'), unequal)
})

test('compare returns comparable when comparing different arguments objects with same length', (t) => {
  const context = new RealValueContext()
  const argsObject1 = getArgumentsObject('a', 'b')
  const argsObject2 = getArgumentsObject('c', 'd') // Different values but same length

  const argsRep1 = context.represent(argsObject1) as ArgumentsRepresentation
  const argsRep2 = context.represent(argsObject2) as ArgumentsRepresentation

  t.is(argsRep1.compare(argsRep2, 'comprehensive'), comparable)
})

// IterateElements tests
test('iterateElements yields elements', (t) => {
  const context = new RealValueContext()
  const argsObject = getArgumentsObject('a', 'b', 'c')
  const argsRep = context.represent(argsObject) as ArgumentsRepresentation

  const elements = [...argsRep.iterateElements()]

  t.is(elements.length, 3)
  t.true(elements[0] instanceof ElementAccessor)
  t.true(elements[1] instanceof ElementAccessor)
  t.true(elements[2] instanceof ElementAccessor)
})

// IterateIterable method test - should be a no-op
test('iterateIterable yields nothing for arguments objects', (t) => {
  const context = new RealValueContext()
  const argsObject = getArgumentsObject('a', 'b', 'c')
  const argsRep = context.represent(argsObject) as ArgumentsRepresentation

  const iterables = [...argsRep.iterateIterable()]

  t.is(iterables.length, 0)
})

// Serialization test
test('serialize uses arguments static type', (t) => {
  const context = new RealValueContext()
  const argsObject = getArgumentsObject('a', 'b', 'c')
  const argsRep = context.represent(argsObject) as ArgumentsRepresentation

  const encoder = new Encoder()
  argsRep.serialize(encoder)

  // Check that the serialized type is specifically for arguments
  snapshotEncoded(t, encoder, 'arguments object serialization')

  // Ensure the correct static type was used
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.arguments)
})

test('ArgumentsRepresentation - acceptsComparisonFrom returns true for ArgumentsRepresentation', (t) => {
  const context = new RealValueContext()
  const argsObject1 = getArgumentsObject('a', 'b', 'c')
  const argsObject2 = getArgumentsObject('x', 'y', 'z')

  const argsRep1 = context.represent(argsObject1) as ArgumentsRepresentation
  const argsRep2 = context.represent(argsObject2) as ArgumentsRepresentation

  t.true(argsRep1.acceptsComparisonFrom(argsRep2))
})

test('ArgumentsRepresentation - acceptsComparisonFrom returns false for non-ArgumentsRepresentation', (t) => {
  const context = new RealValueContext()
  const argsObject = getArgumentsObject('a', 'b', 'c')
  const argsRep = context.represent(argsObject) as ArgumentsRepresentation

  const stringRep = context.represent('test')
  const arrayRep = context.represent(['a', 'b', 'c'])

  t.false(argsRep.acceptsComparisonFrom(stringRep))
  t.false(argsRep.acceptsComparisonFrom(arrayRep))
})

// FinalFormat tests
test('finalFormat uses array brackets and no disambiguation hint by default', (t) => {
  const context = new RealValueContext()
  const argsObject = getArgumentsObject('a', 'b', 'c')
  const argsRep = context.represent(argsObject) as ArgumentsRepresentation

  const formatter = new Formatter(deriveTheme())
  argsRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use array brackets
  t.true(rendered.includes('['))
  t.true(rendered.includes(']'))

  // Should not include disambiguation hint by default
  t.false(rendered.includes('arguments object'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'arguments object default format')
})

test('finalFormat shows disambiguation hint when options.disambiguationHint is true', (t) => {
  const context = new RealValueContext()
  const argsObject = getArgumentsObject('a', 'b', 'c')
  const argsRep = context.represent(argsObject) as ArgumentsRepresentation

  const formatter = new Formatter(deriveTheme())
  argsRep.finalFormat(formatter, { disambiguationHint: true })

  const rendered = formatter.render()

  // Should use array brackets
  t.true(rendered.includes('['))
  t.true(rendered.includes(']'))

  // Should include the disambiguation hint when options.disambiguationHint is true
  t.true(rendered.includes('`arguments` object'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'arguments object with disambiguation hint')
})
