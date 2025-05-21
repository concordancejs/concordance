import test from 'ava'
import { Formatter } from '../formatter.ts'
import { deriveTheme } from '../theme.ts'

// Create a single theme instance to use across all tests
const testTheme = deriveTheme()

// -----------------------------------------------------------------------------
// Constructor and Property tests
// -----------------------------------------------------------------------------

test('constructor initializes with proper defaults', (t) => {
  const formatter = new Formatter(testTheme)

  t.is(formatter.theme, testTheme)
  t.true(formatter.empty)
  t.false(formatter.maxDepthReached)
})

test('constructor respects depth and maxDepth', (t) => {
  const maxDepth = 2
  const formatter = new Formatter(testTheme, maxDepth, maxDepth)

  t.is(formatter.theme, testTheme)
  t.true(formatter.maxDepthReached)
})

// -----------------------------------------------------------------------------
// append/prefix/prepend tests
// -----------------------------------------------------------------------------

test('append adds values to the accumulator in order', (t) => {
  const formatter = new Formatter(testTheme)
  t.true(formatter.empty)

  formatter.append('first')
  t.false(formatter.empty)

  formatter.append('second', 'third')
  formatter.close()

  // Convert the formatter to an array to check its contents
  const values = Array.from(formatter)
  t.true(values.includes('first'))
  t.true(values.includes('second'))
  t.true(values.includes('third'))

  // Verify the ordering of appended values
  t.true(values.indexOf('first') < values.indexOf('second'))
  t.true(values.indexOf('second') < values.indexOf('third'))
})

test('append returns the formatter instance for chaining', (t) => {
  const formatter = new Formatter(testTheme)

  const returnValue = formatter.append('test')

  t.is(returnValue, formatter, 'append should return formatter instance')
})

test('prepend adds values to the beginning of the accumulator in order', (t) => {
  const formatter = new Formatter(testTheme)
  t.true(formatter.empty)

  formatter.append('third')
  t.false(formatter.empty)

  formatter.prepend('second')
  formatter.prepend('first')
  formatter.close()

  const values = Array.from(formatter)

  // Values should be present
  t.true(values.includes('first'))
  t.true(values.includes('second'))
  t.true(values.includes('third'))

  // The prepend method adds values at the beginning
  t.true(values.indexOf('first') < values.indexOf('second'))
  t.true(values.indexOf('second') < values.indexOf('third'))
})

test('prepend returns the formatter instance for chaining', (t) => {
  const formatter = new Formatter(testTheme)

  const returnValue = formatter.prepend('test')

  t.is(returnValue, formatter, 'prepend should return formatter instance')
})

test('prepend throws if formatter is closed', (t) => {
  const formatter = new Formatter(testTheme).close()

  t.throws(() => formatter.prepend('test'), {
    message: 'Formatter is closed',
  })
})

test('prefix adds values to the beginning of the accumulator in the order called', (t) => {
  const formatter = new Formatter(testTheme)
  t.true(formatter.empty)

  formatter.prefix('first')
  t.false(formatter.empty)

  formatter.append('third')
  formatter.prefix('second')
  formatter.close()

  const values = Array.from(formatter)

  // The prefix method adds values at the beginning
  t.true(values.includes('first'))
  t.true(values.includes('second'))
  t.true(values.includes('third'))

  // Now test the actual order
  t.true(values.indexOf('first') < values.indexOf('second'))
  t.true(values.indexOf('second') < values.indexOf('third'))
})

test('prefix returns the formatter instance for chaining', (t) => {
  const formatter = new Formatter(testTheme)

  const returnValue = formatter.prefix('test')

  t.is(returnValue, formatter, 'prefix should return formatter instance')
})

// -----------------------------------------------------------------------------
// open/close tests
// -----------------------------------------------------------------------------

test('open creates a new deeper formatter', (t) => {
  const formatter = new Formatter(testTheme)
  const child = formatter.open()

  t.is(child.theme, testTheme)
  t.not(formatter, child)

  // Child should be one level deeper
  child.append('child content').close()

  formatter.close()

  const values = Array.from(formatter)
  t.is(values.length, 4)
  t.is(values[0], 1) // Parent depth
  t.is(values[1], 2) // Child depth
  t.is(values[2], 'child content') // Child content
  t.is(values[3], 1) // Parent depth again
})

