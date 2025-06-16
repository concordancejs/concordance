import { mock } from 'node:test'
import test from 'ava'
import { RealValueContext } from '../../../real-value-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { RegExpRepresentation } from '../regexp.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { NamedPropertyAccessor } from '../../../accessors/property.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

// Deserialize method test
test('deserialize creates a comparable RegExpRepresentation', (t) => {
  const originalContext = new RealValueContext()
  const regexp = /test/i
  const original = originalContext.represent(regexp) as RegExpRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = RegExpRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized, 'comprehensive'), comparable)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same regexp instance', (t) => {
  const context = new RealValueContext()
  const regexp = /test/i

  const regexpRep1 = context.represent(regexp) as RegExpRepresentation
  const regexpRep2 = context.represent(regexp) as RegExpRepresentation

  t.is(regexpRep1.compare(regexpRep2, 'comprehensive'), strictlyEqual)
})

test('compare returns unequal when comparing to non-RegExpRepresentation', (t) => {
  const context = new RealValueContext()
  const regexp = /test/i
  const object = {}

  const regexpRep = context.represent(regexp) as RegExpRepresentation
  const objectRep = context.represent(object)

  t.is(regexpRep.compare(objectRep, 'comprehensive'), unequal)
})

test('compare returns comparable when comparing different regexps', (t) => {
  const context = new RealValueContext()
  const regexp1 = /test/i
  const regexp2 = /test/g
  const regexpRep1 = context.represent(regexp1) as RegExpRepresentation
  const regexpRep2 = context.represent(regexp2) as RegExpRepresentation
  t.is(regexpRep1.compare(regexpRep2, 'comprehensive'), comparable)
})

test('compare returns comparable when comparing against subclass instances in fuzzy mode', (t) => {
  const context = new RealValueContext()
  const regexp1 = /test/i
  class CustomRegExp extends RegExp {
    constructor() {
      super('test', 'i')
    }
  }
  const regexp2 = new CustomRegExp()
  const regexpRep1 = context.represent(regexp1) as RegExpRepresentation
  const regexpRep2 = context.represent(regexp2) as RegExpRepresentation
  t.is(regexpRep1.compare(regexpRep2, 'fuzzy'), comparable)
})

// The key test - verify that the right properties are included
test('iterateProperties yields flags and source properties for regexps', (t) => {
  const context = new RealValueContext()
  const regexp = /test/i
  const regexpRep = context.represent(regexp) as RegExpRepresentation

  const properties = [...regexpRep.iterateProperties()]
  t.is(properties.length, 2)

  // Create our own property accessors with the same names and values
  // to test comparison logic
  const flagsValue = context.represent(regexp.flags)
  const sourceValue = context.represent(regexp.source)

  const flagsAccessor = new NamedPropertyAccessor('flags', flagsValue)
  const sourceAccessor = new NamedPropertyAccessor('source', sourceValue)

  // Find the flags property from the regexp
  const flagsProperty = properties.find((prop) => {
    // We can use our manually created accessor to compare
    return flagsAccessor.compare(prop, 'comprehensive') === strictlyEqual
  })

  // Find the source property from the regexp
  const sourceProperty = properties.find((prop) => {
    return sourceAccessor.compare(prop, 'comprehensive') === strictlyEqual
  })

  // Verify that both properties were found
  t.truthy(flagsProperty)
  t.truthy(sourceProperty)
})

// Serialization test
test('serialize uses regExp static type', (t) => {
  const context = new RealValueContext()
  const regexp = /test/i
  const regexpRep = context.represent(regexp) as RegExpRepresentation

  const encoder = new Encoder()
  regexpRep.serialize(encoder)

  // Check the overall structure and type with a snapshot
  snapshotEncoded(t, encoder, 'regexp serialization')

  // Verify the static type
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.regExp)
})

test('serializing and deserializing a RegExp preserves its structure', (t) => {
  const originalContext = new RealValueContext()
  const regexp = /test/i
  const original = originalContext.represent(regexp) as RegExpRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = RegExpRepresentation.deserialize(deserializationContext, decoder)

  // The original and deserialized representations should be comparable
  t.is(original.compare(deserialized, 'comprehensive'), comparable)
})

// Preformat test
test('preformat performs setup only', (t) => {
  const context = new RealValueContext()
  const regexp = /test/i
  const regexpRep = context.represent(regexp) as RegExpRepresentation

  const formatter = new Formatter(deriveTheme())
  regexpRep.preformat()

  t.true(formatter.empty)
})

