import {compare, compareDescriptors} from './lib/compare.js';
import describe from './lib/describe.js';
import {diff, diffDescriptors} from './lib/diff.js';
import {format, formatDescriptor} from './lib/format.js';
import {serialize, deserialize} from './lib/serialize.js';

export {compare, compareDescriptors} from './lib/compare.js';
export {default as describe} from './lib/describe.js';
export {diff, diffDescriptors} from './lib/diff.js';
export {format, formatDescriptor} from './lib/format.js';
export {serialize, deserialize} from './lib/serialize.js';

export default {
	compare,
	compareDescriptors,
	describe,
	diff,
	diffDescriptors,
	format,
	formatDescriptor,
	serialize,
	deserialize,
};
