import test from 'ava'
import { normalizeTheme, deriveTheme } from '../theme.ts'

test('normalizeTheme freezes the theme object', (t) => {
  const theme = normalizeTheme({
    foo: 'bar',
    nested: {
      value: 'test',
    },
  })

  t.true(Object.isFrozen(theme))
  t.true(Object.isFrozen(theme.nested))
})

test('normalizeTheme allows direct access to top-level properties', (t) => {
  const theme = normalizeTheme({
    foo: 'bar',
    nested: {
      value: 'test',
    },
  })

  t.is(theme.foo, 'bar')
  t.deepEqual(theme.nested, { value: 'test' })
})

test('normalizeTheme creates dot-notation paths for nested objects', (t) => {
  const theme = normalizeTheme({
    top: {
      middle: {
        bottom: 'value',
      },
      sibling: 'test',
    },
    object: {
      bracket: {
        open: '{',
        close: '}',
      },
    },
  })

  t.is(theme['top.middle'], theme.top.middle)
  t.deepEqual(theme['top.middle'], { bottom: 'value' })

  // Test that both syntaxes work for accessing nested values
  t.is(theme.object.bracket.open, '{')
  t.is(theme['object.bracket'].open, '{')
  t.is(theme['object.bracket'].close, '}')
})

test('normalizeTheme does not create dot-notation paths for non-object values', (t) => {
  const theme = normalizeTheme({
    top: {
      middle: 'value',
    },
  })

  t.false('top.middle' in theme)
})

test('normalizeTheme creates non-enumerable path properties', (t) => {
  const theme = normalizeTheme({
    top: {
      middle: {
        bottom: 'value',
      },
    },
  })

  t.false(Object.keys(theme).includes('top.middle'))
  t.true('top.middle' in theme)
})

test('normalizeTheme handles complex nested structures', (t) => {
  const theme = normalizeTheme({
    a: {
      b: {
        c: {
          d: 'value',
        },
      },
      e: 'sibling',
    },
    f: 'top-level',
  })

  t.is(theme['a.b.c'], theme.a.b.c)
  t.deepEqual(theme['a.b.c'], { d: 'value' })
  t.is(theme.a.e, 'sibling')
  t.is(theme.f, 'top-level')
})

test('normalizeTheme preserves original string values', (t) => {
  const theme = normalizeTheme({
    indent: '  ',
    maxDepth: '…',
  })

  t.is(theme.indent, '  ')
  t.is(theme.maxDepth, '…')
})

test('normalizeTheme properly handles empty objects', (t) => {
  const theme = normalizeTheme({
    empty: {},
    nested: {
      empty: {},
    },
  })

  t.deepEqual(theme.empty, {})
  t.deepEqual(theme.nested.empty, {})
  t.is(theme['nested.empty'], theme.nested.empty)
})

// -----------------------------------------------------------------------------
// deriveTheme tests
// -----------------------------------------------------------------------------

test('deriveTheme returns a properly formatted theme with defaults', (t) => {
  const theme = deriveTheme()

  // Check some basic properties to ensure we have a valid theme
  t.is(typeof theme, 'object')
  t.is(theme.array.bracket.open, '[')
  t.is(theme.array.bracket.close, ']')
  t.is(theme.object.bracket.open, '{')
  t.is(theme.object.bracket.close, '}')
})

test('deriveTheme correctly overrides top-level properties', (t) => {
  const customTheme = deriveTheme({
    // Override the indent
    indent: '    ',
    // Override the circular reference marker
    circular: '<ref>',
  })

  // Custom properties should be overridden
  t.is(customTheme.indent, '    ')
  t.is(customTheme.circular, '<ref>')

  // Non-customized properties should remain unchanged
  t.is(customTheme.array.bracket.open, '[')
  t.is(customTheme.array.bracket.close, ']')
})

test('deriveTheme performs deep merges of nested properties', (t) => {
  const customTheme = deriveTheme({
    // Override only specific nested properties
    array: {
      bracket: {
        open: '<<', // Using a different value than the default '['
      },
    },
  })

  // Custom nested properties should be overridden
  t.is(customTheme.array.bracket.open, '<<') // Custom value
  t.is(customTheme.array.bracket.close, ']') // Default value preserved

  // Unspecified properties at the same level should remain unchanged
  t.is(customTheme.string.open, '')
  t.is(customTheme.string.close, '')

  // Other parts of the theme should not be affected
  t.is(customTheme.object.bracket.open, '{')
  t.is(customTheme.object.bracket.close, '}')
})

test('deriveTheme preserves nested paths', (t) => {
  const theme = deriveTheme({
    array: {
      bracket: {
        open: '<<',
        close: '>>',
      },
    },
  })

  // Direct property access
  t.is(theme.array.bracket.open, '<<')
  t.is(theme.array.bracket.close, '>>')

  // Access via the nested path
  const bracket = theme['array.bracket']
  t.is(bracket.open, '<<')
  t.is(bracket.close, '>>')
})

test('deriveTheme ignores unknown properties', (t) => {
  // Use type assertion to bypass TypeScript's strict checking
  // for properties that don't exist in the Theme type
  const input = {
    unknownProperty: 'should be ignored',
    array: {
      // We need to add this property for testing
      unknownNested: 'should also be ignored',
      bracket: {
        open: '««',
        close: '»»',
      },
    },
  }

  const theme = deriveTheme(input)

  // Valid properties should be set
  t.is(theme.array.bracket.open, '««')
  t.is(theme.array.bracket.close, '»»')

  // Unknown properties should not be added to the theme
  t.false('unknownProperty' in theme)
  t.false('unknownNested' in theme.array)
})
