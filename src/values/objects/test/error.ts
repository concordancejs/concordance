import test from 'ava'
import { DescriptionContext } from '../../../describe.ts'
import { Encoder } from '../../../serialize.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { ErrorRepresentation } from '../error.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { NamedPropertyGroup, NamedPropertyAccessor } from '../../../accessors/property.ts'

// Deserialize method test
test('deserialize creates a comparable ErrorRepresentation', (t) => {
  const originalContext = new DescriptionContext()
  const error = new Error('Test error')
  const original = originalContext.represent(error) as ErrorRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ErrorRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized), comparable)
})

// Compare method tests - ErrorRepresentation inherits all comparison logic
test('compare returns strictlyEqual when comparing the same error instance', (t) => {
  const context = new DescriptionContext()
  const error = new Error('Test error')

  const errorRep1 = context.represent(error) as ErrorRepresentation
  const errorRep2 = context.represent(error) as ErrorRepresentation

  t.is(errorRep1.compare(errorRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-ErrorRepresentation', (t) => {
  const context = new DescriptionContext()
  const error = new Error('Test error')
  const obj = {}

  const errorRep = context.represent(error) as ErrorRepresentation
  const objRep = context.represent(obj)

  t.is(errorRep.compare(objRep), unequal)
})

test('compare returns comparable when comparing different error instances', (t) => {
  const context = new DescriptionContext()
  const error1 = new Error('Test error')
  const error2 = new Error('Different message')

  const errorRep1 = context.represent(error1) as ErrorRepresentation
  const errorRep2 = context.represent(error2) as ErrorRepresentation

  // Should return comparable for different error instances regardless of properties
  t.is(errorRep1.compare(errorRep2), comparable)
})

// iterateArrayLike and iterateIterable tests
test('iterateArrayLike yields no elements for errors', (t) => {
  const context = new DescriptionContext()
  const error = new Error('Test error')
  const errorRep = context.represent(error) as ErrorRepresentation

  const elements = [...errorRep.iterateArrayLike()]

  t.is(elements.length, 0)
})

test('iterateIterable yields no elements for errors', (t) => {
  const context = new DescriptionContext()
  const error = new Error('Test error')
  const errorRep = context.represent(error) as ErrorRepresentation

  const iterables = [...errorRep.iterateIterable()]

  t.is(iterables.length, 0)
})

// iterateProperties test
test('iterateProperties yields name and message properties for errors', (t) => {
  const context = new DescriptionContext()
  const error = new Error('Test error')
  const errorRep = context.represent(error) as ErrorRepresentation

  const propertyGroups = [...errorRep.iterateProperties()]

  t.is(propertyGroups.length, 1)
  const [namedGroup] = propertyGroups
  t.true(namedGroup instanceof NamedPropertyGroup)

  // Check if the group contains the expected properties
  const properties = [...namedGroup!]
  t.is(properties.length, 2)

  // Create property accessors for expected properties
  const nameValue = context.represent(error.name)
  const messageValue = context.represent(error.message)

  const nameAccessor = new NamedPropertyAccessor('name', nameValue)
  const messageAccessor = new NamedPropertyAccessor('message', messageValue)

  // Find the expected properties
  const nameProperty = properties.find((prop) => {
    return nameAccessor.compare(prop) === strictlyEqual
  })

  const messageProperty = properties.find((prop) => {
    return messageAccessor.compare(prop) === strictlyEqual
  })

  // Verify that both expected properties were found
  t.truthy(nameProperty, 'name property should be present')
  t.truthy(messageProperty, 'message property should be present')
})

test('iterateProperties includes cause property when set', (t) => {
  const context = new DescriptionContext()

  // Create error with a cause using the constructor
  const causeError = new Error('Cause error')
  const error = new Error('Main error', { cause: causeError })

  const errorRep = context.represent(error) as ErrorRepresentation
  const propertyGroups = [...errorRep.iterateProperties()]

  t.is(propertyGroups.length, 1)
  const [namedGroup] = propertyGroups
  t.true(namedGroup instanceof NamedPropertyGroup)

  // With a cause set, we should have name, message, and cause properties
  const properties = [...namedGroup!]
  t.is(properties.length, 3)

  // Create property accessors for expected properties
  const nameValue = context.represent(error.name)
  const messageValue = context.represent(error.message)
  const causeValue = context.represent(error.cause)

  const nameAccessor = new NamedPropertyAccessor('name', nameValue)
  const messageAccessor = new NamedPropertyAccessor('message', messageValue)
  const causeAccessor = new NamedPropertyAccessor('cause', causeValue)

  // Find the expected properties
  const nameProperty = properties.find((prop) => {
    return nameAccessor.compare(prop) === strictlyEqual
  })

  const messageProperty = properties.find((prop) => {
    return messageAccessor.compare(prop) === strictlyEqual
  })

  const causeProperty = properties.find((prop) => {
    return causeAccessor.compare(prop) === strictlyEqual
  })

  // Verify that all expected properties were found
  t.truthy(nameProperty, 'name property should be present')
  t.truthy(messageProperty, 'message property should be present')
  t.truthy(causeProperty, 'cause property should be present')
})

test('iterateProperties includes name and message even when non-enumerable', (t) => {
  const context = new DescriptionContext()

  // Create a custom error class with non-enumerable name and message
  class CustomError extends Error {
    constructor(message: string) {
      super(message)
      // Make name and message non-enumerable
      Object.defineProperties(this, {
        name: {
          value: 'CustomError',
          enumerable: false,
        },
        message: {
          value: message,
          enumerable: false,
        },
      })
    }
  }

  const error = new CustomError('Custom error message')
  const errorRep = context.represent(error) as ErrorRepresentation

  const propertyGroups = [...errorRep.iterateProperties()]

  t.is(propertyGroups.length, 1)
  const [namedGroup] = propertyGroups
  t.true(namedGroup instanceof NamedPropertyGroup)

  // We should still see name and message properties even though they're non-enumerable
  const properties = [...namedGroup!]
  t.is(properties.length, 2)

  // Create property accessors for expected properties
  const nameValue = context.represent(error.name)
  const messageValue = context.represent(error.message)

  const nameAccessor = new NamedPropertyAccessor('name', nameValue)
  const messageAccessor = new NamedPropertyAccessor('message', messageValue)

  // Find the expected properties
  const nameProperty = properties.find((prop) => {
    return nameAccessor.compare(prop) === strictlyEqual
  })

  const messageProperty = properties.find((prop) => {
    return messageAccessor.compare(prop) === strictlyEqual
  })

  // Verify that both expected properties were found
  t.truthy(nameProperty, 'name property should be present')
  t.truthy(messageProperty, 'message property should be present')
})

// Serialization test
test('serialize uses error static type', (t) => {
  const context = new DescriptionContext()
  const error = new Error('Test error')
  const errorRep = context.represent(error) as ErrorRepresentation

  const encoder = new Encoder()
  errorRep.serialize(encoder)

  // Check the overall structure and type
  snapshotEncoded(t, encoder, 'error serialization')

  // Verify the static type
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.error)
})
