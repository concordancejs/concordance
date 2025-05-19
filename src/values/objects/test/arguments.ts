import test from 'ava'
import { DescriptionContext } from '../../../description-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { ArgumentsRepresentation } from '../arguments.ts'
import { ArrayRepresentation } from '../array.ts'
import { strictlyEqual, comparable, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'

// Helper function to create an arguments object
function getArgumentsObject(...args: unknown[]) {
  return Reflect.apply(
    function () {
      return arguments
    },
    undefined,
    args,
  )
}

// Deserialize method test
test('deserialize creates an ArgumentsRepresentation from decoder data', (t) => {
  const originalContext = new DescriptionContext()
  const argsObj = getArgumentsObject('a', 'b', 'c')
  const original = originalContext.represent(argsObj) as ArgumentsRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType()
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ArgumentsRepresentation.deserialize(deserializationContext, decoder)

  t.true(deserialized instanceof ArgumentsRepresentation)
})

// Compare method tests - focusing on the overridden behavior
test('compare returns comparable when comparing arguments object to array with same length and elements', (t) => {
  const context = new DescriptionContext({ flags: { compareArgumentsToArrays: true } })
  const argsObj = getArgumentsObject('a', 'b', 'c')
  const array = ['a', 'b', 'c']

  const argsRep = context.represent(argsObj) as ArgumentsRepresentation
  const arrayRep = context.represent(array) as ArrayRepresentation

  t.is(argsRep.compare(arrayRep), comparable)
})

test('compare returns unequal when comparing arguments object to array with different length', (t) => {
  const context = new DescriptionContext({ flags: { compareArgumentsToArrays: true } })
  const argsObj = getArgumentsObject('a', 'b', 'c')
  const array = ['a', 'b']

  const argsRep = context.represent(argsObj) as ArgumentsRepresentation
  const arrayRep = context.represent(array) as ArrayRepresentation

  t.is(argsRep.compare(arrayRep), unequal)
})

test('compare returns unequal when comparing arguments object to array with default flags (compareArgumentsToArrays disabled)', (t) => {
  // Use default flags (no explicit configuration provided)
  const context = new DescriptionContext()
  const argsObj = getArgumentsObject('a', 'b', 'c')
  const array = ['a', 'b', 'c']

  const argsRep = context.represent(argsObj) as ArgumentsRepresentation
  const arrayRep = context.represent(array) as ArrayRepresentation

  // With default flags (compareArgumentsToArrays: false), comparing arguments to array should return unequal
  t.is(argsRep.compare(arrayRep), unequal)
})

test('compare returns unequal when comparing arguments object to array with explicitly disabled compareArgumentsToArrays flag', (t) => {
  // Explicitly disable the flag
  const context = new DescriptionContext({ flags: { compareArgumentsToArrays: false } })
  const argsObj = getArgumentsObject('a', 'b', 'c')
  const array = ['a', 'b', 'c']

  const argsRep = context.represent(argsObj) as ArgumentsRepresentation
  const arrayRep = context.represent(array) as ArrayRepresentation

  // Should return unequal since the flag is explicitly disabled
  t.is(argsRep.compare(arrayRep), unequal)
})

test('compare returns unequal when comparing to non-ArgumentsRepresentation and non-ArrayRepresentation', (t) => {
  const context = new DescriptionContext()
  const argsObj = getArgumentsObject('a', 'b')
  const obj = { 0: 'a', 1: 'b', length: 2 } // array-like but not an actual array

  const argsRep = context.represent(argsObj) as ArgumentsRepresentation
  const objRep = context.represent(obj)

  t.is(argsRep.compare(objRep), unequal)
})

test('compare returns strictlyEqual when comparing to same instance', (t) => {
  const context = new DescriptionContext()
  const argsObj = getArgumentsObject('a', 'b')

  const argsRep1 = context.represent(argsObj) as ArgumentsRepresentation
  const argsRep2 = context.represent(argsObj) as ArgumentsRepresentation

  t.is(argsRep1.compare(argsRep2), strictlyEqual)
})

test('compare returns unequal when comparing different arguments objects with different lengths', (t) => {
  const context = new DescriptionContext()
  const argsObj1 = getArgumentsObject('a', 'b', 'c')
  const argsObj2 = getArgumentsObject('a', 'b')

  const argsRep1 = context.represent(argsObj1) as ArgumentsRepresentation
  const argsRep2 = context.represent(argsObj2) as ArgumentsRepresentation

  t.is(argsRep1.compare(argsRep2), unequal)
})

test('compare returns comparable when comparing different arguments objects with same length', (t) => {
  const context = new DescriptionContext()
  const argsObj1 = getArgumentsObject('a', 'b')
  const argsObj2 = getArgumentsObject('c', 'd') // Different values but same length

  const argsRep1 = context.represent(argsObj1) as ArgumentsRepresentation
  const argsRep2 = context.represent(argsObj2) as ArgumentsRepresentation

  t.is(argsRep1.compare(argsRep2), comparable)
})

// iterateIterable method test - should be a no-op
test('iterateIterable yields nothing for arguments objects', (t) => {
  const context = new DescriptionContext()
  const argsObj = getArgumentsObject('a', 'b', 'c')
  const argsRep = context.represent(argsObj) as ArgumentsRepresentation

  const iterables = [...argsRep.iterateIterable()]

  t.is(iterables.length, 0)
})

// Serialization test
test('serialize uses arguments static type', (t) => {
  const context = new DescriptionContext()
  const argsObj = getArgumentsObject('a', 'b', 'c')
  const argsRep = context.represent(argsObj) as ArgumentsRepresentation

  const encoder = new Encoder()
  argsRep.serialize(encoder)

  // Check that the serialized type is specifically for arguments
  snapshotEncoded(t, encoder, 'arguments object serialization')

  // Ensure the correct static type was used
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.arguments)
})
