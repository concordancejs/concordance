/*
Copyright JS Foundation and other contributors <https://js.foundation/>

Based on Underscore.js, copyright Jeremy Ashkenas,
DocumentCloud and Investigative Reporters & Editors <http://underscorejs.org/>

This software consists of voluntary contributions made by many
individuals. For exact contribution history, see the revision history
available at https://github.com/lodash/lodash

====

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

===

Setup and type of tests adopted from <https://github.com/lodash/lodash/blob/3967c1e1197b726463246b47521a4099ab74cb35/perf/perf.js#L1171:L1265>
*/
'use strict'

const compare = require('../lib/compare')

const MAX = 1000

const limit = 50
const object = {}
const objects = Array(limit)
const numbers = Array(limit)
const nestedNumbers = [1, [2], [3, [[4]]]]

for (let index = 0; index < limit; index++) {
  numbers[index] = index
  object['key' + index] = index
  objects[index] = { 'num': index }
}

const objectOfPrimitives = {
  'boolean': true,
  'number': 1,
  'string': 'a'
}

const objectOfObjects = {
  'boolean': new Boolean(true), // eslint-disable-line no-new-wrappers
  'number': new Number(1), // eslint-disable-line no-new-wrappers
  'string': new String('a') // eslint-disable-line no-new-wrappers
}

const objectOfObjects2 = {
  'boolean': new Boolean(true), // eslint-disable-line no-new-wrappers
  'number': new Number(1), // eslint-disable-line no-new-wrappers
  'string': new String('A') // eslint-disable-line no-new-wrappers
}

const symbol1 = Symbol()
const object2 = {}
const object3 = {}
const objects2 = Array(limit)
const objects3 = Array(limit)
const numbers2 = Array(limit)
const numbers3 = Array(limit)
const nestedNumbers2 = [1, [2], [3, [[4]]]]
const nestedNumbers3 = [1, [2], [3, [[6]]]]

for (let index = 0; index < limit; index++) {
  object2['key' + index] = index
  object3['key' + index] = index
  objects2[index] = { 'num': index }
  objects3[index] = { 'num': index }
  numbers2[index] = index
  numbers3[index] = index
}
object3['key' + (limit - 1)] = -1
objects3[limit - 1].num = -1
numbers3[limit - 1] = -1

const run = () => {
  for (let i = 0; i < MAX; i++) {
    compare(1, '1')
  }

  for (let i = 0; i < MAX; i++) {
    compare(1, 1)
  }

  for (let i = 0; i < MAX; i++) {
    compare(symbol1, symbol1)
  }

  for (let i = 0; i < MAX; i++) {
    compare(NaN, NaN)
  }

  for (let i = 0; i < MAX; i++) {
    compare(objectOfPrimitives, objectOfObjects)
  }

  for (let i = 0; i < MAX; i++) {
    compare(objectOfPrimitives, objectOfObjects2)
  }

  for (let i = 0; i < MAX; i++) {
    compare(numbers, numbers2)
  }

  for (let i = 0; i < MAX; i++) {
    compare(numbers2, numbers3)
  }

  for (let i = 0; i < MAX; i++) {
    compare(nestedNumbers, nestedNumbers2)
  }

  for (let i = 0; i < MAX; i++) {
    compare(nestedNumbers2, nestedNumbers3)
  }

  for (let i = 0; i < MAX; i++) {
    compare(objects, objects2)
  }

  for (let i = 0; i < MAX; i++) {
    compare(objects2, objects3)
  }

  for (let i = 0; i < MAX; i++) {
    compare(object, object2)
  }

  for (let i = 0; i < MAX; i++) {
    compare(object2, object3)
  }

  console.error('DONE')
}

setTimeout(run, 300)
