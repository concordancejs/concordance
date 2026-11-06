'use strict'

const { spawnSync } = require('child_process')
const path = require('path')

const root = path.resolve(__dirname, '..')
const env = { ...process.env }
const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH'
env[pathKey] = path.dirname(process.execPath) + path.delimiter + (env[pathKey] || '')

console.log(`Verifying with ${process.version}: ${process.execPath}`)
const commands = [
  ['node_modules/@novemberborn/eslint-plugin-as-i-preach/cli.js'],
  ['node_modules/c8/bin/c8.js', process.execPath, 'node_modules/ava/cli.js', '--tap'],
]

for (const args of commands) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.exitCode = result.status || 1
    break
  }
}
