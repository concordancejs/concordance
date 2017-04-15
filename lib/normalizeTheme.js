'use strict'

const cloneDeep = require('lodash.clonedeep')
const merge = require('lodash.merge')

const cache = new WeakMap()

const defaultTheme = {
  boolean: { open: '', close: '' },
  circular: '[Circular]',
  date: {
    value: { open: '', close: '' }
  },
  error: {
    ctor: { open: '(', close: ')' },
    name: { open: '', close: '' }
  },
  function: {
    name: { open: '', close: '' },
    stringTag: { open: '', close: '' }
  },
  global: { open: '', close: '' },
  gutters: {
    actualIsExtraneous: '- ',
    actualIsWrong: '- ',
    expectedIsMissing: '+ ',
    neutral: '  ',
    wasExpected: '+ '
  },
  item: { after: ',' },
  list: { open: '[', close: ']' },
  mapEntry: {
    after: ',',
    separator: ' => '
  },
  null: { open: '', close: '' },
  number: { open: '', close: '' },
  object: {
    open: '{',
    close: '}',
    ctor: { open: '', close: '' },
    stringTag: { open: '@', close: '' },
    secondaryStringTag: { open: '@', close: '' }
  },
  property: {
    after: ',',
    keyBracket: { open: '[', close: ']' },
    separator: ': '
  },
  regexp: {
    source: { open: '/', close: '/' },
    flags: { open: '', close: '' },
    separator: '---'
  },
  stats: { separator: '---' },
  string: {
    open: '',
    close: '',
    line: { open: "'", close: "'", escapeQuote: "'" },
    multiline: { open: '`', close: '`' },
    controlPicture: { open: '', close: '' },
    diff: {
      insert: { open: '', close: '' },
      delete: { open: '', close: '' },
      equal: { open: '', close: '' },
      insertLine: {
        open: '',
        close: ''
      },
      deleteLine: {
        open: '',
        close: ''
      }
    }
  },
  symbol: { open: '', close: '' },
  typedArray: {
    bytes: { open: '', close: '' }
  },
  undefined: { open: '', close: '' }
}

function normalizeTheme (theme) {
  if (!theme) return defaultTheme
  if (cache.has(theme)) return cache.get(theme)

  const normalized = merge(cloneDeep(defaultTheme), theme)
  cache.set(theme, normalized)
  return normalized
}
module.exports = normalizeTheme
