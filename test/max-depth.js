const test = require('ava')
const { format, diff } = require('..')

const deep = {
  one: {
    two: {
      three: {
        four: {
          five: 'fin',
        },
      },
      arr: [],
      arr2: [[]],
      date: new Date('1969-07-20T20:17:40Z'),
      date2: Object.assign(new Date('1969-07-20T20:17:40Z'), { foo: 'bar' }),
      error: new Error(),
      fn () {},
      fn2: Object.assign(() => {}, { foo: 'bar' }),
      map: new Map(),
      map2: new Map([['foo', 'bar']]),
      obj: {},
      regexp: /foo/,
      regexp2: Object.assign(/foo/, { foo: 'bar' }),
      set: new Set(),
      set2: new Set(['foo']),
    },
    arr: [{ three: { four: {} } }],
    map: new Map([[{ three: { four: {} } }, { three: { four: {} } }]]),
    set: new Set([{ three: { four: {} } }]),
  },
}

test('format() respects maxDepth option', t => {
  t.snapshot(format(deep, { maxDepth: 3 }))
})

test('diff() respects maxDepth option for equal parts', t => {
  t.snapshot(diff(Object.assign({ unequal: 1 }, deep), Object.assign({ unequal: 2 }, deep), { maxDepth: 3 }))
  t.snapshot(diff({ one: { two: { three: 'baz', three2: ['quux'] } } }, { one: { two: { three: 'qux', three2: ['quux'] } } }, { maxDepth: 1 })) // eslint-disable-line max-len
})

test('properties with increased indentation respect the maxDepth when formatted', t => {
  t.snapshot(format({
    foo: {
      bar: {},
    },
  }, {
    maxDepth: 1,
    theme: {
      property: {
        increaseValueIndent: true,
      },
    },
  }))
})
