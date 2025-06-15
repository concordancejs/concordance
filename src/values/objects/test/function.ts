import { mock } from 'node:test'
import test from 'ava'
import { RealValueContext } from '../../../real-value-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { FunctionRepresentation } from '../function.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { NamedPropertyAccessor } from '../../../accessors/property.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'
import type { StringRepresentation } from '../../primitives/string.ts'

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
  const originalContext = new RealValueContext()
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
  const context = new RealValueContext()
  const func = namedFunction

  const funcRep1 = context.represent(func) as FunctionRepresentation
  const funcRep2 = context.represent(func) as FunctionRepresentation

  t.is(funcRep1.compare(funcRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-FunctionRepresentation', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  const object = {}

  const funcRep = context.represent(func) as FunctionRepresentation
  const objectRep = context.represent(object)

  t.is(funcRep.compare(objectRep), unequal)
})

test('compare returns unequal when comparing different non-deserialized function instances', (t) => {
  const context = new RealValueContext()

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
  const originalContext = new RealValueContext()
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
  const newContext = new RealValueContext()
  const sameFunc = namedFunction
  const newRep = newContext.represent(sameFunc) as FunctionRepresentation

  // When one is deserialized, they should be comparable
  t.is(newRep.compare(deserialized), comparable)
})

// IterateArrayLike and iterateIterable tests
test('iterateArrayLike yields no elements for functions', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation

  const elements = [...funcRep.iterateArrayLike()]

  t.is(elements.length, 0)
})

test('iterateIterable yields no elements for functions', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation

  const iterables = [...funcRep.iterateIterable()]

  t.is(iterables.length, 0)
})

// IterateProperties test
test('iterateProperties yields the name property for functions', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation

  // We expect just the 'name' property for functions
  const properties = [...funcRep.iterateProperties()]
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
  const context = new RealValueContext()

  // Named function
  const namedRep = context.represent(namedFunction) as FunctionRepresentation
  const namedProperties = [...namedRep.iterateProperties()]
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
  const anonymousProperties = [...anonymousRep.iterateProperties()]
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
  const arrowProperties = [...arrowRep.iterateProperties()]
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
  const context = new RealValueContext()
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

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function injectNameProperty(context: RealValueContext, funcRep: FunctionRepresentation, func: Function) {
  const { mock: notifyNextExplicitlyNamedPropertyAccess } = mock.method(
    context,
    'notifyNextExplicitlyNamedPropertyAccess',
  )

  // Call preformat to set up the internal state
  funcRep.preformat()

  // Create mock properties for name
  const nameValue = context.represent(func.name) as StringRepresentation
  const nameProperty = new NamedPropertyAccessor('name', nameValue)

  // Inject the name property into the internal state by calling the callback directly
  // The callback is stored in the third argument of the notifyNextExplicitlyNamedPropertyAccess call
  const callback = notifyNextExplicitlyNamedPropertyAccess.calls[0]!.arguments[2]
  callback(nameProperty, nameValue)

  return nameProperty
}

// Preformat test
test('preformat performs setup only', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation

  const formatter = new Formatter(deriveTheme())
  funcRep.preformat()

  t.true(formatter.empty)
})

// ShouldFormatNamedProperty test
test('shouldFormatNamedProperty returns false for name property', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation

  const nameProperty = injectNameProperty(context, funcRep, func)

  t.false(funcRep.shouldFormatNamedProperty(nameProperty), 'Name property should not be formatted separately')
  t.true(
    funcRep.shouldFormatNamedProperty(new NamedPropertyAccessor('other', context.represent('value'))),
    'Other property should be formatted separately',
  )
})

// FinalFormat tests
test('finalFormat renders function notation correctly', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation
  const formatter = new Formatter(deriveTheme())

  injectNameProperty(context, funcRep, func)

  // Call finalFormat to render the function
  funcRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include the function name
  t.true(rendered.includes('Function namedFunction'), 'Function should include name')

  // Should have empty curly braces for a simple function
  t.true(rendered.includes('{}'), 'Simple function should have empty curly braces')

  // Should not include disambiguation hint by default
  t.false(rendered.includes('// Function'), 'Should not include disambiguation hint by default')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'function notation default format')
})

test('finalFormat includes disambiguation hint when options.disambiguationHint is true', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation
  const formatter = new Formatter(deriveTheme())

  injectNameProperty(context, funcRep, func)

  // Call finalFormat with disambiguation hint option
  funcRep.finalFormat(formatter, { disambiguationHint: true })

  const rendered = formatter.render()

  // Should include the function name
  t.true(rendered.includes('Function namedFunction'), 'Function should include name')

  // Should include disambiguation hint when requested
  t.true(rendered.includes('// Function'), 'Should include disambiguation hint when requested')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'function notation with disambiguation hint')
})

