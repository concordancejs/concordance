import {Buffer} from 'node:buffer';

import test from 'ava';

import concordance from '../index.js';
import {format as _format} from '../lib/format.js';

import {theme, normalizedTheme, checkThemeUsage} from './_instrumentedTheme.js';
import * as customErrorPlugin from './fixtures/customErrorPlugin.js';

const format = value => _format(value, {theme});
test.after(checkThemeUsage);

// "Use" diff themes
// eslint-disable-next-line no-void
void (
	normalizedTheme.diffGutters.actual,
	normalizedTheme.diffGutters.expected,
	normalizedTheme.diffGutters.padding,
	normalizedTheme.string.diff.insert.open,
	normalizedTheme.string.diff.insert.close,
	normalizedTheme.string.diff.delete.open,
	normalizedTheme.string.diff.delete.close,
	normalizedTheme.string.diff.equal.open,
	normalizedTheme.string.diff.equal.close,
	normalizedTheme.string.diff.insertLine.open,
	normalizedTheme.string.diff.insertLine.close,
	normalizedTheme.string.diff.deleteLine.open,
	normalizedTheme.string.diff.deleteLine.close,
	// Tested separately
	normalizedTheme.maxDepth
);

if (typeof BigInt === 'undefined') {
	// eslint-disable-next-line no-void
	void (
		normalizedTheme.bigInt.open,
		normalizedTheme.bigInt.close
	);
}

{
	const formatsPrimitive = (t, value) => t.snapshot(format(value));
	formatsPrimitive.title = (valueRepresentation, value) => {
		const string_ = Object.is(value, -0)
			? '-0'
			: String(value).replaceAll('\r', '\\r').replaceAll('\n', '\\n');
		return `formats primitive: ${valueRepresentation || string_}`;
	};

	for (const value of [
		null,
		undefined,
		false,
		true,
		'',
		'foo',
		'\\ -- \' -- "',
		'foo\nbar\\baz\'"',
		'qux\r\nquux',
		'qux\rquux',
		42,
		-42,
		-0,
		+0,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		Number.NaN,
		Symbol(), // eslint-disable-line symbol-description
		Symbol('foo'),
		Symbol('foo\nbar'),
		Symbol.for('bar'),
		Symbol.for('bar\nbaz'),
		Symbol.iterator,
	]) {
		test(formatsPrimitive, value);
	}

	if (typeof BigInt === 'function') {
		test('42n', formatsPrimitive, BigInt(42));
		test('-42n', formatsPrimitive, BigInt(-42));
	}
}

{
	const escapesQuote = (t, escapeQuote) => {
		const testTheme = {
			string: {
				line: {open: '<', close: '>', escapeQuote},
				multiline: {start: '<', end: '>', escapeQuote},
			},
		};
		t.snapshot(_format(escapeQuote, {theme: testTheme}));
		t.snapshot(_format(escapeQuote + '\n', {theme: testTheme}));
	};

	escapesQuote.title = (_, quote) => `escapes ${quote} according to theme`;
	test(escapesQuote, '\'');
	test(escapesQuote, '"');
	test(escapesQuote, '`');
}

test('escapes singlequotes in one-line strings with the default theme', t => {
	t.snapshot(_format('\''), 'should be escaped');
	t.snapshot(_format('\'\n'), 'should not be escaped');
});

// Regression test for #36
test('escapes backticks in multi-line strings with the default theme', t => {
	t.snapshot(_format('`'), 'should not be escaped');
	t.snapshot(_format('`\n'), 'should be escaped');
});

test('formats a simple object', t => {
	const object = {foo: 'bar', baz: 'qux'};
	const actual = format(object);
	t.snapshot(actual);
});

test('formats a simple, nested object', t => {
	const object = {foo: {baz: 'qux'}};
	const actual = format(object);
	t.snapshot(actual);
});

test('formats multiline strings inside an object', t => {
	const actual = format({'foo\nbar': 'baz\nqux'});
	t.snapshot(actual);
});

test('formats symbol keys', t => {
	t.snapshot(format({[Symbol('')]: 'bar'}));
});

test('formats registered symbols differently from normal symbols with same description', t => {
	t.true(format(Symbol('foo')) !== format(Symbol.for('foo')));
});

{
	// eslint-disable-next-line no-new-object
	const formatsBoxedPrimitive = (t, value) => t.snapshot(format(new Object(value)));
	formatsBoxedPrimitive.title = (valueRepresentation, value) => `formats boxed primitive: ${valueRepresentation || (Object.is(value, -0) ? '-0' : String(value))}`;
	for (const value of [
		false,
		true,
		42,
		-42,
		-0,
		+0,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		Number.NaN,
		'foo',
	]) {
		test(formatsBoxedPrimitive, value);
	}

	if (typeof BigInt === 'function') {
		test('42n', formatsBoxedPrimitive, BigInt(42));
		test('-42n', formatsBoxedPrimitive, BigInt(-42));
	}
}

