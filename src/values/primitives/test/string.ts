import test from 'ava'
import { StringRepresentation } from '../string.ts'
import { Encoder } from '../../../encoder.ts'
import { Decoder } from '../../../decoder.ts'
import { strictlyEqual, unequal } from '../../../comparison.ts'
import { NumberRepresentation } from '../number.ts'
import { finished } from '../../../serialization-result.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'
import { Formatter } from '../../../formatter.ts'
import { deriveTheme } from '../../../theme.ts'

test('compare returns strictlyEqual for same strings', (t) => {
  const a = new StringRepresentation('hello')
  const b = new StringRepresentation('hello')

  t.is(a.compare(b), strictlyEqual)
})

test('compare returns unequal for different strings', (t) => {
  const a = new StringRepresentation('hello')
  const b = new StringRepresentation('world')

  t.is(a.compare(b), unequal)
})

test('compare returns unequal for non-StringRepresentation values', (t) => {
  const a = new StringRepresentation('42')
  const nonString = new NumberRepresentation(42)

  t.is(a.compare(nonString), unequal)
})

test('static is correctly identifies StringRepresentation instances', (t) => {
  const str = new StringRepresentation('test')
  const num = new NumberRepresentation(42)

  t.true(StringRepresentation.is(str))
  t.false(StringRepresentation.is(num))
})

test('serializeShallow correctly encodes a string', (t) => {
  const representation = new StringRepresentation('test string')
  const encoder = new Encoder()

  const result = representation.serializeShallow(encoder)

  t.is(result, finished)
  snapshotEncoded(t, encoder)
})

test('can serialize and deserialize regular strings', (t) => {
  const original = new StringRepresentation('hello world')
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize empty strings', (t) => {
  const original = new StringRepresentation('')
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize strings with special characters', (t) => {
  const original = new StringRepresentation('特殊文字 🚀 \n\t\r')
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize very long strings', (t) => {
  const longString = 'a'.repeat(10000)
  const original = new StringRepresentation(longString)
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  const deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)
})

test('can serialize and deserialize strings with surrogate pairs', (t) => {
  // '𝄞' (musical G clef) is represented by surrogate pair '\uD834\uDD1E'
  // '𝌆' (tai xuan jing symbol) is represented by surrogate pair '\uD834\uDF06'
  const stringWithSurrogatePairs = '𝄞 musical G clef and 𝌆 tai xuan jing symbol'
  const original = new StringRepresentation(stringWithSurrogatePairs)
  const encoder = new Encoder()
  original.serializeShallow(encoder)

  snapshotEncoded(t, encoder)

  const deserialized = StringRepresentation.deserialize(new Decoder(encoder.bytes.subarray(1)))
  t.is(original.compare(deserialized), strictlyEqual)

  // Verify the surrogate pairs are preserved
  t.is(stringWithSurrogatePairs.length, 45) // Length in JavaScript characters (code units)
  t.is([...stringWithSurrogatePairs].length, 43) // Length in Unicode code points
})

// -----------------------------------------------------------------------------
// formatShallow tests
// -----------------------------------------------------------------------------

// Helper function for formatting a string and getting the rendered result
function formatString(value: string): string {
  const representation = new StringRepresentation(value)
  const formatter = new Formatter(deriveTheme(), 0)
  representation.formatShallow(formatter)
  return formatter.close().render()
}

test('formatShallow handles basic string formatting', (t) => {
  const rendered = formatString('hello world')
  t.snapshot(rendered)
  t.true(rendered.includes('hello world'))
})

test('formatShallow uses different themes for single-line vs multi-line strings', (t) => {
  const theme = deriveTheme()

  // Format a single line string and a multi-line string
  const singleRendered = formatString('hello')
  const multiRendered = formatString('hello\nworld')

  t.snapshot(singleRendered, 'Single line string')
  t.snapshot(multiRendered, 'Multi-line string')

  // Check that the correct themes are applied
  t.true(singleRendered.includes(theme.string.line.open), 'Should use line theme for single-line strings')
  t.true(multiRendered.includes(theme.string.multiline.open), 'Should use multiline theme for multi-line strings')
})

