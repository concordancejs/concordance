const test = require('ava')

const concordance = require('..')

function objectWithGetter (values) {
  let callCount = 0
  const object = {}

  Object.defineProperty(object, 'value', {
    enumerable: true,
    get () {
      return values[callCount++]
    },
  })

  return {
    object,
    get callCount () {
      return callCount
    },
  }
}

test('compare() invokes object property getters', t => {
  const subject = objectWithGetter(['actual'])

  t.true(concordance.compare(subject.object, { value: 'actual' }).pass)
  t.is(subject.callCount, 1)
})

test('formatDescriptor() reuses the first getter value for a descriptor', t => {
  const subject = objectWithGetter([1, 2, 3])
  const descriptor = concordance.describe(subject.object)

  t.is(subject.callCount, 0)
  t.regex(concordance.formatDescriptor(descriptor), /value: 1/)
  t.regex(concordance.formatDescriptor(descriptor), /value: 1/)
  t.is(subject.callCount, 1)
})

test('compareDescriptors() reuses the first getter value after formatting', t => {
  const subject = objectWithGetter([1, 2])
  const descriptor = concordance.describe(subject.object)

  t.regex(concordance.formatDescriptor(descriptor), /value: 1/)
  t.true(concordance.compareDescriptors(descriptor, concordance.describe({ value: 1 })))
  t.false(concordance.compareDescriptors(descriptor, concordance.describe({ value: 2 })))
  t.is(subject.callCount, 1)
})
