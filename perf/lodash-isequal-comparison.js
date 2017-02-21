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

Benchmarks adopted from <https://github.com/lodash/lodash/blob/3967c1e1197b726463246b47521a4099ab74cb35/perf/perf.js#L1171:L1265>
*/

const Benchmark = require('benchmark')

global.isEqual = require('lodash.isequal')
global.compare = require('../lib/compare')

const buildName = 'lodash.isequal'
const otherName = 'compare'

function getGeometricMean (array) {
  return Math.pow(Math.E, array.reduce((sum, x) => sum + Math.log(x), 0) / array.length) || 0
}

function getHz (bench) {
  const result = 1 / (bench.stats.mean + bench.stats.moe)
  return isFinite(result) ? result : 0
}

const score = { 'a': [], 'b': [] }
const suites = []

const formatNumber = Benchmark.formatNumber

Object.assign(Benchmark.Suite.options, {
  onStart () {
    console.log(`\n${this.name}:`)
  },
  // onCycle (evt) {
  //   console.log(evt.target)
  // },
  onComplete () {
    let errored = false
    for (let index = 0, length = this.length; index < length; index++) {
      const bench = this[index]
      if (bench.error) {
        errored = true
      }
    }
    if (errored) {
      console.log('There was a problem, skipping...')
    } else {
      const fastest = this.filter('fastest')
      const fastestHz = getHz(fastest[0])
      const slowest = this.filter('slowest')
      const slowestHz = getHz(slowest[0])
      let aHz = getHz(this[0])
      let bHz = getHz(this[1])

      if (fastest.length > 1) {
        console.log('It\'s too close to call.')
        aHz = bHz = slowestHz
      } else {
        const percent = ((fastestHz / slowestHz) - 1) * 100

        console.log(`${fastest[0].name} is ${formatNumber(percent < 1 ? percent.toFixed(2) : Math.round(percent))}% faster.`)
      }
      // Add score adjusted for margin of error.
      score.a.push(aHz)
      score.b.push(bHz)
    }
    // Remove current suite from queue.
    suites.shift()

    if (suites.length > 0) {
      // Run next suite.
      suites[0].run({ 'async': true })
    } else {
      const aMeanHz = getGeometricMean(score.a)
      const bMeanHz = getGeometricMean(score.b)
      const fastestMeanHz = Math.max(aMeanHz, bMeanHz)
      const slowestMeanHz = Math.min(aMeanHz, bMeanHz)
      const xFaster = fastestMeanHz / slowestMeanHz
      const percentFaster = formatNumber(Math.round((xFaster - 1) * 100))
      const message = `is ${percentFaster}% ${xFaster === 1 ? '' : '(' + formatNumber(xFaster.toFixed(2)) + 'x) '}faster than`

      // Report results.
      if (aMeanHz >= bMeanHz) {
        console.log(`\n${buildName} ${message} ${otherName}.`)
      } else {
        console.log(`\n${otherName} ${message} ${buildName}.`)
      }
    }
  }
})

Object.assign(Benchmark.options, {
  async: true,
  setup: `
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
      'boolean': new Boolean(true),
      'number': new Number(1),
      'string': new String('a')
    }

    const objectOfObjects2 = {
      'boolean': new Boolean(true),
      'number': new Number(1),
      'string': new String('A')
    }

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
  `
})

suites.push(
  Benchmark.Suite('comparing primitives')
     .add(buildName, {
       'fn': `
         isEqual(1, "1");
         isEqual(1, 1)`,
       'teardown': 'function isEqual(){}'
     })
     .add(otherName, {
       'fn': `
         compare(1, "1");
         compare(1, 1);`,
       'teardown': 'function isEqual(){}'
     })
 )

suites.push(
   Benchmark.Suite('comparing primitives and their object counterparts (edge case)')
     .add(buildName, {
       'fn': `
         isEqual(objectOfPrimitives, objectOfObjects);
         isEqual(objectOfPrimitives, objectOfObjects2)`,
       'teardown': 'function isEqual(){}'
     })
     .add(otherName, {
       'fn': `
         compare(objectOfPrimitives, objectOfObjects);
         compare(objectOfPrimitives, objectOfObjects2)`,
       'teardown': 'function isEqual(){}'
     })
 )

suites.push(
   Benchmark.Suite('comparing arrays')
     .add(buildName, {
       'fn': `
         isEqual(numbers, numbers2);
         isEqual(numbers2, numbers3)`,
       'teardown': 'function isEqual(){}'
     })
     .add(otherName, {
       'fn': `
         compare(numbers, numbers2);
         compare(numbers2, numbers3)`,
       'teardown': 'function isEqual(){}'
     })
 )

suites.push(
   Benchmark.Suite('comparing nested arrays')
     .add(buildName, {
       'fn': `
         isEqual(nestedNumbers, nestedNumbers2);
         isEqual(nestedNumbers2, nestedNumbers3)`,
       'teardown': 'function isEqual(){}'
     })
     .add(otherName, {
       'fn': `
         compare(nestedNumbers, nestedNumbers2);
         compare(nestedNumbers2, nestedNumbers3)`,
       'teardown': 'function isEqual(){}'
     })
 )

suites.push(
   Benchmark.Suite('comparing arrays of objects')
     .add(buildName, {
       'fn': `
         isEqual(objects, objects2);
         isEqual(objects2, objects3)`,
       'teardown': 'function isEqual(){}'
     })
     .add(otherName, {
       'fn': `
         compare(objects, objects2);
         compare(objects2, objects3)`,
       'teardown': 'function isEqual(){}'
     })
 )

suites.push(
   Benchmark.Suite('comparing objects')
     .add(buildName, {
       'fn': `
         isEqual(object, object2);
         isEqual(object2, object3)`,
       'teardown': 'function isEqual(){}'
     })
     .add(otherName, {
       'fn': `
         compare(object, object2);
         compare(object2, object3)`,
       'teardown': 'function isEqual(){}'
     })
 )

suites[0].run({ async: true })