test('finalFormat includes stringTag when present', (t) => {
  const context = new RealValueContext()

  // Create a local function with the same name
  function namedFunctionWithTag() {
    return 'result'
  }

  // Set up custom stringTag on the local function
  Object.defineProperties(namedFunctionWithTag, { [Symbol.toStringTag]: { value: 'CustomFunction' } })

  const funcRep = context.represent(namedFunctionWithTag) as FunctionRepresentation
  const formatter = new Formatter(deriveTheme())

  injectNameProperty(context, funcRep, namedFunctionWithTag)

  // Call finalFormat
  funcRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include the function name
  t.true(rendered.includes('Function namedFunctionWithTag'), 'Function should include name')

  // Should include the string tag
  t.true(rendered.includes('CustomFunction'), 'Should include string tag')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'function with string tag')
})

test('finalFormat renders with custom constructor name', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  mock.method(context, 'constructorName', () => 'CustomConstructor')

  const funcRep = context.represent(func) as FunctionRepresentation
  const formatter = new Formatter(deriveTheme())

  injectNameProperty(context, funcRep, func)

  // Call finalFormat
  funcRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include the custom constructor name
  t.true(rendered.includes('CustomConstructor'), 'Should include custom constructor name')

  // Should include the function name
  t.true(rendered.includes('namedFunction'), 'Function should include name')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'function with custom constructor name')
})

test('finalFormat handles empty string tag', (t) => {
  const context = new RealValueContext()

  // Create a local function with the same name
  function namedFunctionWithEmptyTag() {
    return 'result'
  }

  // Set up empty string tag
  Object.defineProperties(namedFunctionWithEmptyTag, { [Symbol.toStringTag]: { value: '' } })

  const funcRep = context.represent(namedFunctionWithEmptyTag) as FunctionRepresentation
  const formatter = new Formatter(deriveTheme())

  injectNameProperty(context, funcRep, namedFunctionWithEmptyTag)

  // Call finalFormat
  funcRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include the function name
  t.true(rendered.includes('Function namedFunctionWithEmptyTag'), 'Function should include name')

  // Should include the empty string tag notation
  t.true(rendered.includes('empty string tag'), 'Should include string tag marker')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'function with empty string tag')
})

test('finalFormat handles max depth reached', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation

  // Create formatter with max depth of 0 to immediately trigger max depth
  const formatter = new Formatter(deriveTheme(), 1, 0)

  injectNameProperty(context, funcRep, func)

  // Call finalFormat
  funcRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include the function name
  t.true(rendered.includes('Function namedFunction'), 'Function should include name')

  // Should indicate max depth reached
  t.true(rendered.includes('…'), 'Should indicate max depth reached')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'function with max depth reached')
})

test('finalFormat handles non-empty formatter', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  const funcRep = context.represent(func) as FunctionRepresentation
  const formatter = new Formatter(deriveTheme())

  // Add content to the formatter before finalizing
  formatter.append('pre-existing content')

  injectNameProperty(context, funcRep, func)

  // Call finalFormat
  funcRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include both the pre-existing content and the function
  t.true(rendered.includes('pre-existing content'), 'Should include pre-existing content')
  t.true(rendered.includes('Function namedFunction'), 'Should include function name')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'function with non-empty formatter')
})

test('finalFormat handles undefined constructor name', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  // Mock constructorName to return undefined
  mock.method(context, 'constructorName', () => undefined)

  const funcRep = context.represent(func) as FunctionRepresentation
  const formatter = new Formatter(deriveTheme())

  injectNameProperty(context, funcRep, func)

  // Call finalFormat
  funcRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use 'Function' as the fallback constructor name
  t.true(rendered.includes('Function namedFunction'), 'Should use Function as fallback constructor name')

  // Should include disambiguation hint when constructor name is undefined
  t.true(rendered.includes('// Function'), 'Should include disambiguation hint with undefined constructor')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'function with undefined constructor name')
})

test('finalFormat handles empty constructor name', (t) => {
  const context = new RealValueContext()
  const func = namedFunction
  // Mock constructorName to return an empty string
  mock.method(context, 'constructorName', () => '')

  const funcRep = context.represent(func) as FunctionRepresentation
  const formatter = new Formatter(deriveTheme())

  injectNameProperty(context, funcRep, func)

  // Call finalFormat
  funcRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use 'Function' as the fallback constructor name
  t.true(rendered.includes('Function namedFunction'), 'Should use Function as fallback constructor name')

  // Should include disambiguation hint when constructor name is empty
  t.true(rendered.includes('// Function'), 'Should include disambiguation hint with empty constructor')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'function with empty constructor name')
})