test('formatShallow correctly escapes control characters', (t) => {
  // Test various control characters
  const controlString = '\0\b\t\n\v\f\r\\'
  const rendered = formatString(controlString)

  t.snapshot(rendered)

  // Control characters should be properly escaped
  t.true(rendered.includes('\\0'), 'Should escape null byte')
  t.true(rendered.includes('\\b'), 'Should escape backspace')
  t.true(rendered.includes('\\t'), 'Should escape tab')
  t.true(rendered.includes('\\v'), 'Should escape vertical tab')
  t.true(rendered.includes('\\f'), 'Should escape form feed')
  t.true(rendered.includes('\\\\'), 'Should escape backslash')
})

test('formatShallow visualizes line breaks with control pictures', (t) => {
  // Test different line endings
  const lfString = 'Line 1\nLine 2'
  const crlfString = 'Line 1\r\nLine 2'
  const crString = 'Line 1\rLine 2'

  const lfRendered = formatString(lfString)
  const crlfRendered = formatString(crlfString)
  const crRendered = formatString(crString)

  t.snapshot(lfRendered, 'LF String')
  t.snapshot(crlfRendered, 'CRLF String')
  t.snapshot(crRendered, 'CR String')

  // Line breaks should be visualized with control pictures
  t.true(lfRendered.includes('␊'), 'Should use control picture for LF')
  t.true(crlfRendered.includes('␍␊'), 'Should use control picture for CRLF')
  t.true(crRendered.includes('␍'), 'Should use control picture for CR')
})

test('formatShallow handles ANSI escape codes', (t) => {
  const ansiString = `Hello \u001B[31mred\u001B[0m text`
  const rendered = formatString(ansiString)

  t.snapshot(rendered)

  // ANSI escape code should be replaced with control picture
  t.true(rendered.includes('␛'), 'Should replace ESC with control picture')
  t.false(rendered.includes('\u001B'), 'Should not contain raw ESC character')
})

test('formatShallow preserves Unicode and emoji characters', (t) => {
  const unicodeString = 'Unicode: 你好, цвет, ‎العربية, 😀👨‍👩‍👧‍👦🚀'
  const rendered = formatString(unicodeString)

  t.snapshot(rendered)

  // Unicode characters should be preserved
  t.true(rendered.includes('你好'), 'Should preserve Chinese characters')
  t.true(rendered.includes('цвет'), 'Should preserve Cyrillic characters')
  t.true(rendered.includes('‎العربية'), 'Should preserve Arabic characters')
  t.true(rendered.includes('😀'), 'Should preserve simple emoji')
  t.true(rendered.includes('👨‍👩‍👧‍👦'), 'Should preserve complex emoji with ZWJ sequences')
})

test('formatShallow escapes C0 and C1 control characters with Unicode notation', (t) => {
  // Generate a string with C0 (except common ones) and C1 control characters
  let controlString = ''
  for (let i = 1; i <= 31; i++) {
    // Skip common control characters that have specific escape sequences
    if (![8, 9, 10, 11, 12, 13, 27].includes(i)) {
      controlString += String.fromCharCode(i)
    }
  }
  // Add some C1 control characters
  for (let i = 128; i <= 159; i++) {
    controlString += String.fromCharCode(i)
  }

  const rendered = formatString(controlString)
  t.snapshot(rendered)

  // Check for a few specific escapes
  t.true(rendered.includes('\\u0001'), 'Should escape SOH character')
  t.true(rendered.includes('\\u0002'), 'Should escape STX character')
  t.true(rendered.includes('\\u0003'), 'Should escape ETX character')
  t.true(rendered.includes('\\u0080'), 'Should escape C1 control character 0x80')
  t.true(rendered.includes('\\u0090'), 'Should escape C1 control character 0x90')
})

