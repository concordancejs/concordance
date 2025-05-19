import test from 'ava'
import { normalizeFlags, deriveFlags } from '../flags.ts'

test('normalizeFlags() expands partial flags', (t) => {
  const result = normalizeFlags({ compareArgumentsToArrays: true })

  // Should preserve the provided value
  t.true(result.compareArgumentsToArrays, 'should preserve provided values')

  // Should be frozen
  t.true(Object.isFrozen(result), 'result should be frozen')
})

test('normalizeFlags() returns frozen defaults for undefined input', (t) => {
  const result = normalizeFlags(undefined)
  t.false(result.compareArgumentsToArrays, 'should have default values')
  t.true(Object.isFrozen(result), 'result should be frozen')
})

test('deriveFlags() returns frozen object', (t) => {
  const result = deriveFlags()
  t.true(Object.isFrozen(result), 'derived flags should be frozen')
})

test('deriveFlags() with invalid inputs returns disabled defaults', (t) => {
  // Test various invalid inputs
  const testCases = [
    { input: undefined, name: 'undefined' },
    { input: null, name: 'null' },
    { input: 123, name: 'number' },
    { input: 'string', name: 'string' },
    { input: true, name: 'boolean' },
    { input: {}, name: 'empty object' },
  ]

  // Get the expected default values for comparison
  const expectedDefaults = deriveFlags()

  for (const { input, name } of testCases) {
    const result = deriveFlags(input)

    // Verify structure matches disabled defaults
    t.deepEqual(result, expectedDefaults, `${name} input should return disabled defaults`)

    // Verify it's a different object instance
    t.not(result, expectedDefaults, `${name} input should return a copy, not the same reference`)
  }
})

test('deriveFlags() preserves valid flag values', (t) => {
  // Test with compareArgumentsToArrays set to true (opposite of default)
  const input = { compareArgumentsToArrays: true }
  const result = deriveFlags(input)

  // Check that the flag value persists
  t.true(result.compareArgumentsToArrays, 'compareArgumentsToArrays should be preserved as true')
})

test('deriveFlags() ignores unknown flags', (t) => {
  // Create input with valid flags and some extra ones
  const input = {
    compareArgumentsToArrays: true,
    unknownFlag: true,
    anotherUnknown: 'value',
  } as unknown as Record<string, unknown>

  const result = deriveFlags(input)

  // Check the known flag is preserved
  t.true(result.compareArgumentsToArrays, 'valid flag should be preserved')

  // Check unknown keys are not present
  t.false('unknownFlag' in result, 'unknownFlag should not be present')
  t.false('anotherUnknown' in result, 'anotherUnknown should not be present')

  // Check structure matches expected - none of the unknown flags should be present
  const expectedShape = deriveFlags({ compareArgumentsToArrays: true })
  t.deepEqual(
    Object.keys(result).sort(),
    Object.keys(expectedShape).sort(),
    'result object should have the same properties as the expected flags object',
  )
})

test('deriveFlags() ignores flags with incorrect types', (t) => {
  // Get the default (disabled) values
  const defaults = deriveFlags()

  // Test with compareArgumentsToArrays having wrong type
  const input = {
    compareArgumentsToArrays: 'not-a-boolean',
  } as unknown as Record<string, unknown>

  const result = deriveFlags(input)

  // The value should match the disabled default, not input value
  t.is(
    result.compareArgumentsToArrays,
    defaults.compareArgumentsToArrays,
    'flag with wrong type should revert to disabled default',
  )
})
