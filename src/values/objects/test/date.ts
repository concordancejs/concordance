import test from 'ava'
import { DescriptionContext } from '../../../describe.ts'
import { Encoder } from '../../../serialize.ts'
import { Decoder, DeserializationContext } from '../../../deserialize.ts'
import { DateRepresentation } from '../date.ts'
import { comparable, strictlyEqual, unequal } from '../../../comparison.ts'
import { staticTypeTable } from '../../../serialization-types.ts'
import { snapshotEncoded } from '../../test/helpers/snapshot-encoded.ts'

// Use the first commit timestamp for testing
const FIRST_COMMIT_DATE = new Date('2017-02-17T16:58:13Z')

// Deserialize method test
test('deserialize creates a comparable DateRepresentation', (t) => {
  const originalContext = new DescriptionContext()
  const date = FIRST_COMMIT_DATE
  const original = originalContext.represent(date) as DateRepresentation

  const encoder = new Encoder()
  original.serialize(encoder)

  const decoder = new Decoder(encoder.bytes)
  decoder.staticType() // Consume the type
  const deserializationContext = new DeserializationContext(decoder)
  const deserialized = DateRepresentation.deserialize(deserializationContext, decoder)

  // The deserialized representation should be comparable to the original
  t.is(original.compare(deserialized), comparable)
})

// Compare method tests
test('compare returns strictlyEqual when comparing the same date instance', (t) => {
  const context = new DescriptionContext()
  const date = FIRST_COMMIT_DATE

  const dateRep1 = context.represent(date) as DateRepresentation
  const dateRep2 = context.represent(date) as DateRepresentation

  t.is(dateRep1.compare(dateRep2), strictlyEqual)
})

test('compare returns unequal when comparing to non-DateRepresentation', (t) => {
  const context = new DescriptionContext()
  const date = FIRST_COMMIT_DATE
  const obj = {}

  const dateRep = context.represent(date) as DateRepresentation
  const objRep = context.represent(obj)

  t.is(dateRep.compare(objRep), unequal)
})

test('compare returns unequal when comparing dates with different timestamps', (t) => {
  const context = new DescriptionContext()
  const date1 = FIRST_COMMIT_DATE
  const date2 = new Date(FIRST_COMMIT_DATE.getTime() + 1000) // Add 1 second

  const dateRep1 = context.represent(date1) as DateRepresentation
  const dateRep2 = context.represent(date2) as DateRepresentation

  t.is(dateRep1.compare(dateRep2), unequal)
})

test('compare returns comparable when comparing different date instances with same timestamp', (t) => {
  const context = new DescriptionContext()
  // Create two different Date instances with the same timestamp
  const date1 = new Date(FIRST_COMMIT_DATE.getTime())
  const date2 = new Date(FIRST_COMMIT_DATE.getTime())

  const dateRep1 = context.represent(date1) as DateRepresentation
  const dateRep2 = context.represent(date2) as DateRepresentation

  // Should be comparable, not strictly equal, as they are different instances
  t.is(dateRep1.compare(dateRep2), comparable)
})

test('compare handles invalid dates correctly', (t) => {
  const context = new DescriptionContext()

  // Create invalid date objects
  const invalidDate1 = new Date('invalid')
  const invalidDate2 = new Date('invalid')

  // Verify that these are indeed invalid dates
  t.true(Number.isNaN(invalidDate1.getTime()))
  t.true(Number.isNaN(invalidDate2.getTime()))

  const invalidDateRep1 = context.represent(invalidDate1) as DateRepresentation
  const invalidDateRep2 = context.represent(invalidDate2) as DateRepresentation

  // Two invalid dates should be comparable
  t.is(invalidDateRep1.compare(invalidDateRep2), comparable)

  // An invalid date should be unequal to a valid date
  const validDate = FIRST_COMMIT_DATE
  const validDateRep = context.represent(validDate) as DateRepresentation

  t.is(invalidDateRep1.compare(validDateRep), unequal)
})

// iterateArrayLike and iterateIterable tests
test('iterateArrayLike yields no elements for dates', (t) => {
  const context = new DescriptionContext()
  const date = FIRST_COMMIT_DATE
  const dateRep = context.represent(date) as DateRepresentation

  const elements = [...dateRep.iterateArrayLike()]

  t.is(elements.length, 0)
})

test('iterateIterable yields no elements for dates', (t) => {
  const context = new DescriptionContext()
  const date = FIRST_COMMIT_DATE
  const dateRep = context.represent(date) as DateRepresentation

  const iterables = [...dateRep.iterateIterable()]

  t.is(iterables.length, 0)
})

// Serialization tests
test('serialize uses date static type and includes valueOf annotation', (t) => {
  const context = new DescriptionContext()
  const date = FIRST_COMMIT_DATE
  const dateRep = context.represent(date) as DateRepresentation

  const encoder = new Encoder()
  dateRep.serialize(encoder)

  // Check the overall structure and type
  snapshotEncoded(t, encoder, 'date serialization')

  // Verify the static type and annotations manually
  const decoder = new Decoder(encoder.bytes)
  t.is(decoder.staticType(), staticTypeTable.date)

  // Check that the valueOf annotation (v) contains the correct timestamp
  const annotations = decoder.annotations<{ v: number }>()
  t.is(annotations.v, date.valueOf())
})

test('serializing and deserializing a Date preserves its timestamp', (t) => {
  const originalContext = new DescriptionContext()

  // Test with various dates including the first commit date
  const dates = [
    FIRST_COMMIT_DATE,
    new Date(0), // Epoch
    new Date('invalid'), // Invalid date
  ]

  for (const date of dates) {
    const original = originalContext.represent(date) as DateRepresentation

    const encoder = new Encoder()
    original.serialize(encoder)

    const decoder = new Decoder(encoder.bytes)
    decoder.staticType() // Consume the type
    const deserializationContext = new DeserializationContext(decoder)
    const deserialized = DateRepresentation.deserialize(deserializationContext, decoder)

    // The original and deserialized representations should be comparable
    t.is(original.compare(deserialized), comparable, `Failed for date: ${date}`)
  }
})
