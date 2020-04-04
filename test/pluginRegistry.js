const test = require('ava')
const proxyquire = require('proxyquire')

const pluginRegistry = proxyquire('../lib/pluginRegistry', { '../package.json': { version: '1.0.0' } })

test('registration should fail when plugin name invalid', t => {
  t.throws(() => pluginRegistry.add({ name: { for: 'complex' } }), { name: 'PluginTypeError' })
})

test('registration should fail when api version unsupported', t => {
  t.throws(() => pluginRegistry.add({ name: 'complex', apiVersion: 2 }), { name: 'UnsupportedApiError' })
})

test('registration should fail when installed concordance version below minimal version required by plugin', t => {
  t.throws(() => pluginRegistry.add({ name: 'complex', apiVersion: 1, minimalConcordanceVersion: '2.0.0' }),
    { name: 'UnsupportedError' })
})

test('registration should fail when descriptor id used twice', t => {
  const plugin = {
    name: 'complex',
    apiVersion: 1,
    register: concordance => {
      concordance.addDescriptor(1, 'complexCustomValue')
      concordance.addDescriptor(1, 'complexCustomValue')
    },
  }
  t.throws(() => pluginRegistry.add(plugin), { name: 'DuplicateDescriptorIdError' })
})

test('registration should fail when descriptor tag used twice', t => {
  const plugin = {
    name: 'complex',
    apiVersion: 1,
    register: concordance => {
      concordance.addDescriptor(1, 'complexCustomValue')
      concordance.addDescriptor(2, 'complexCustomValue')
    },
  }
  t.throws(() => pluginRegistry.add(plugin), { name: 'DuplicateDescriptorTagError' })
})

test('registration should be successful', t => {
  t.plan(2)
  const tryDescribeValue = () => { } // eslint-disable-line unicorn/consistent-function-scoping
  const plugin = {
    name: 'complex',
    apiVersion: 1,
    serializerVersion: 1,
    register: concordance => {
      t.pass()
      concordance.addDescriptor(1, 'complexCustomObject', 'objectDeserializer')
      concordance.addDescriptor(2, 'complexCustomArray', 'arrayDeserializer')
      return tryDescribeValue
    },
  }

  t.snapshot(pluginRegistry.add(plugin))
})
