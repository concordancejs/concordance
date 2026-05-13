const test = require('ava')

const themeUtils = require('../lib/themeUtils')

const ignoreValue = () => null

const pluginWithTheme = (name, theme) => ({
  name,
  apiVersion: 1,
  serializerVersion: 1,
  theme,
  register: () => ignoreValue,
})

test('normalizes and caches plugin themes', t => {
  const plugin = pluginWithTheme('themeUtilsPluginTheme', {
    number: { open: '<', close: '>' },
  })

  const normalized = themeUtils.normalize({ plugins: [plugin] })

  t.is(normalized.number.open, '<')
  t.is(normalized.number.close, '>')
  t.true(Object.isFrozen(normalized))
  t.true(Object.isFrozen(normalized.number))
  t.is(themeUtils.normalize({ plugins: [plugin] }), normalized)
})

test('normalizes and caches user themes layered over plugin themes', t => {
  const plugin = pluginWithTheme('themeUtilsPluginAndUserTheme', {
    number: { open: '<', close: '>' },
  })
  const theme = {
    number: { close: ']' },
  }

  const normalized = themeUtils.normalize({ plugins: [plugin], theme })

  t.is(normalized.number.open, '<')
  t.is(normalized.number.close, ']')
  t.true(Object.isFrozen(normalized.number))
  t.is(themeUtils.normalize({ plugins: [plugin], theme }), normalized)
})

test('applies and caches descriptor theme modifiers', t => {
  const descriptor = {}
  const theme = themeUtils.normalize()

  themeUtils.addModifier(descriptor, nextTheme => {
    nextTheme.number.open = '<'
  })

  const modified = themeUtils.applyModifiers(descriptor, theme)

  t.not(modified, theme)
  t.is(modified.number.open, '<')
  t.true(Object.isFrozen(modified))
  t.true(Object.isFrozen(modified.number))
  t.is(themeUtils.applyModifiers(descriptor, theme), modified)
  t.is(themeUtils.applyModifiers({}, theme), theme)
})

test('applies descriptor modifiers from the original theme', t => {
  const descriptor = {}
  const theme = themeUtils.normalize()

  themeUtils.addModifier(descriptor, nextTheme => {
    nextTheme.string.open = '<'
  })

  const modified = themeUtils.applyModifiers(descriptor, theme)

  themeUtils.addModifier(descriptor, nextTheme => {
    nextTheme.string.close = '>'
  })

  const remodified = themeUtils.applyModifiersToOriginal(descriptor, modified)

  t.not(remodified, modified)
  t.is(remodified.string.open, '<')
  t.is(remodified.string.close, '>')
  t.is(theme.string.open, '')
  t.is(theme.string.close, '')
})
