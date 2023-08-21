import fs from 'node:fs';

import concordance from '../../index.js';

const foo = {};
export const tree = {
	foo,
	bar: {foo},
};

const binFile = new URL('pointerSerialization.bin', import.meta.url);

fs.writeFileSync(binFile, concordance.serialize(concordance.describe(tree)));

export const serialization = fs.readFileSync(binFile);
