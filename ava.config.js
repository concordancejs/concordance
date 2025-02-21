const config = {
  files: ['src/**/test/**/*.ts', '!src/**/fixtures/**'],
  extensions: {
    ts: 'module',
  },
  nodeArguments: ['--disable-warning=ExperimentalWarning', '--experimental-strip-types'],
}

export default config
