const test = require('ava')

const {
  normalize,
  addModifier,
  applyModifiers,
  applyModifiersToOriginal,
} = require('../lib/themeUtils')

test('normalize() returns cached theme for same custom theme object', t => {
  const themeOverride = { number: { open: '<', close: '>' } }
  const first = normalize({ theme: themeOverride })
  const second = normalize({ theme: themeOverride })

  t.is(first, second)
  t.is(first.number.open, '<')
  t.is(first.number.close, '>')
})

test('applyModifiers() applies and caches transformed themes', t => {
  const descriptor = {}
  const baseTheme = normalize()

  const wrapNumber = theme => {
    theme.number.open = '['
    theme.number.close = ']'
  }

  addModifier(descriptor, wrapNumber)
  const first = applyModifiers(descriptor, baseTheme)
  const second = applyModifiers(descriptor, baseTheme)

  t.not(first, baseTheme)
  t.is(first, second)
  t.is(first.number.open, '[')
  t.is(first.number.close, ']')
  t.is(baseTheme.number.open, '')
  t.is(baseTheme.number.close, '')
})

test('applyModifiersToOriginal() reuses unmodified theme as source', t => {
  const descriptor = {}
  const baseTheme = normalize()

  addModifier(descriptor, theme => {
    theme.boolean.open = '<b>'
    theme.boolean.close = '</b>'
  })
  const onceModified = applyModifiers(descriptor, baseTheme)

  addModifier(descriptor, theme => {
    theme.symbol.open = '<s>'
    theme.symbol.close = '</s>'
  })

  const fromOriginal = applyModifiersToOriginal(descriptor, onceModified)
  const direct = applyModifiers(descriptor, baseTheme)

  t.is(fromOriginal, direct)
  t.is(fromOriginal.boolean.open, '<b>')
  t.is(fromOriginal.symbol.open, '<s>')
})

