import test from 'ava'
import { RealValueContext } from '../../../real-value-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { ErrorRepresentation } from '../error.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { NamedPropertyAccessor } from '../../../accessors/property.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

// Deserialize method test
test('deserialize creates a comparable ErrorRepresentation', (t) => {
  const originalContext = new RealValueContext()
  const error = new Error('Test error')
  const original = originalContext.represent(error) as ErrorRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ErrorRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized, 'comprehensive'), comparable)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same error instance', (t) => {
  const context = new RealValueContext()
  const error = new Error('Test error')

  const errorRep1 = context.represent(error) as ErrorRepresentation
  const errorRep2 = context.represent(error) as ErrorRepresentation

  t.is(errorRep1.compare(errorRep2, 'comprehensive'), strictlyEqual)
})

test('compare returns unequal when comparing to non-ErrorRepresentation in comprehensive mode', (t) => {
  const context = new RealValueContext()
  const error = new Error('Test error')
  const object = {}

  const errorRep = context.represent(error) as ErrorRepresentation
  const objectRep = context.represent(object)

  t.is(errorRep.compare(objectRep, 'comprehensive'), unequal)
})

test('compare returns comparable when comparing to non-ErrorRepresentation in fuzzy mode', (t) => {
  const context = new RealValueContext()
  const error = new Error('Test error')
  const object = {}

  const errorRep = context.represent(error) as ErrorRepresentation
  const objectRep = context.represent(object)

  t.is(errorRep.compare(objectRep, 'fuzzy'), comparable)
})

test('compare returns unequal when comparing to non-plain object in fuzzy mode', (t) => {
  const context = new RealValueContext()
  const error = new Error('Test error')

  // Create a custom class instance (not a plain object)
  class CustomClass {
    prop = 'value'
  }
  const customInstance = new CustomClass()

  const errorRep = context.represent(error) as ErrorRepresentation
  const customRep = context.represent(customInstance)

  t.is(errorRep.compare(customRep, 'fuzzy'), unequal)
})

test('compare returns comparable when comparing different error instances', (t) => {
  const context = new RealValueContext()
  const error1 = new Error('Test error')
  const error2 = new Error('Different message')

  const errorRep1 = context.represent(error1) as ErrorRepresentation
  const errorRep2 = context.represent(error2) as ErrorRepresentation

  // Should return comparable for different error instances regardless of properties
  t.is(errorRep1.compare(errorRep2, 'comprehensive'), comparable)
})

// IterateProperties test
test('iterateProperties yields name and message properties for errors', (t) => {
  const context = new RealValueContext()
  const error = new Error('Test error')
  const errorRep = context.represent(error) as ErrorRepresentation

  const properties = [...errorRep.iterateProperties()]
  t.is(properties.length, 2)

  // Create property accessors for expected properties
  const nameValue = context.represent(error.name)
  const messageValue = context.represent(error.message)

  const nameAccessor = new NamedPropertyAccessor('name', nameValue)
  const messageAccessor = new NamedPropertyAccessor('message', messageValue)

  // Find the expected properties
  const nameProperty = properties.find((prop) => {
    return nameAccessor.compare(prop, 'comprehensive') === strictlyEqual
  })

  const messageProperty = properties.find((prop) => {
    return messageAccessor.compare(prop, 'comprehensive') === strictlyEqual
  })

  // Verify that both expected properties were found
  t.truthy(nameProperty, 'name property should be present')
  t.truthy(messageProperty, 'message property should be present')
})

test('iterateProperties includes cause property when set', (t) => {
  const context = new RealValueContext()

  // Create error with a cause using the constructor
  const causeError = new Error('Cause error')
  const error = new Error('Main error', { cause: causeError })

  const errorRep = context.represent(error) as ErrorRepresentation
  const properties = [...errorRep.iterateProperties()]
  // With a cause set, we should have name, message, and cause properties
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
    return nameAccessor.compare(prop, 'comprehensive') === strictlyEqual
  })

  const messageProperty = properties.find((prop) => {
    return messageAccessor.compare(prop, 'comprehensive') === strictlyEqual
  })

  const causeProperty = properties.find((prop) => {
    return causeAccessor.compare(prop, 'comprehensive') === strictlyEqual
  })

  // Verify that all expected properties were found
  t.truthy(nameProperty, 'name property should be present')
  t.truthy(messageProperty, 'message property should be present')
  t.truthy(causeProperty, 'cause property should be present')
})

