import { DEEP_EQUAL, SHALLOW_EQUAL, UNEQUAL } from './constants.js'
import * as recursorUtils from './recursorUtils.js'

export class Comparable {
	constructor (properties) {
		this.properties = properties
		this.ordered = properties.slice()
	}

	createRecursor () {
		const length = this.ordered.length
		let index = 0
		return () => {
			if (index === length) return null

			return this.ordered[index++]
		}
	}

	compare (expected) {
		if (this.properties.length !== expected.properties.length) return UNEQUAL

		// Compare property keys, reordering the expected properties in the process
		// so values can be compared if all keys are equal.
		const ordered = []
		const processed = new Set()
		for (const property of this.properties) {
			let extraneous = true
			for (const other of expected.properties) {
				if (processed.has(other.key)) continue

				if (property.key.compare(other.key) === DEEP_EQUAL) {
					extraneous = false
					processed.add(other.key)
					ordered.push(other)
					break
				}
			}

			if (extraneous) return UNEQUAL
		}
		expected.ordered = ordered

		return SHALLOW_EQUAL
	}

	prepareDiff (expected) {
		// Reorder the expected properties before recursion starts.
		const missingProperties = []
		const ordered = []
		const processed = new Set()
		for (const other of expected.properties) {
			let missing = true
			for (const property of this.properties) {
				if (processed.has(property.key)) continue

				if (property.key.compare(other.key) === DEEP_EQUAL) {
					missing = false
					processed.add(property.key)
					ordered.push(other)
					break
				}
			}

			if (missing) {
				missingProperties.push(other)
			}
		}
		expected.ordered = ordered.concat(missingProperties)

		return { mustRecurse: true }
	}

	isSymbolPropertiesComparable = true
}

export class Collector {
	constructor (firstProperty, recursor) {
		this.properties = [firstProperty]
		this.recursor = recursor
		this.remainder = null
	}

	collectAll () {
		do {
			const next = this.recursor()
			if (next && next.isProperty === true) { // All properties will have symbol keys
				this.properties.push(next)
			} else {
				return next
			}
		} while (true)
	}

	createRecursor () {
		return recursorUtils.singleValue(new Comparable(this.properties))
	}

	isSymbolPropertiesCollector = true
}