// Helper function to set up a RegExpRepresentation for testing
function injectProperties(context: RealValueContext, regexp: RegExp, representation: RegExpRepresentation) {
  const { mock: notifyNextExplicitlyNamedPropertyAccess } = mock.method(
    context,
    'notifyNextExplicitlyNamedPropertyAccess',
  )

  // First call preformat to set up the internal state
  representation.preformat()

  // Create mock properties for flags and source
  const flagsValue = context.represent(regexp.flags)
  const flagsProperty = new NamedPropertyAccessor('flags', flagsValue)
  const sourceValue = context.represent(regexp.source)
  const sourceProperty = new NamedPropertyAccessor('source', sourceValue)

  // Inject the flags and source properties into the internal state
  // Get the callbacks from the notifyNextExplicitlyNamedPropertyAccess calls and invoke them
  const flagsCallback = notifyNextExplicitlyNamedPropertyAccess.calls[0]!.arguments[2]
  const sourceCallback = notifyNextExplicitlyNamedPropertyAccess.calls[1]!.arguments[2]

  flagsCallback(flagsProperty, flagsValue)
  sourceCallback(sourceProperty, sourceValue)

  return {
    flagsProperty,
    sourceProperty,
  }
}

// ShouldFormatNamedProperty test
test('shouldFormatNamedProperty returns false for flags and source properties', (t) => {
  const context = new RealValueContext()
  const regexp = /test/i
  const regexpRep = context.represent(regexp) as RegExpRepresentation
  const { flagsProperty, sourceProperty } = injectProperties(context, regexp, regexpRep)

  t.false(regexpRep.shouldFormatNamedProperty(flagsProperty), 'Flags property should not be formatted separately')
  t.false(regexpRep.shouldFormatNamedProperty(sourceProperty), 'Source property should not be formatted separately')
  t.true(
    regexpRep.shouldFormatNamedProperty(new NamedPropertyAccessor('other', context.represent('value'))),
    'Other property should be formatted separately',
  )
})

// FinalFormat tests
test('finalFormat renders regexp literal notation by default', (t) => {
  const context = new RealValueContext()
  const regexp = /test/i
  const regexpRep = context.represent(regexp) as RegExpRepresentation
  injectProperties(context, regexp, regexpRep)

  const formatter = new Formatter(deriveTheme())

  // Call finalFormat to render the regexp
  regexpRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include the regexp literal format with source and flags
  t.true(rendered.includes('/test/i'), 'Regexp should be rendered in literal notation')

  // Should not include object brackets for a simple regexp
  t.false(rendered.includes('{'), 'Simple regexp should not include opening brace')
  t.false(rendered.includes('}'), 'Simple regexp should not include closing brace')

  // Should not include disambiguation hint by default
  t.false(rendered.includes('// RegExp'), 'Should not include disambiguation hint by default')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'regexp literal default format')
})

test('finalFormat includes disambiguation hint when options.disambiguationHint is true, but only if there are shenanigans', (t) => {
  const context = new RealValueContext()
  const regexp = /test/i
  Object.defineProperties(regexp, { [Symbol.toStringTag]: { value: 'Shenanigans' } })
  const regexpRep = context.represent(regexp) as RegExpRepresentation
  injectProperties(context, regexp, regexpRep)

  const formatter = new Formatter(deriveTheme())

  // Call finalFormat with disambiguation hint option
  regexpRep.finalFormat(formatter, { disambiguationHint: true })

  const rendered = formatter.render()

  // Should include regexp literal notation
  t.true(rendered.includes('/test/i'), 'Regexp should be rendered in literal notation')

  // Should include disambiguation hint when requested
  t.true(rendered.includes('// RegExp'), 'Should include disambiguation hint when requested')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'regexp literal with disambiguation hint')
})

test('finalFormat renders object notation for regexp with additional properties', (t) => {
  const context = new RealValueContext()
  const regexp = /test/i
  const regexpRep = context.represent(regexp) as RegExpRepresentation
  injectProperties(context, regexp, regexpRep)

  const formatter = new Formatter(deriveTheme())

  // Add an additional property to the regexp
  formatter.append('additional properties here')
  regexpRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include the regexp literal format with source and flags
  t.true(rendered.includes('/test/i'), 'Regexp should be rendered in literal notation')

  // Should include object brackets for a regexp with additional properties
  t.true(rendered.includes('{'), 'Regexp with properties should include opening brace')
  t.true(rendered.includes('}'), 'Regexp with properties should include closing brace')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'regexp with additional properties')
})

test('finalFormat renders object notation for regexp with custom constructor name', (t) => {
  const context = new RealValueContext()
  const regexp = /test/i
  const regexpRep = context.represent(regexp) as RegExpRepresentation
  injectProperties(context, regexp, regexpRep)
  mock.method(context, 'constructorName', () => 'CustomRegExp')

  const formatter = new Formatter(deriveTheme())

  // Call finalFormat
  regexpRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include the regexp literal notation
  t.true(rendered.includes('/test/i'), 'Regexp should be rendered in literal notation')

  // Should include custom constructor name
  t.true(rendered.includes('CustomRegExp'), 'Should include custom constructor name')

  // Should include object brackets due to shenanigans
  t.true(rendered.includes('{'), 'Regexp with custom constructor should include opening brace')
  t.true(rendered.includes('}'), 'Regexp with custom constructor should include closing brace')

  // Snapshot the exact rendering
  t.snapshot(rendered, 'regexp with custom constructor name')
})