test('close returns the formatter instance for chaining', (t) => {
  const formatter = new Formatter(testTheme)

  const returnValue = formatter.close()

  t.is(returnValue, formatter, 'close should return formatter instance')
})

test('close prevents further modifications', (t) => {
  const formatter = new Formatter(testTheme).append('test').close()

  // Operations after close should throw
  t.throws(() => formatter.append('more'), {
    message: 'Formatter is closed',
  })

  t.throws(() => formatter.prefix('more'), {
    message: 'Formatter is closed',
  })

  t.throws(() => formatter.open(), {
    message: 'Formatter is closed',
  })
})

test('close with value returns the formatter instance for chaining', (t) => {
  const formatter = new Formatter(testTheme)

  const returnValue = formatter.close('test value')

  t.is(returnValue, formatter, 'close with value should return formatter instance')
})

test('close with value effectively appends the value', (t) => {
  const formatter = new Formatter(testTheme)

  // Create a child formatter to test parent depth behavior
  const child = formatter.open().append('child content')

  // Close with a value - should be at parent depth (1)
  child.close('child close')
  formatter.close()

  const result = formatter.render()
  t.is(result, 'child contentchild close')
})

test('close with value adds the value at parent depth', (t) => {
  const formatter = new Formatter(testTheme)

  // Create a child formatter with a line marker
  const child = formatter.open().append('child line', Formatter.lineMarker)

  // Close with a value - should be at parent depth (1) with proper indentation
  child.close('closing content')
  formatter.close()

  const result = formatter.render()
  t.is(result, 'child line\n  closing content')
})

test('close with value respects parent depth in nested formatters', (t) => {
  const formatter = new Formatter(testTheme)

  // Create a deeply nested structure
  formatter.append('root', Formatter.lineMarker)

  const level1 = formatter.open()
  level1.append('level 1', Formatter.lineMarker)

  const level2 = level1.open()
  level2.append('level 2', Formatter.lineMarker)

  // Close with values at each level
  level2.close('level 2 close')
  level1.append(Formatter.lineMarker)
  level1.close('level 1 close')
  formatter.close()

  const indent1 = testTheme.indent
  const indent2 = testTheme.indent.repeat(2)
  const indent3 = testTheme.indent.repeat(3)

  const expectedResult =
    'root\n' + `${indent2}level 1\n` + `${indent3}level 2\n` + `${indent2}level 2 close\n${indent1}level 1 close`

  t.is(formatter.render(), expectedResult)
})

test('close with value at root uses depth 0', (t) => {
  // Test case for root formatter (depth 0)
  const formatter = new Formatter(testTheme)
  formatter.append('content')
  formatter.close(' with suffix')

  t.is(formatter.render(), 'content with suffix')
})

// -----------------------------------------------------------------------------
// wrap tests
// -----------------------------------------------------------------------------

test('cannot be iterated unless closed', (t) => {
  const formatter = new Formatter(testTheme).append('test')

  // Attempting to iterate before closing should throw
  t.throws(() => Array.from(formatter), {
    message: 'Formatter is not closed',
  })

  formatter.close()

  // Now it should work
  t.notThrows(() => Array.from(formatter))
})

// -----------------------------------------------------------------------------
// wrap tests
// -----------------------------------------------------------------------------

test('wrap combines open and close strings around a value', (t) => {
  const formatter = new Formatter(testTheme)

  // Standard wrappable path test
  const wrappedArray = formatter.wrap('array.bracket', 'hello')
  t.is(wrappedArray, '[hello]')

  // Custom properties test
  const wrappedObject = formatter.wrap('object.bracket', 'content', 'open', 'close')
  t.is(wrappedObject, '{content}')
})

