const config = {
  files: ['src/**/*.test.ts'],
  extensions: {
    ts: 'module',
  },
  nodeArguments: ['--disable-warning=ExperimentalWarning', '--experimental-strip-types'],
}

export default config
