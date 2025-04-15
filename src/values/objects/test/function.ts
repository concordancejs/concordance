import test from 'ava'
import { DescriptionContext } from '../../../describe.ts'
import { Encoder } from '../../../serialize.ts'
import { Decoder, DeserializationContext } from '../../../deserialize.ts'
import { FunctionRepresentation } from '../function.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { NamedPropertyGroup, NamedPropertyAccessor } from '../../../accessors/property.ts'

// Helper functions for testing
function namedFunction() {
  return 'result'
}

// Anonymous function
const anonymousFunction = function () {
  return 'anonymous'
}

// Arrow function
const arrowFunction = () => 'arrow'

// Deserialize method test
test('deserialize creates a comparable FunctionRepresentation', (t) => {
  const originalContext = new DescriptionContext()
  const func = namedFunction
  const original = originalContext.represent(func) as FunctionRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = FunctionRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized), comparable)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same function instance', (t) => {
  const context = new DescriptionContext()
  const func = namedFunction

  const funcRep1 = context.represent(func) as FunctionRepresentation
  const funcRep2 = context.represent(func) as FunctionRepresentation

  t.is(funcRep1.compare(funcRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-FunctionRepresentation', (t) => {
  const context = new DescriptionContext()
  const func = namedFunction
  const obj = {}

  const funcRep = context.represent(func) as FunctionRepresentation
  const objRep = context.represent(obj)

  t.is(funcRep.compare(objRep), unequal)
})

test('compare returns unequal when comparing different non-deserialized function instances', (t) => {
  const context = new DescriptionContext()

  // Two different function instances that do the same thing
  function func1() {
    return 'result'
  }
  function func2() {
    return 'result'
  }

  const funcRep1 = context.represent(func1) as FunctionRepresentation
  const funcRep2 = context.represent(func2) as FunctionRepresentation

  // For non-deserialized functions, comparison is by reference only
  t.is(funcRep1.compare(funcRep2), unequal)
})

test('compare returns comparable when at least one function is deserialized', (t) => {
  const originalContext = new DescriptionContext()
  const func = namedFunction
  const original = originalContext.represent(func) as FunctionRepresentation

  // Serialize and deserialize the function
  const encoder = new Encoder()
  original.serialize(encoder)
  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = FunctionRepresentation.deserialize(deserializationContext, decoder)

  // Create a new representation of the same function
  const newContext = new DescriptionContext()
  const sameFunc = namedFunction
  const newRep = newContext.represent(sameFunc) as FunctionRepresentation

  // When one is deserialized, they should be comparable
  t.is(newRep.compare(deserialized), comparable)
})

// iterateArrayLike and iterateIterable tests
test('iterateArrayLike yields no elements for functions', (t) => {
  const context = new DescriptionContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation

  const elements = [...funcRep.iterateArrayLike()]

  t.is(elements.length, 0)
})

test('iterateIterable yields no elements for functions', (t) => {
  const context = new DescriptionContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation

  const iterables = [...funcRep.iterateIterable()]

  t.is(iterables.length, 0)
})

// iterateProperties test
test('iterateProperties yields the name property for functions', (t) => {
  const context = new DescriptionContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation

  const propertyGroups = [...funcRep.iterateProperties()]

  t.is(propertyGroups.length, 1)
  const [namedGroup] = propertyGroups
  t.true(namedGroup instanceof NamedPropertyGroup)

  // We expect just the 'name' property for functions
  const properties = [...namedGroup!]
  t.is(properties.length, 1)

  // Create property accessor for the expected property
  const nameValue = context.represent(func.name)
  const nameAccessor = new NamedPropertyAccessor('name', nameValue)

  // Find the name property
  const nameProperty = properties.find((prop) => {
    return nameAccessor.compare(prop) === strictlyEqual
  })

  // Verify that the name property was found
  t.truthy(nameProperty, 'name property should be present')
})

// Test different function types (named, anonymous, arrow)
test('iterateProperties works correctly with different function types', (t) => {
  const context = new DescriptionContext()

  // Named function
  const namedRep = context.represent(namedFunction) as FunctionRepresentation
  const namedPropertyGroups = [...namedRep.iterateProperties()]
  t.is(namedPropertyGroups.length, 1)
  const namedProperties = [...namedPropertyGroups[0]!]
  t.is(namedProperties.length, 1)

  // Create property accessor for the expected property
  const namedNameValue = context.represent(namedFunction.name)
  const namedNameAccessor = new NamedPropertyAccessor('name', namedNameValue)

  // Find and verify the name property for named function
  const namedNameProperty = namedProperties.find((prop) => {
    return namedNameAccessor.compare(prop) === strictlyEqual
  })
  t.truthy(namedNameProperty, 'name property should be present for named function')

  // Anonymous function
  const anonymousRep = context.represent(anonymousFunction) as FunctionRepresentation
  const anonymousPropertyGroups = [...anonymousRep.iterateProperties()]
  t.is(anonymousPropertyGroups.length, 1)
  const anonymousProperties = [...anonymousPropertyGroups[0]!]
  t.is(anonymousProperties.length, 1)

  // Create property accessor for the expected property
  const anonymousNameValue = context.represent(anonymousFunction.name)
  const anonymousNameAccessor = new NamedPropertyAccessor('name', anonymousNameValue)

  // Find and verify the name property for anonymous function
  const anonymousNameProperty = anonymousProperties.find((prop) => {
    return anonymousNameAccessor.compare(prop) === strictlyEqual
  })
  t.truthy(anonymousNameProperty, 'name property should be present for anonymous function')

  // Arrow function
  const arrowRep = context.represent(arrowFunction) as FunctionRepresentation
  const arrowPropertyGroups = [...arrowRep.iterateProperties()]
  t.is(arrowPropertyGroups.length, 1)
  const arrowProperties = [...arrowPropertyGroups[0]!]
  t.is(arrowProperties.length, 1)

  // Create property accessor for the expected property
  const arrowNameValue = context.represent(arrowFunction.name)
  const arrowNameAccessor = new NamedPropertyAccessor('name', arrowNameValue)

  // Find and verify the name property for arrow function
  const arrowNameProperty = arrowProperties.find((prop) => {
    return arrowNameAccessor.compare(prop) === strictlyEqual
  })
  t.truthy(arrowNameProperty, 'name property should be present for arrow function')
})

// Serialization test
test('serialize uses function static type', (t) => {
  const context = new DescriptionContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation

  const encoder = new Encoder()
  funcRep.serialize(encoder)

  // Check the overall structure and type
  snapshotEncoded(t, encoder, 'function serialization')

  // Verify the static type
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.function)
})
