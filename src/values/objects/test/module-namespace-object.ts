import test from 'ava'
import { RealValueContext } from '../../../real-value-context.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { DeserializationContext } from '../../../deserialization-context.ts'
import { ModuleNamespaceObjectRepresentation } from '../module-namespace-object.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'
// Import a module namespace for testing
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import * as moduleNamespace from './fixtures/module-fixture.ts'

// Deserialize method test
test('deserialize creates a comparable ModuleNamespaceObjectRepresentation', (t) => {
  const originalContext = new RealValueContext()
  const original = originalContext.represent(moduleNamespace) as ModuleNamespaceObjectRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ModuleNamespaceObjectRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized), comparable)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same module namespace object instance', (t) => {
  const context = new RealValueContext()

  const moduleRep1 = context.represent(moduleNamespace) as ModuleNamespaceObjectRepresentation
  const moduleRep2 = context.represent(moduleNamespace) as ModuleNamespaceObjectRepresentation

  t.is(moduleRep1.compare(moduleRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-ModuleNamespaceObjectRepresentation', (t) => {
  const context = new RealValueContext()
  const object = {}

  const moduleRep = context.represent(moduleNamespace) as ModuleNamespaceObjectRepresentation
  const objectRep = context.represent(object)

  t.is(moduleRep.compare(objectRep), unequal)
})

// Module namespace objects from the same module are identical
test('compare returns strictlyEqual when importing the same module multiple times', async (t) => {
  const context = new RealValueContext()

  // Import the same module twice - they'll actually be the same object
  const { default: getDuplicateNamespace } = await import('./fixtures/get-duplicate-namespace.ts')
  const duplicateNamespace = await getDuplicateNamespace()

  const moduleRep1 = context.represent(moduleNamespace) as ModuleNamespaceObjectRepresentation
  const moduleRep2 = context.represent(duplicateNamespace) as ModuleNamespaceObjectRepresentation

  // Should be strictly equal since they're the same object
  t.is(moduleRep1.compare(moduleRep2), strictlyEqual)

  // We can also verify they're the same object
  t.is(moduleNamespace, duplicateNamespace)
})

// Test comparing different module namespace objects
test('compare returns unequal when comparing different module namespace objects', async (t) => {
  const context = new RealValueContext()

  // Import a different module
  const differentModuleNamespace = await import('./fixtures/different-module-fixture.ts')

  const moduleRep1 = context.represent(moduleNamespace) as ModuleNamespaceObjectRepresentation
  const moduleRep2 = context.represent(differentModuleNamespace) as ModuleNamespaceObjectRepresentation

  // Different module namespace objects should be unequal
  t.is(moduleRep1.compare(moduleRep2), unequal)
})

// Serialization test
test('serialize uses moduleNamespaceObject static type', (t) => {
  const context = new RealValueContext()
  const moduleRep = context.represent(moduleNamespace) as ModuleNamespaceObjectRepresentation

  const encoder = new Encoder()
  moduleRep.serialize(encoder)

  // Check the overall structure and type with a snapshot
  snapshotEncoded(t, encoder, 'module namespace object serialization')

  // Verify the static type
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.moduleNamespaceObject)
})

test('serializing and deserializing a module namespace object preserves its structure', (t) => {
  const originalContext = new RealValueContext()
  const original = originalContext.represent(moduleNamespace) as ModuleNamespaceObjectRepresentation

  // Serialize and deserialize the original module namespace object
  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = ModuleNamespaceObjectRepresentation.deserialize(deserializationContext, decoder)

  // The original and deserialized representations should be comparable
  t.is(original.compare(deserialized), comparable)
})

// FinalFormat tests
test('finalFormat uses object brackets and includes disambiguation hint', (t) => {
  const context = new RealValueContext()
  const moduleRep = context.represent(moduleNamespace) as ModuleNamespaceObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  moduleRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should use object brackets
  t.true(rendered.includes('{'))
  t.true(rendered.includes('}'))

  // Should always include explicit disambiguation hint
  t.true(rendered.includes('// Module Namespace Object'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'module namespace object format')
})

test('finalFormat works with non-empty formatter', (t) => {
  const context = new RealValueContext()
  const moduleRep = context.represent(moduleNamespace) as ModuleNamespaceObjectRepresentation

  const formatter = new Formatter(deriveTheme())
  // Add some content to make the formatter non-empty
  formatter.append('some property content')
  moduleRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include the property content
  t.true(rendered.includes('some property content'))

  // Should always include disambiguation hint
  t.true(rendered.includes('// Module Namespace Object'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'module namespace object with content')
})

test('finalFormat handles maxDepthReached', (t) => {
  const context = new RealValueContext()
  const moduleRep = context.represent(moduleNamespace) as ModuleNamespaceObjectRepresentation

  // Create a formatter with maxDepth already reached
  const formatter = new Formatter(deriveTheme(), 10, 5)
  moduleRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include max depth indicator
  t.true(rendered.includes(formatter.theme.maxDepth))

  // Should always include disambiguation hint
  t.true(rendered.includes('// Module Namespace Object'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'module namespace object with max depth')
})

test('finalFormat handles maxDepthReached with non-empty formatter', (t) => {
  const context = new RealValueContext()
  const moduleRep = context.represent(moduleNamespace) as ModuleNamespaceObjectRepresentation

  // Create formatter with max depth already reached and content
  const formatter = new Formatter(deriveTheme(), 10, 5)
  formatter.append('some property content')
  moduleRep.finalFormat(formatter)

  const rendered = formatter.render()

  // Should include the property content
  t.true(rendered.includes('some property content'))

  // Should include max depth indicator
  t.true(rendered.includes(formatter.theme.maxDepth))

  // Should always include disambiguation hint
  t.true(rendered.includes('// Module Namespace Object'))

  // Snapshot the exact rendering
  t.snapshot(rendered, 'module namespace object with content and max depth')
})