test('formats boxed primitives with extra properties', t => {
	// eslint-disable-next-line no-new-object
	t.snapshot(format(Object.assign(new Object('foo'), {bar: 'baz'})));
});

test('formats a simple array', t => {
	const array = ['foo', 'bar'];
	const actual = format(array);
	t.snapshot(actual);
});

test('formats a simple, nested array', t => {
	const array = [['foo', 'bar']];
	const actual = format(array);
	t.snapshot(actual);
});

test('formats an array with additional properties', t => {
	const array1 = ['foo', 'bar'];
	array1.baz = 'qux';
	t.snapshot(format(array1));

	const array2 = [1, 2, 3];
	array2[-1] = -1;
	t.snapshot(format(array2));
});

test('formats a multiline string inside an array', t => {
	const actual = format(['bar\nbaz']);
	t.snapshot(actual);
});

test('formats maps', t => {
	const map = new Map();
	map.set('foo', 'bar');
	map.set({baz: 'qux'}, 'quux');
	map.set('corge', {grault: 'garply'});
	const actual = format(map);
	t.snapshot(actual);
});

test('formats multiline strings inside a map', t => {
	const actual = format(new Map([['foo\nbar', 'baz\nqux']]));
	t.snapshot(actual);
});

test('formats maps with additional properties', t => {
	const map = new Map();
	map.set('foo', 'bar');
	map.baz = 'qux';
	const actual = format(map);
	t.snapshot(actual);
});

test('formats sets', t => {
	const set = new Set();
	set.add('foo');
	set.add({bar: 'baz'});
	const actual = format(set);
	t.snapshot(actual);
});

test('formats a multiline string inside sets', t => {
	const actual = format(new Set(['bar\nbaz']));
	t.snapshot(actual);
});

test('formats sets with additional properties', t => {
	const set = new Set();
	set.add('foo');
	set.bar = 'baz';
	const actual = format(set);
	t.snapshot(actual);
});

test('formats funky objects that are lists and have an iterator', t => {
	const funky = {
		0: 'first',
		1: 'second',
		foo: 'bar',
	};
	Object.defineProperty(funky, 'length', {value: 2});
	Object.defineProperty(funky, Symbol.iterator, {* value() {
		yield 'baz';
	}});

	const actual = format(funky);
	t.snapshot(actual);
});

test('formats regular expressions', t => {
	const actual = format(/foo/gim);
	t.snapshot(actual);
});

test('formats regular expressions with additional properties', t => {
	const actual = format(Object.assign(/foo/gim, {bar: 'baz'}));
	t.snapshot(actual);
});

test('formats anonymous functions', t => {
	const actual = format(() => {});
	t.snapshot(actual);
});

test('formats named functions', t => {
	const actual = format(function foo() {});
	t.snapshot(actual);
});

test('formats functions with additional properties', t => {
	const actual = format(Object.assign(function foo() {}, {bar: 'baz'}));
	t.snapshot(actual);
});

test('formats anonymous generator functions', t => {
	const actual = format(function * () {});

	t.is(actual, '%function.stringTag.open%GeneratorFunction%function.stringTag.close% %object.openBracket#{%%object.closeBracket#}%');
});

test('formats named generator functions', t => {
	const actual = format(function * foo() {});

	t.is(actual, '%function.stringTag.open%GeneratorFunction%function.stringTag.close% %function.name.open%foo%function.name.close% %object.openBracket#{%%object.closeBracket#}%');
});

test('formats generator functions with additional properties', t => {
	const actual = format(Object.assign(function * foo() {}, {bar: 'baz'}));

	t.is(actual, `%function.stringTag.open%GeneratorFunction%function.stringTag.close% %function.name.open%foo%function.name.close% %object.openBracket#{%
  bar%property.separator#: %%string.line.open#'%%string.open%baz%string.close%%string.line.close#'%%property.after#,%
%object.closeBracket#}%`);
});

test('formats arguments', t => {
	(function (_a, _b, _c) {
		// eslint-disable-next-line prefer-rest-params
		const actual = format(arguments);
		t.snapshot(actual);
	})('foo', 'bar', 'baz');
});

test('formats simple errors', t => {
	const actual = format(new TypeError('Test message'));
	t.snapshot(actual);
});

test('formats simple errors with a modified name', t => {
	const error = new TypeError('Test message');
	error.name = 'FooError';
	const actual = format(error);
	t.snapshot(actual);
});

test('formats errors with a name that does not include Error and does not match the constructor', t => {
	class Foo extends Error {
		constructor(message) {
			super(message);
			this.name = 'Bar';
		}
	}
	const actual = format(new Foo('Test message'));
	t.snapshot(actual);
});