test('appendWrapped adds wrapped content in order', (t) => {
  const formatter = new Formatter(testTheme)

  // Standard wrappable path
  formatter.appendWrapped('array.bracket', 'first')

  // Custom properties
  formatter.appendWrapped('object.bracket', 'second', 'open', 'close')

  // Add a third wrapped element
  formatter.appendWrapped('array.bracket', 'third')

  formatter.close()

  const values = Array.from(formatter)
  t.true(values.includes('[first]'))
  t.true(values.includes('{second}'))
  t.true(values.includes('[third]'))
  // The order of values should follow the append order
  t.true(values.indexOf('[first]') < values.indexOf('{second}'))
  t.true(values.indexOf('{second}') < values.indexOf('[third]'))
})

test('appendWrapped returns the formatter instance for chaining', (t) => {
  const formatter = new Formatter(testTheme)

  const returnValue = formatter.appendWrapped('array.bracket', 'content')

  t.is(returnValue, formatter, 'appendWrapped should return formatter instance')
})

test('prefixWrapped adds wrapped content at the beginning in the order called', (t) => {
  const formatter = new Formatter(testTheme)

  formatter.append('third')
  formatter.prefixWrapped('array.bracket', 'first')
  formatter.prefixWrapped('object.bracket', 'second', 'open', 'close')

  formatter.close()

  const values = Array.from(formatter)
  t.true(values.includes('[first]'))
  t.true(values.includes('{second}'))
  t.true(values.includes('third'))

  // Now test the actual order
  t.true(values.indexOf('[first]') < values.indexOf('{second}'))
  t.true(values.indexOf('{second}') < values.indexOf('third'))
})

test('prefixWrapped returns the formatter instance for chaining', (t) => {
  const formatter = new Formatter(testTheme)

  const returnValue = formatter.prefixWrapped('array.bracket', 'content')

  t.is(returnValue, formatter, 'prefixWrapped should return formatter instance')
})

// -----------------------------------------------------------------------------
// maxDepth tests
// -----------------------------------------------------------------------------

test('respects maxDepth for nested formatters', (t) => {
  const maxDepth = 2
  const formatter = new Formatter(testTheme, 0, maxDepth)

  t.false(formatter.maxDepthReached)

  const level1 = formatter.open()
  t.false(level1.maxDepthReached)

  const level2 = level1.open()
  t.true(level2.maxDepthReached)
})

// -----------------------------------------------------------------------------
// Symbol.iterator tests
// -----------------------------------------------------------------------------

test('yields all accumulated values and depth values', (t) => {
  const formatter = new Formatter(testTheme).append('one', 'two').append('three')
  formatter.open().append('child').close()
  formatter.append('four').close()

  const values = Array.from(formatter)
  t.is(values.length, 8) // depth, 'one', 'two', 'three', depth, 'child', depth, 'four'
  t.is(values[0], 1) // The depth marker added by the parent formatter
  t.is(values[1], 'one')
  t.is(values[2], 'two')
  t.is(values[3], 'three')
  t.is(values[4], 2) // The depth marker added by the child formatter
  t.is(values[5], 'child') // From the child formatter
  t.is(values[6], 1) // The depth marker added by the parent formatter
  t.is(values[7], 'four')
})

// -----------------------------------------------------------------------------
// render tests
// -----------------------------------------------------------------------------

test('render returns empty string for empty formatter', (t) => {
  const formatter = new Formatter(testTheme).close()

  t.is(formatter.render(), '')
})

test('render with simple strings', (t) => {
  const formatter = new Formatter(testTheme).append('hello', ' ', 'world').close()

  t.is(formatter.render(), 'hello world')
})

test('render with line markers adds newline', (t) => {
  const formatter = new Formatter(testTheme).append('first line', Formatter.lineMarker, 'second line').close()

  t.is(formatter.render(), 'first line\n  second line')
})

test('render skips empty strings after line markers', (t) => {
  const formatter = new Formatter(testTheme)
  formatter.open().append('first line', Formatter.lineMarker, '', Formatter.lineMarker).close()
  formatter.close()

  t.is(formatter.render(), 'first line\n\n')
})

test('render with nested formatters', (t) => {
  const formatter = new Formatter(testTheme)
  formatter.append('parent start', Formatter.lineMarker)

  // Create a nested formatter with deeper indentation level
  const child = formatter.open() // This adds the child iterator and depth (2) to parent

  // Content from the child formatter will be indented based on its depth (2); because the last entry in the parent is a
  // line marker
  child.append('child content')
  child.close()

  // Content at the parent level appears without extra indentation
  formatter.append(Formatter.lineMarker, 'parent end')
  formatter.close()

  // The child is at depth 2, so its content should be indented twice
  const indent = testTheme.indent.repeat(2)
  t.is(formatter.render(), `parent start\n${indent}child content\n  parent end`)
})

