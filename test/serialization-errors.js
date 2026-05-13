const test = require('ava')

const { describe } = require('..')
const encoder = require('../lib/encoder')
const { deserialize, serialize } = require('../lib/serialize')

const SERIALIZER_VERSION = 3
const describeNothing = () => null
const registerNoDescriptors = () => describeNothing

test('serialize() reports descriptors without a registered serializer', t => {
  const descriptor = { tag: Symbol('UnknownDescriptor') }

  const error = t.throws(() => serialize(descriptor), {
    name: 'DescriptorSerializationError',
    message: 'Could not serialize descriptor',
  })
  t.is(error.descriptor, descriptor)
})

test('deserialize() rejects buffers from an unsupported serializer version', t => {
  const buffer = Buffer.from(serialize(describe('compatible')))
  buffer.writeUInt16LE(SERIALIZER_VERSION + 1, 0)

  const error = t.throws(() => deserialize(buffer), {
    name: 'UnsupportedVersion',
    message: 'Could not deserialize buffer: a different serialization was expected',
  })
  t.is(error.serializerVersion, SERIALIZER_VERSION + 1)
})

test('deserialize() rejects plugins with unsupported serializer versions', t => {
  const encoded = encoder.encode(
    SERIALIZER_VERSION,
    {
      pluginIndex: 0,
      id: 0x05,
      children: [],
      state: 'plugin metadata only',
    },
    new Map([['VersionedPlugin', { serializerVersion: 1 }]]),
  )

  const error = t.throws(() => {
    deserialize(encoded, {
      plugins: [
        {
          name: 'VersionedPlugin',
          apiVersion: 1,
          serializerVersion: 2,
          register: registerNoDescriptors,
        },
      ],
    })
  }, {
    name: 'UnsupportedPluginError',
    message: 'Could not deserialize buffer: plugin "VersionedPlugin" expects a different serialization',
  })

  t.is(error.pluginName, 'VersionedPlugin')
  t.is(error.serializerVersion, 1)
})

test('encoder rejects state values with unsupported JavaScript types', t => {
  const error = t.throws(() => {
    encoder.encode(
      SERIALIZER_VERSION,
      {
        pluginIndex: 0,
        id: 0x05,
        children: [],
        state () {},
      },
      new Map(),
    )
  }, { instanceOf: TypeError })

  t.is(error.message, 'Unexpected value with type 0xFUNCTION')
})

test('encoder rejects records with unknown encoded value types', t => {
  const error = t.throws(() => encoder.decodeRecord(Buffer.from([0xFF]), 0), {
    instanceOf: TypeError,
  })

  t.is(error.message, 'Could not decode type 0xFF')
})
