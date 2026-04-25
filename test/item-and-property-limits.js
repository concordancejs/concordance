'use strict'

const test = require('ava')
const concordance = require('..')

test('format() respects maxItems option', t => {
  const result = concordance.format([1, 2, 3, 4, 5], {
    maxItems: 2,
  })

  t.true(result.includes('1,'))
  t.true(result.includes('2,'))
  t.false(result.includes('3,'))
  t.false(result.includes('4,'))
  t.false(result.includes('5,'))
})

test('format() respects maxProperties option', t => {
  const result = concordance.format({
    a: 1,
    b: 2,
    c: 3,
    d: 4,
    e: 5,
  }, {
    maxProperties: 2,
  })

  t.true(result.includes('a: 1,'))
  t.true(result.includes('b: 2,'))
  t.false(result.includes('c: 3,'))
  t.false(result.includes('d: 4,'))
  t.false(result.includes('e: 5,'))
})

test('diff() limits equal nested items and properties', t => {
  const result = concordance.diff({
    changed: 1,
    equalObject: {
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5,
    },
    equalArray: [1, 2, 3, 4, 5],
  }, {
    changed: 999,
    equalObject: {
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5,
    },
    equalArray: [1, 2, 3, 4, 5],
  }, {
    maxProperties: 2,
    maxItems: 2,
  })

  t.true(result.includes('-   changed: 1,'))
  t.true(result.includes('+   changed: 999,'))
  t.true(result.includes('equalArray: ['))
  t.true(result.includes('      1,'))
  t.true(result.includes('      2,'))
  t.false(result.includes('      3,'))
  t.false(result.includes('      4,'))
  t.false(result.includes('      5,'))
  t.true(result.includes('equalObject: {'))
  t.true(result.includes('      a: 1,'))
  t.true(result.includes('      b: 2,'))
  t.false(result.includes('      c: 3,'))
  t.false(result.includes('      d: 4,'))
  t.false(result.includes('      e: 5,'))
})
