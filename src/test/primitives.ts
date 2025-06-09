import test from 'ava'
import { isPrimitive, representPrimitive } from '../primitives.ts'
import { DescriptionContext } from '../description-context.ts'
import { StringRepresentation } from '../values/primitives/string.ts'
import { NumberRepresentation } from '../values/primitives/number.ts'
import { BooleanRepresentation } from '../values/primitives/boolean.ts'
import { NullRepresentation } from '../values/primitives/null.ts'
import { UndefinedRepresentation } from '../values/primitives/undefined.ts'
import { BigIntRepresentation } from '../values/primitives/bigint.ts'
import { SymbolRepresentation } from '../values/primitives/symbol.ts'

// -----------------------------------------------------------------------------
// isPrimitive tests
// -----------------------------------------------------------------------------

test('isPrimitive identifies primitive values correctly', (t) => {
  // Primitive values
  t.true(isPrimitive(null))
  t.true(isPrimitive(undefined))
  t.true(isPrimitive(true))
  t.true(isPrimitive(false))
  t.true(isPrimitive(0))
  t.true(isPrimitive(42))
  t.true(isPrimitive('string'))
  t.true(isPrimitive(''))
  t.true(isPrimitive(Symbol('test')))
  t.true(isPrimitive(BigInt(123)))

  // Non-primitive values
  t.false(isPrimitive({}))
  t.false(isPrimitive([]))
  t.false(isPrimitive(new Date()))
  t.false(isPrimitive(new Map()))
  t.false(
    isPrimitive(() => {
      // No-op
    }),
  )
  t.false(isPrimitive(new Object(42))) // Boxed primitive
})

// -----------------------------------------------------------------------------
// representPrimitive tests
// -----------------------------------------------------------------------------

test('representPrimitive returns correct representation for null', (t) => {
  const context = new DescriptionContext()
  const representation = representPrimitive(context, null)

  t.true(representation instanceof NullRepresentation)
})

test('representPrimitive returns correct representation for undefined', (t) => {
  const context = new DescriptionContext()
  const representation = representPrimitive(context, undefined)

  t.true(representation instanceof UndefinedRepresentation)
})

test('representPrimitive returns correct representation for booleans', (t) => {
  const context = new DescriptionContext()

  const trueRepresentation = representPrimitive(context, true)
  t.true(trueRepresentation instanceof BooleanRepresentation)

  const falseRepresentation = representPrimitive(context, false)
  t.true(falseRepresentation instanceof BooleanRepresentation)
})

test('representPrimitive returns correct representation for numbers', (t) => {
  const context = new DescriptionContext()

  const regularNumber = representPrimitive(context, 42)
  t.true(regularNumber instanceof NumberRepresentation)

  const zero = representPrimitive(context, 0)
  t.true(zero instanceof NumberRepresentation)

  const negative = representPrimitive(context, -123.45)
  t.true(negative instanceof NumberRepresentation)

  const infinite = representPrimitive(context, Infinity)
  t.true(infinite instanceof NumberRepresentation)

  const nan = representPrimitive(context, Number.NaN)
  t.true(nan instanceof NumberRepresentation)
})

test('representPrimitive returns correct representation for bigints', (t) => {
  const context = new DescriptionContext()

  const bigInt = representPrimitive(context, BigInt(123))
  t.true(bigInt instanceof BigIntRepresentation)

  const zeroBigInt = representPrimitive(context, BigInt(0))
  t.true(zeroBigInt instanceof BigIntRepresentation)

  const negativeBigInt = representPrimitive(context, BigInt(-9_007_199_254_740_991))
  t.true(negativeBigInt instanceof BigIntRepresentation)
})

test('representPrimitive returns correct representation for strings', (t) => {
  const context = new DescriptionContext()

  const regularString = representPrimitive(context, 'hello')
  t.true(regularString instanceof StringRepresentation)

  const emptyString = representPrimitive(context, '')
  t.true(emptyString instanceof StringRepresentation)

  const multilineString = representPrimitive(context, 'line 1\nline 2')
  t.true(multilineString instanceof StringRepresentation)
})

test('representPrimitive returns correct representation for symbols', (t) => {
  const context = new DescriptionContext()

  const regularSymbol = Symbol('test')
  const symbolRep = representPrimitive(context, regularSymbol)
  t.true(symbolRep instanceof SymbolRepresentation)

  const wellKnownSymbol = Symbol.iterator
  const wellKnownRep = representPrimitive(context, wellKnownSymbol)
  t.true(wellKnownRep instanceof SymbolRepresentation)

  const registeredSymbol = Symbol.for('registered')
  const registeredRep = representPrimitive(context, registeredSymbol)
  t.true(registeredRep instanceof SymbolRepresentation)
})

test('representPrimitive throws for non-primitive values', (t) => {
  const context = new DescriptionContext()

  // Objects aren't primitives, so representPrimitive should throw when called with them
  t.throws(() => representPrimitive(context, {}), { name: 'TypeError', message: 'Not a primitive value' })
  t.throws(() => representPrimitive(context, []), { name: 'TypeError', message: 'Not a primitive value' })
  t.throws(
    () =>
      representPrimitive(context, () => {
        // No-op
      }),
    { name: 'TypeError', message: 'Not a primitive value' },
  )
})

test('representPrimitive uses context for symbol representation', (t) => {
  // Mock the context to verify it's passed to SymbolRepresentation
  const mockContext = {
    deserialized: false,
    describeSymbol: () => ({ string: 'mock-symbol', key: undefined, wellKnown: undefined }),
  } as unknown as DescriptionContext

  const symbol = Symbol('test')
  const representation = representPrimitive(mockContext, symbol)

  t.true(representation instanceof SymbolRepresentation)
})
