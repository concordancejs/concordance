/* eslint-disable ava/no-useless-t-pass */
import test from 'ava'
import { expectType } from 'tsd'
import {
  version,
  staticTypeTable,
  isValidStaticType,
  isValidAspectType,
  type StaticType,
  type AspectType,
} from '../serialization-types.ts'

test('version is correctly defined', (t) => {
  t.is(typeof version, 'number')
  t.is(version, 4) // If this value changes, it requires a major version bump
})

test('staticTypeTable defines the expected types', (t) => {
  // Test a sample of core types to ensure they exist
  t.true(staticTypeTable.terminator !== undefined)
  t.true(staticTypeTable.pointer !== undefined)
  t.true(staticTypeTable.object !== undefined)
  t.true(staticTypeTable.array !== undefined)

  // Test all aspect types
  t.true(staticTypeTable.elementAspect !== undefined)
  t.true(staticTypeTable.iteratorValueAspect !== undefined)
  t.true(staticTypeTable.mapEntryAspect !== undefined)
  t.true(staticTypeTable.namedPropertyAspect !== undefined)
  t.true(staticTypeTable.symbolPropertyAspect !== undefined)
})

test('staticTypeTable has unique values', (t) => {
  const values = Object.values(staticTypeTable)
  const uniqueValues = new Set(values)

  // All values should be unique
  t.is(values.length, uniqueValues.size)
})

test('staticTypeTable reserves specific ranges for CBOR optimization', (t) => {
  // Common types should use values 0-23 for single-byte CBOR encoding
  t.true(staticTypeTable.terminator <= 23)
  t.true(staticTypeTable.pointer <= 23)
  t.true(staticTypeTable.bigint <= 23)
  t.true(staticTypeTable.boolean <= 23)
  t.true(staticTypeTable.null <= 23)
  t.true(staticTypeTable.number <= 23)
  t.true(staticTypeTable.string <= 23)
  t.true(staticTypeTable.symbol <= 23)
  t.true(staticTypeTable.undefined <= 23)
  t.true(staticTypeTable.object <= 23)
  t.true(staticTypeTable.array <= 23)
  t.true(staticTypeTable.map <= 23)
  t.true(staticTypeTable.set <= 23)
  t.true(staticTypeTable.arrayBufferView <= 23)
  t.true(staticTypeTable.date <= 23)
  t.true(staticTypeTable.regExp <= 23)
  t.true(staticTypeTable.error <= 23)

  // Aspect types should be in the range 24-31
  t.true(staticTypeTable.elementAspect >= 24 && staticTypeTable.elementAspect <= 31)
  t.true(staticTypeTable.iteratorValueAspect >= 24 && staticTypeTable.iteratorValueAspect <= 31)
  t.true(staticTypeTable.mapEntryAspect >= 24 && staticTypeTable.mapEntryAspect <= 31)
  t.true(staticTypeTable.namedPropertyAspect >= 24 && staticTypeTable.namedPropertyAspect <= 31)
  t.true(staticTypeTable.symbolPropertyAspect >= 24 && staticTypeTable.symbolPropertyAspect <= 31)

  // Less common types should be 32 or higher
  t.true(staticTypeTable.arguments >= 32)
  t.true(staticTypeTable.arrayBuffer >= 32)
  t.true(staticTypeTable.boxedPrimitive >= 32)
  t.true(staticTypeTable.cryptoKey >= 32)
  t.true(staticTypeTable.external >= 32)
  t.true(staticTypeTable.function >= 32)
  t.true(staticTypeTable.moduleNamespaceObject >= 32)
  t.true(staticTypeTable.promise >= 32)
  t.true(staticTypeTable.weakMap >= 32)
  t.true(staticTypeTable.weakSet >= 32)
})

test('isValidStaticType returns true for valid static types', (t) => {
  // Test all values from the staticTypeTable
  for (const typeValue of Object.values(staticTypeTable)) {
    t.true(isValidStaticType(typeValue))
  }
})

test('isValidStaticType returns false for invalid static types', (t) => {
  // Test values that are not in the table
  t.false(isValidStaticType(-1))
  t.false(isValidStaticType(100))
  t.false(isValidStaticType(1000))
})

test('isValidAspectType returns true for aspect types', (t) => {
  // Test all aspect types
  t.true(isValidAspectType(staticTypeTable.elementAspect))
  t.true(isValidAspectType(staticTypeTable.iteratorValueAspect))
  t.true(isValidAspectType(staticTypeTable.mapEntryAspect))
  t.true(isValidAspectType(staticTypeTable.namedPropertyAspect))
  t.true(isValidAspectType(staticTypeTable.symbolPropertyAspect))
})

test('isValidAspectType returns false for non-aspect types', (t) => {
  // Test non-aspect types from staticTypeTable
  t.false(isValidAspectType(staticTypeTable.terminator))
  t.false(isValidAspectType(staticTypeTable.pointer))
  t.false(isValidAspectType(staticTypeTable.object))
  t.false(isValidAspectType(staticTypeTable.array))

  // Test invalid types
  t.false(isValidAspectType(-1))
  t.false(isValidAspectType(100))
})

test('isValidAspectType handles edge cases', (t) => {
  // Test values just outside the valid range
  const lowestAspect = staticTypeTable.elementAspect
  const highestAspect = staticTypeTable.symbolPropertyAspect

  t.false(isValidAspectType(lowestAspect - 1))
  t.false(isValidAspectType(highestAspect + 1))
})

test('StaticType type is compatible with all staticTypeTable values', (t) => {
  // This is a type-level test, not a runtime test. It just sits nicely here.
  expectType<StaticType[]>(Object.values(staticTypeTable))
  t.pass()
})

test('AspectType type is compatible with only aspect values', (t) => {
  // This is a type-level test, not a runtime test. It just sits nicely here.
  // Create an array of aspect types
  expectType<AspectType[]>([
    staticTypeTable.elementAspect,
    staticTypeTable.iteratorValueAspect,
    staticTypeTable.mapEntryAspect,
    staticTypeTable.namedPropertyAspect,
    staticTypeTable.symbolPropertyAspect,
  ])
  t.pass()
})
