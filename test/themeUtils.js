const test = require('ava')

const themeUtils = require('../lib/themeUtils')

const noopTryDescribeValue = () => null

const themePlugin = {
  name: 'theme-utils-normalize-test',
  apiVersion: 1,
  theme: {
    number: {
      open: '(',
    },
    string: {
      open: '<',
    },
  },
  register: () => noopTryDescribeValue,
}

test('normalizes plugin themes with user theme overrides', t => {
  const userTheme = {
    number: {
      close: ')',
    },
  }

  const normalizedTheme = themeUtils.normalize({
    plugins: [themePlugin],
    theme: userTheme,
  })

  t.is(normalizedTheme.number.open, '(')
  t.is(normalizedTheme.number.close, ')')
  t.is(normalizedTheme.string.open, '<')
  t.true(Object.isFrozen(normalizedTheme))
  t.is(themeUtils.normalize({ plugins: [themePlugin], theme: userTheme }), normalizedTheme)

  const pluginTheme = themeUtils.normalize({ plugins: [themePlugin] })
  t.is(pluginTheme.number.open, '(')
  t.is(pluginTheme.string.open, '<')
  t.true(Object.isFrozen(pluginTheme))
})

test('applies descriptor modifiers without mutating the base theme', t => {
  const descriptor = {}
  const baseTheme = themeUtils.normalize()

  t.is(themeUtils.applyModifiers(descriptor, baseTheme), baseTheme)

  let calls = 0
  const openModifier = theme => {
    calls += 1
    theme.number.open = '<'
  }
  const closeModifier = theme => {
    calls += 1
    theme.number.close = '>'
  }

  themeUtils.addModifier(descriptor, openModifier)
  themeUtils.addModifier(descriptor, closeModifier)

  const modifiedTheme = themeUtils.applyModifiers(descriptor, baseTheme)

  t.not(modifiedTheme, baseTheme)
  t.true(Object.isFrozen(modifiedTheme))
  t.is(modifiedTheme.number.open, '<')
  t.is(modifiedTheme.number.close, '>')
  t.is(baseTheme.number.open, '')
  t.is(baseTheme.number.close, '')
  t.is(calls, 2)

  t.is(themeUtils.applyModifiers(descriptor, baseTheme), modifiedTheme)
  t.is(calls, 2)
})

test('applies later modifiers to the original theme', t => {
  const firstDescriptor = {}
  const secondDescriptor = {}
  const baseTheme = themeUtils.normalize({
    theme: {
      number: {
        open: '<',
        close: '>',
      },
    },
  })

  themeUtils.addModifier(firstDescriptor, theme => {
    theme.number.open = '['
  })

  const modifiedTheme = themeUtils.applyModifiers(firstDescriptor, baseTheme)

  themeUtils.addModifier(secondDescriptor, theme => {
    theme.number.close = ']'
  })

  const remodifiedTheme = themeUtils.applyModifiersToOriginal(secondDescriptor, modifiedTheme)

  t.is(remodifiedTheme.number.open, '<')
  t.is(remodifiedTheme.number.close, ']')
})