test('iterateProperties includes name and message even when non-enumerable', (t) => {
  const context = new RealValueContext()

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

  const properties = [...errorRep.iterateProperties()]
  // We should still see name and message properties even though they're non-enumerable
  t.is(properties.length, 2)

  // Create property accessors for expected properties
  const nameValue = context.represent(error.name)
  const messageValue = context.represent(error.message)

  const nameAccessor = new NamedPropertyAccessor('name', nameValue)
  const messageAccessor = new NamedPropertyAccessor('message', messageValue)

  // Find the expected properties
  const nameProperty = properties.find((prop) => {
    return nameAccessor.compare(prop, 'comprehensive') === strictlyEqual
  })

  const messageProperty = properties.find((prop) => {
    return messageAccessor.compare(prop, 'comprehensive') === strictlyEqual
  })

  // Verify that both expected properties were found
  t.truthy(nameProperty, 'name property should be present')
  t.truthy(messageProperty, 'message property should be present')
})

test('iterateProperties excludes stack property even if enumerable', (t) => {
  const context = new RealValueContext()
  const error = new Error('Test error')
  Object.defineProperty(error, 'stack', {
    value: 'fake stack',
    enumerable: true,
    configurable: true,
    writable: true,
  })

  const errorRep = context.represent(error) as ErrorRepresentation
  const properties = [...errorRep.iterateProperties()]

  // Create property accessors for unexpected properties
  const stackAccessor = new NamedPropertyAccessor('stack', context.represent('fake stack'))

  // Should NOT include stack
  t.false(
    properties.some((prop) => stackAccessor.compare(prop, 'comprehensive') === strictlyEqual),
    'stack property should NOT be present',
  )
})

test('iterateProperties includes code property even when non-enumerable', (t) => {
  const context = new RealValueContext()
  const error = new Error('Test error')
  Object.defineProperty(error, 'code', {
    value: 'E_CUSTOM',
    enumerable: false,
    configurable: true,
    writable: true,
  })

  const errorRep = context.represent(error) as ErrorRepresentation
  const properties = [...errorRep.iterateProperties()]

  // Create property accessors for expected properties
  const codeAccessor = new NamedPropertyAccessor('code', context.represent('E_CUSTOM'))

  // Should include code
  t.true(
    properties.some((prop) => codeAccessor.compare(prop, 'comprehensive') === strictlyEqual),
    'code property should be present',
  )
})

// Serialization test
test('serialize uses error static type', (t) => {
  const context = new RealValueContext()
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

// FinalFormat tests
test('finalFormat uses object brackets by default', (t) => {
  const context = new RealValueContext()
  const error = new Error('Test error')
  const errorRep = context.represent(error) as ErrorRepresentation

  const formatter = new Formatter(deriveTheme())
  errorRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should not include explicit disambiguation hint by default
  // (The constructor name "Error" will still appear as part of the default object formatting)
  t.false(rendered.includes('// Error'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'error default format')
})

test('finalFormat shows disambiguation hint when options.disambiguationHint is true', (t) => {
  const context = new RealValueContext()
  const error = new Error('Test error')
  const errorRep = context.represent(error) as ErrorRepresentation

  const formatter = new Formatter(deriveTheme())
  errorRep.finalFormat(formatter, { disambiguationHint: true })

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should include the disambiguation hint when options.disambiguationHint is true
  t.true(rendered.includes('// Error'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'error with disambiguation hint')
})

test('finalFormat handles custom error types', (t) => {
  const context = new RealValueContext()

  class CustomError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'CustomError'
    }
  }

  const error = new CustomError('Custom error message')
  const errorRep = context.represent(error) as ErrorRepresentation

  const formatter = new Formatter(deriveTheme())
  errorRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include the custom constructor name
  t.true(rendered.includes('CustomError'))

  // Snapshot the rendering
  t.snapshot(rendered, 'custom error format')
})