test('formatShallow escapes quotes based on theme setting', (t) => {
  const theme = deriveTheme()

  // Create strings with different quotes to test theme-specific escaping
  const singleQuoteString = "Text with ' single quote"
  const doubleQuoteString = 'Text with " double quote'
  const backtickString = 'Text with ` backtick'

  // Format strings with different types of quotes
  const rendered1 = formatString(singleQuoteString)
  const rendered2 = formatString(doubleQuoteString)
  const rendered3 = formatString(backtickString)

  // Snapshot the rendered outputs
  t.snapshot(rendered1, 'Single Quote String')
  t.snapshot(rendered2, 'Double Quote String')
  t.snapshot(rendered3, 'Backtick String')

  // Check that the theme's escape quote is properly escaped
  if (theme.string.line.escapeQuote === "'") {
    t.true(rendered1.includes("\\'"), 'Should escape single quote')
  } else if (theme.string.line.escapeQuote === '"') {
    t.true(rendered2.includes('\\"'), 'Should escape double quote')
  } else if (theme.string.line.escapeQuote === '`') {
    t.true(rendered3.includes('\\`'), 'Should escape backtick')
  }
})

test('formatShallow escapes control picture characters in text', (t) => {
  // Create string with literal control picture characters
  const controlPictureString = 'Text with ␊ ␍ and ␛ control pictures'
  const rendered = formatString(controlPictureString)

  t.snapshot(rendered)

  // Control picture characters should be escaped with Unicode notation
  t.true(rendered.includes('\\u240a'), 'Should escape LF control picture')
  t.true(rendered.includes('\\u240d'), 'Should escape CR control picture')
  t.true(rendered.includes('\\u241b'), 'Should escape ESC control picture')
})

test('formatShallow handles empty strings', (t) => {
  const rendered = formatString('')

  t.snapshot(rendered)

  const theme = deriveTheme()
  t.is(rendered, `${theme.string.line.open}${theme.string.line.close}`, 'Should format empty string properly')
})

// -----------------------------------------------------------------------------
// formatTypicalIdentifier tests
// -----------------------------------------------------------------------------

test('formatTypicalIdentifier formats string as a typical identifier', (t) => {
  const representation = new StringRepresentation('testValue')
  const formatter = new Formatter(deriveTheme())

  representation.formatTypicalIdentifier(formatter)
  formatter.close()

  // Should call encodeTypicalIdentifier on the formatter with the string value
  t.snapshot(formatter.render())

  // Since 'testValue' only has valid identifier characters, it should be unchanged
  t.is(formatter.render(), 'testValue')
})

test('formatTypicalIdentifier escapes non-identifier characters', (t) => {
  // Test with string containing characters that need escaping in identifiers
  const representation = new StringRepresentation('test value!@#')
  const formatter = new Formatter(deriveTheme())

  representation.formatTypicalIdentifier(formatter)
  formatter.close()

  t.snapshot(formatter.render())
  // The space and special characters should be properly escaped
  // (the exact escaping mechanism is tested in formatter tests)
})

test('formatTypicalIdentifier supports different append methods', (t) => {
  const str = new StringRepresentation('test')
  const formatter = new Formatter(deriveTheme())

  // Test append (default)
  formatter.append('prefix-')
  str.formatTypicalIdentifier(formatter, 'append')
  formatter.append('-suffix')
  formatter.close()
  t.is(formatter.render(), 'prefix-test-suffix', 'Should append to existing content')

  // Test prepend
  const formatter2 = new Formatter(deriveTheme())
  formatter2.append('original')
  str.formatTypicalIdentifier(formatter2, 'prepend')
  formatter2.close()
  t.is(formatter2.render(), 'testoriginal', 'Should prepend to existing content')

  // Test prefix
  const formatter3 = new Formatter(deriveTheme())
  formatter3.append('middle')
  str.formatTypicalIdentifier(formatter3, 'prefix')
  formatter3.append('-end')
  formatter3.close()
  t.is(formatter3.render(), 'testmiddle-end', 'Should add content at the beginning')
})

