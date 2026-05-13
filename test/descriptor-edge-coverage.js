const test = require('ava')

const concordance = require('..')
const { SingleValueFormatter } = require('../lib/formatUtils')

test('compares registered symbols by registry key', t => {
  t.true(concordance.compareDescriptors(
    concordance.describe(Symbol.for('shared')),
    concordance.describe(Symbol.for('shared'))))
  t.false(concordance.compareDescriptors(
    concordance.describe(Symbol.for('shared')),
    concordance.describe(Symbol.for('other'))))
})

test('formats typed arrays with more than two byte rows', t => {
  const value = new Uint8Array(Buffer.from('decafbad'.repeat(24), 'hex'))
  const actual = concordance.format(value)

  t.true(actual.includes([
    '  decafbad decafbad decafbad decafbad decafbad decafbad decafbad decafbad',
    '  decafbad decafbad decafbad decafbad decafbad decafbad decafbad decafbad',
    '  decafbad decafbad decafbad decafbad decafbad decafbad decafbad decafbad',
  ].join('\n')))
})

test('formats constructorless objects with inherited enumerable properties as tagged objects', t => {
  const prototype = { inherited: true }
  const value = Object.create(prototype)
  Object.defineProperty(value, 'constructor', { value: undefined })

  t.is(concordance.format(value), '@Object {}')
})

test('single value formatter rejects missing and duplicate values', t => {
  const formatter = new SingleValueFormatter({}, value => value)

  t.throws(() => formatter.finalize(), {
    message: 'Formatter buffer never received a formatted value.',
  })

  formatter.append('formatted')

  t.throws(() => formatter.append('second'), {
    message: 'Formatter buffer can only take one formatted value.',
  })
  t.is(formatter.finalize(), 'formatted')
})
