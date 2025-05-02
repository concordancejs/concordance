const config = {
  files: ['src/**/test/**/*.ts', '!src/**/{fixtures,helpers}/**'],
  extensions: {
    ts: 'module',
  },
  nodeArguments: ['--disable-warning=ExperimentalWarning', '--experimental-strip-types'],
}

export default config
