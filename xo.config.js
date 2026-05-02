/** @type {import('xo').FlatXoConfig} */
const xoConfig = [
  {
    ignores: ['lib', 'test'],
  },
  {
    prettier: true,
    semicolon: false,
    space: true,
    rules: {
      'require-unicode-regexp': 'off',
    },
  },
  {
    files: ['src/**/test/**'],
    rules: {
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      'ava/no-conditional-assertion': 'off',
    },
  },
]

export default xoConfig