// -----------------------------------------------------------------------------
// formatRaw tests
// -----------------------------------------------------------------------------

test('formatRaw outputs string value without encoding', (t) => {
  // Test with string containing special characters that would normally be escaped
  const specialChars = 'Raw string with \n \t \\ and control \u0001 characters'
  const representation = new StringRepresentation(specialChars)
  const formatter = new Formatter(deriveTheme())

  representation.formatRaw(formatter)
  formatter.close()

  // Raw formatting should not escape or encode anything
  t.is(formatter.render(), specialChars, 'Should output the exact string without any escaping')
})

test('formatRaw supports different append methods', (t) => {
  const str = new StringRepresentation('raw')
  const formatter = new Formatter(deriveTheme())

  // Test append (default)
  formatter.append('before-')
  str.formatRaw(formatter, 'append')
  formatter.append('-after')
  formatter.close()
  t.is(formatter.render(), 'before-raw-after', 'Should append to existing content')

  // Test prepend
  const formatter2 = new Formatter(deriveTheme())
  formatter2.append('original')
  str.formatRaw(formatter2, 'prepend')
  formatter2.close()
  t.is(formatter2.render(), 'raworiginal', 'Should prepend to existing content')

  // Test prefix
  const formatter3 = new Formatter(deriveTheme())
  formatter3.append('middle')
  str.formatRaw(formatter3, 'prefix')
  formatter3.append('-end')
  formatter3.close()
  t.is(formatter3.render(), 'rawmiddle-end', 'Should add content at the beginning')
})

test('formatRaw vs formatShallow behavior comparison', (t) => {
  // Create a string that would be transformed by formatShallow
  const testString = 'Line 1\nLine 2'
  const representation = new StringRepresentation(testString)

  // Format with formatRaw
  const formatterRaw = new Formatter(deriveTheme())
  representation.formatRaw(formatterRaw)
  formatterRaw.close()

  // Format with formatShallow
  const formatterShallow = new Formatter(deriveTheme())
  representation.formatShallow(formatterShallow)
  formatterShallow.close()

  // Raw should preserve the string exactly as-is
  t.is(formatterRaw.render(), testString, 'formatRaw should preserve the exact string')

  // Shallow should transform the string (add themes, convert newlines, etc.)
  t.not(formatterShallow.render(), testString, 'formatShallow should transform the string')
  t.true(formatterShallow.render().includes('␊'), 'formatShallow should convert newlines to control pictures')
})

test('formatShallow correctly handles strings with multiple consecutive line breaks', (t) => {
  const multiBreakString = 'Line 1\n\nLine 3\n\n\nLine 6'
  const rendered = formatString(multiBreakString)

  t.snapshot(rendered)

  // Count occurrences of control pictures
  const controlPictureCount = (rendered.match(/␊/g) || []).length
  t.is(controlPictureCount, 5, 'Should have 5 line feed control pictures')
})

test('formatShallow handles strings with mixed content types', (t) => {
  const mixedString =
    'Normal text with \t tab, \u001B[31m ANSI \u001B[0m, line\nbreak, emoji 🚀, and control \u0001 characters'
  const rendered = formatString(mixedString)

  t.snapshot(rendered)

  t.true(rendered.includes('Normal text'), 'Should preserve normal text')
  t.true(rendered.includes('\\t'), 'Should escape tab')
  t.true(rendered.includes('␛'), 'Should convert ESC to control picture')
  t.true(rendered.includes('␊'), 'Should convert newline to control picture')
  t.true(rendered.includes('🚀'), 'Should preserve emoji')
  t.true(rendered.includes('\\u0001'), 'Should escape control character')
})