test('render with complex nesting and indentation', (t) => {
  // Create a formatter that resembles a typical object output
  const formatter = new Formatter(testTheme)

  // Object opening - at the top level
  formatter.append('{', Formatter.lineMarker)

  // First property - at the top level
  formatter.append('prop1: "value1",', Formatter.lineMarker)

  // Nested object property - also at depth 1, same as prop1
  formatter.append('prop2: ', '{', Formatter.lineMarker)

  // Content of nested object - in a deeper formatter (depth 2)
  const nestedObj = formatter.open() // Increases depth to 2
  nestedObj.append('nestedProp: "nestedValue"', Formatter.lineMarker)
  nestedObj.close('}') // Closes the nested object, returns to depth 1

  // "Close" main object - at top level
  formatter.append(Formatter.lineMarker)
  formatter.close('}')

  const indent1 = testTheme.indent
  const indent2 = testTheme.indent.repeat(2)

  // Now we should get proper indentation through the whole structure
  const expected =
    '{\n' +
    `${indent1}prop1: "value1",\n` +
    `${indent1}prop2: {\n` +
    `${indent2}nestedProp: "nestedValue"\n` +
    `${indent1}}\n` +
    '}'

  t.is(formatter.render(), expected)
})

test('render throws if formatter is not closed', (t) => {
  const formatter = new Formatter(testTheme).append('test')

  t.throws(() => formatter.render(), {
    message: 'Formatter is not closed',
  })
})

test('render with multiple line markers in sequence', (t) => {
  const formatter = new Formatter(testTheme)
    .append('start', Formatter.lineMarker, Formatter.lineMarker, 'double newline')
    .close()

  t.is(formatter.render(), 'start\n\n  double newline')
})

// -----------------------------------------------------------------------------
// encodeTypicalIdentifier tests
// -----------------------------------------------------------------------------

test('encodeTypicalIdentifier leaves valid identifier characters unchanged', (t) => {
  const formatter = new Formatter(testTheme)

  // Valid characters for JS identifiers
  const validIdentifier = 'abc123_$XYZ'
  t.is(formatter.encodeTypicalIdentifier(validIdentifier), validIdentifier)

  // Unicode characters that are valid in identifiers
  const unicodeIdentifier = 'αβγ_한글_привет'
  t.is(formatter.encodeTypicalIdentifier(unicodeIdentifier), unicodeIdentifier)
})

test('encodeTypicalIdentifier escapes common control characters', (t) => {
  const formatter = new Formatter(testTheme)

  // Test null byte
  t.is(formatter.encodeTypicalIdentifier('\0'), '\\0')

  // Test whitespace characters
  t.is(formatter.encodeTypicalIdentifier('\n'), '\\n')
  t.is(formatter.encodeTypicalIdentifier('\r'), '\\r')
  t.is(formatter.encodeTypicalIdentifier('\t'), '\\t')
  t.is(formatter.encodeTypicalIdentifier('\v'), '\\v')
  t.is(formatter.encodeTypicalIdentifier('\f'), '\\f')
  t.is(formatter.encodeTypicalIdentifier('\b'), '\\b')

  // Test with multiple characters
  t.is(formatter.encodeTypicalIdentifier('a\nb\tc'), 'a\\nb\\tc')

  // Test ANSI escape code
  t.is(formatter.encodeTypicalIdentifier('\u001B'), '␛')
})

test('encodeTypicalIdentifier escapes quotes and backslashes', (t) => {
  const formatter = new Formatter(testTheme)

  // Test quotes
  t.is(formatter.encodeTypicalIdentifier('"'), '\\"')
  t.is(formatter.encodeTypicalIdentifier("'"), "\\'")

  // Test backslash
  t.is(formatter.encodeTypicalIdentifier('\\'), '\\\\')

  // Test combined
  t.is(formatter.encodeTypicalIdentifier('a\\"b\'c'), 'a\\\\\\"b\\\'c')
})

