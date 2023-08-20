export default {
  sourceType: 'module',
  plugins: ['@novemberborn/as-i-preach'],
  extends: ['plugin:@novemberborn/as-i-preach/nodejs'],
  overrides: [
    {
      files: ['test/**/*.js'],
      rules: {
        'no-new-object': 'off',
        strict: 'off',
      },
    },
  ],
}