test('formats errors with additional properties', t => {
	const actual = format(Object.assign(new TypeError('Test message'), {foo: 'bar'}));
	t.snapshot(actual);
});

test('formats promises', t => {
	const actual = format(Promise.resolve());
	t.snapshot(actual);
});

test('formats promises with additional properties', t => {
	const actual = format(Object.assign(Promise.resolve(), {foo: 'bar'}));
	t.snapshot(actual);
});

test('formats pointers', t => {
	const object = {foo: 'bar'};
	const actual = format({baz: object, qux: {quux: object}});
	t.snapshot(actual);
});

test('formats circular references', t => {
	const object = {};
	object.circular = object;
	const actual = format(object);
	t.snapshot(actual);
});

{
	const plain = (t, value, _tag) => {
		const actual = format(value);
		t.snapshot(actual);
	};

	plain.title = (_, __, tag) => `formats ${tag}`;

	const withProperties = (t, value, _tag) => {
		const actual = format(Object.assign(value, {foo: 'bar'}));
		t.snapshot(actual);
	};

	withProperties.title = (_, __, tag) => `formats ${tag} with additional properties`;

	const buffer = Buffer.from('decafbad'.repeat(12), 'hex');
	const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

	for (const [tag, value, valueForProps] of [
		['ArrayBuffer', arrayBuffer],
		['Buffer @Uint8Array', buffer],
		['DataView', new DataView(arrayBuffer), new DataView(arrayBuffer)],
		['Float32Array', new Float32Array(arrayBuffer)],
		['Float64Array', new Float64Array(arrayBuffer)],
		['Int16Array', new Int16Array(arrayBuffer)],
		['Int32Array', new Int32Array(arrayBuffer)],
		['Int8Array', new Int8Array(arrayBuffer)],
		['Uint16Array', new Uint16Array(arrayBuffer)],
		['Uint32Array', new Uint32Array(arrayBuffer)],
		['Uint8Array', new Uint8Array(arrayBuffer)],
		['Uint8ClampedArray', new Uint8ClampedArray(arrayBuffer)],
	]) {
		test(plain, value, tag);
		test(withProperties, valueForProps || value.slice(), tag); // eslint-disable-line unicorn/prefer-spread
	}
}

test('formats dates', t => {
	const actual1 = format(new Date('1969-07-20T20:17:40.012Z'));
	t.snapshot(actual1);

	const actual2 = format(new Date('🚀🌔🛬'));
	t.snapshot(actual2);
});

test('formats dates with additional properties', t => {
	const actual = format(Object.assign(new Date('1969-07-20T20:17:40Z'), {foo: 'bar'}));
	t.snapshot(actual);
});

test('shows non-Object tag if constructor name is different', t => {
	class Foo {}
	const actual1 = format(new Foo());
	t.snapshot(actual1);

	class Bar extends Array {}
	const actual2 = format(new Bar());
	t.snapshot(actual2);

	class Baz extends Date {}
	const actual3 = format(new Baz('1969-07-20T20:17:40Z'));
	t.snapshot(actual3);

	class Qux extends RegExp {}
	const actual4 = format(new Qux('foo'));
	t.snapshot(actual4);

	class Quux extends Int16Array {}
	const actual5 = format(new Quux());
	t.snapshot(actual5);
});

test('shows string tag if object has no constructor', t => {
	const object = {};
	Object.defineProperty(object, 'constructor', {});
	t.snapshot(format(object));
});

test('formats global', t => {
	t.snapshot(format(global));
});

test('format with given plugin', t => {
	const plugins = [
		{
			name: 'CustomError',
			apiVersion: 1,
			register(props) {
				const {describe} = customErrorPlugin.factory(props);
				return function (value) {
					if (value.name === 'CustomError') {
						return describe;
					}
				};
			},
		},
	];

	const actual1 = _format(new customErrorPlugin.CustomError('plugin formatter', 'PLUGIN'), {plugins, theme});
	t.snapshot(actual1);
	const actual2 = _format(new Error('error'), {plugins, theme});
	t.snapshot(actual2);
});

// See <https://github.com/concordancejs/concordance/issues/66>.
test('format pointers hidden behind maxDepth', t => {
	const value = {};
	const descriptor = concordance.describe({
		// `value` is encoded in the serialization of `a.b`. `c` is encoded as a
		// pointer to the encoded `value`.
		a: {
			b: value,
		},
		c: value,
	});
	const serialized = concordance.serialize(descriptor);

	t.notThrows(() => {
		// `maxDepth: 1` means that `a.b` is not normally deserialized, and so the
		// `c` pointer cannot be resolved, unless the resolution logic first
		// deserializes the descriptor in its entirety.
		concordance.formatDescriptor(concordance.deserialize(serialized), {maxDepth: 1});
	});
});