test('encodeTypicalIdentifier escapes BMP Unicode characters', (t) => {
  const formatter = new Formatter(testTheme)

  // Space (ASCII)
  t.is(formatter.encodeTypicalIdentifier(' '), '\\u0020')

  // Some punctuation
  t.is(formatter.encodeTypicalIdentifier('!'), '\\u0021')
  t.is(formatter.encodeTypicalIdentifier('@'), '\\u0040')

  // Emoji within BMP range
  t.is(formatter.encodeTypicalIdentifier('©'), '\\u00a9')
  t.is(formatter.encodeTypicalIdentifier('—'), '\\u2014')
})

test('encodeTypicalIdentifier escapes astral plane Unicode characters', (t) => {
  const formatter = new Formatter(testTheme)

  // Astral plane characters (emoji and others)
  t.is(formatter.encodeTypicalIdentifier('𠮷'), '𠮷') // U+20BB7 CJK Unified Ideograph
  t.is(formatter.encodeTypicalIdentifier('🎉'), '\\u{1f389}') // U+1F389 PARTY POPPER

  // Mixed with regular text
  t.is(formatter.encodeTypicalIdentifier('hi🎉'), 'hi\\u{1f389}')
})

test('encodeTypicalIdentifier handles combination of different character types', (t) => {
  const formatter = new Formatter(testTheme)

  // Mix of regular chars, control chars, and Unicode
  const complex = 'a\n©🎉\\"\''
  const expected = 'a\\n\\u00a9\\u{1f389}\\\\\\"\\\''
  t.is(formatter.encodeTypicalIdentifier(complex), expected)

  // Multiple escapes in sequence
  t.is(formatter.encodeTypicalIdentifier('\n\r\t'), '\\n\\r\\t')
})

test('encodeTypicalIdentifier handles empty string', (t) => {
  const formatter = new Formatter(testTheme)
  t.is(formatter.encodeTypicalIdentifier(''), '')
})

// -----------------------------------------------------------------------------
// encodeTypicalSimpleString tests
// -----------------------------------------------------------------------------

test('encodeTypicalSimpleString leaves most characters unchanged', (t) => {
  const formatter = new Formatter(testTheme)

  // Normal ASCII and Unicode text
  const normalText = 'Hello, world! αβγ 123'
  t.is(formatter.encodeTypicalSimpleString(normalText), normalText)

  // Valid identifier characters and punctuation
  const textWithPunctuation = 'abc123_$XYZ@#;:[]{}'
  t.is(formatter.encodeTypicalSimpleString(textWithPunctuation), textWithPunctuation)

  // Characters that are Unicode but not in special ranges
  const unicodeText = 'αβγ한글привет'
  t.is(formatter.encodeTypicalSimpleString(unicodeText), unicodeText)
})

test('encodeTypicalSimpleString escapes control characters', (t) => {
  const formatter = new Formatter(testTheme)

  // Test null byte
  t.is(formatter.encodeTypicalSimpleString('\0'), '\\0')

  // Test whitespace characters
  t.is(formatter.encodeTypicalSimpleString('\n'), '\\n')
  t.is(formatter.encodeTypicalSimpleString('\r'), '\\r')
  t.is(formatter.encodeTypicalSimpleString('\t'), '\\t')
  t.is(formatter.encodeTypicalSimpleString('\v'), '\\v')
  t.is(formatter.encodeTypicalSimpleString('\f'), '\\f')
  t.is(formatter.encodeTypicalSimpleString('\b'), '\\b')

  // Test with multiple characters
  t.is(formatter.encodeTypicalSimpleString('a\nb\tc'), 'a\\nb\\tc')

  // Test ANSI escape code
  t.is(formatter.encodeTypicalSimpleString('\u001B'), '␛')
})

test('encodeTypicalSimpleString escapes quotes and backslashes', (t) => {
  const formatter = new Formatter(testTheme)

  // Test double quote
  t.is(formatter.encodeTypicalSimpleString('"'), '\\"')

  // Test single quote
  t.is(formatter.encodeTypicalSimpleString("'"), "\\'")

  // Test backslash (already covered in another test but included here for completeness)
  t.is(formatter.encodeTypicalSimpleString('\\'), '\\\\')

  // Test combined with text
  t.is(formatter.encodeTypicalSimpleString('Say "hello" and \'world\''), 'Say \\"hello\\" and \\\'world\\\'')

  // Test escaped quotes
  t.is(formatter.encodeTypicalSimpleString('\\ \\ "'), '\\\\ \\\\ \\"')
  t.is(formatter.encodeTypicalSimpleString("\\ \\ '"), "\\\\ \\\\ \\'")
})

test('encodeTypicalSimpleString escapes backslash', (t) => {
  const formatter = new Formatter(testTheme)

  // Test backslash
  t.is(formatter.encodeTypicalSimpleString('\\'), '\\\\')

  // Test in a string
  t.is(formatter.encodeTypicalSimpleString('path\\to\\file'), 'path\\\\to\\\\file')
})

test('encodeTypicalSimpleString escapes control characters in ranges', (t) => {
  const formatter = new Formatter(testTheme)

  // ASCII control characters (C0 controls: \u0000-\u001F)
  t.is(formatter.encodeTypicalSimpleString('\u0001'), '\\u0001')
  t.is(formatter.encodeTypicalSimpleString('\u001F'), '\\u001f')

  // ASCII DEL and C1 controls (\u007F-\u009F)
  t.is(formatter.encodeTypicalSimpleString('\u007F'), '\\u007f')
  t.is(formatter.encodeTypicalSimpleString('\u0080'), '\\u0080')
  t.is(formatter.encodeTypicalSimpleString('\u009F'), '\\u009f')
})

test('encodeTypicalSimpleString handles astral plane Unicode characters correctly', (t) => {
  const formatter = new Formatter(testTheme)

  // Normal astral plane characters (like emoji) are not escaped
  t.is(formatter.encodeTypicalSimpleString('𠮷'), '𠮷') // U+20BB7 CJK Unified Ideograph
  t.is(formatter.encodeTypicalSimpleString('🎉'), '🎉') // U+1F389 PARTY POPPER

  // Mixed with regular text
  t.is(formatter.encodeTypicalSimpleString('hi🎉'), 'hi🎉')
})

test('encodeTypicalSimpleString handles empty string', (t) => {
  const formatter = new Formatter(testTheme)

  t.is(formatter.encodeTypicalSimpleString(''), '')
})

test('encodeTypicalSimpleString and encodeTypicalIdentifier encode different character sets', (t) => {
  const formatter = new Formatter(testTheme)

  // Characters that are encoded differently between the two methods:

  // 1. Space - encoded in identifiers but not in strings
  t.is(formatter.encodeTypicalIdentifier(' '), '\\u0020')
  t.is(formatter.encodeTypicalSimpleString(' '), ' ')

  // 2. Punctuation - encoded in identifiers but not in strings
  t.is(formatter.encodeTypicalIdentifier('!'), '\\u0021')
  t.is(formatter.encodeTypicalSimpleString('!'), '!')

  t.is(formatter.encodeTypicalIdentifier('@'), '\\u0040')
  t.is(formatter.encodeTypicalSimpleString('@'), '@')

  // 3. Emoji in astral plane - encoded in identifiers but not in strings
  t.is(formatter.encodeTypicalIdentifier('🎉'), '\\u{1f389}')
  t.is(formatter.encodeTypicalSimpleString('🎉'), '🎉')

  // 4. Non-identifier Unicode that's valid in strings is handled differently
  t.is(formatter.encodeTypicalIdentifier('→'), '\\u2192') // Right arrow
  t.is(formatter.encodeTypicalSimpleString('→'), '→')

  // Test with a complex mixed string
  const mixed = 'Hello! "Test" with →🎉 and \t\n'
  t.is(
    formatter.encodeTypicalIdentifier(mixed),
    'Hello\\u0021\\u0020\\"Test\\"\\u0020with\\u0020\\u2192\\u{1f389}\\u0020and\\u0020\\t\\n',
  )
  t.is(formatter.encodeTypicalSimpleString(mixed), 'Hello! \\"Test\\" with →🎉 and \\t\\n')
})
