import dateTime from 'date-time'
import {SHALLOW_EQUAL, UNEQUAL} from '../constants.js'
import * as formatUtils from '../formatUtils.js'
import lineBuilder from '../lineBuilder.js'
import * as object from './object.js'

export function describe (props) {
	const date = props.value
	const invalid = isNaN(date.valueOf())
	return new DescribedDateValue(Object.assign({}, props, { invalid }))
}

export function deserialize (state, recursor) {
	return new DeserializedDateValue(state, recursor)
}

export const tag = Symbol('DateValue')

function formatDate (date) {
	// Always format in UTC. The local timezone shouldn't be used since it's most
	// likely different from that of CI servers.
	return dateTime({
		date,
		local: false,
		showTimeZone: true,
		showMilliseconds: true,
	})
}

class DateValue extends object.ObjectValue {
	constructor (props) {
		super(props)
		this.invalid = props.invalid
	}

	compare (expected) {
		const result = super.compare(expected)
		if (result !== SHALLOW_EQUAL) return result

		return (this.invalid && expected.invalid) || Object.is(this.value.getTime(), expected.value.getTime())
			? SHALLOW_EQUAL
			: UNEQUAL
	}

	formatShallow (theme, indent) {
		const string = formatUtils.formatCtorAndStringTag(theme, this) + ' ' +
			(this.invalid ? theme.date.invalid : formatUtils.wrap(theme.date.value, formatDate(this.value))) + ' ' +
			theme.object.openBracket

		return super.formatShallow(theme, indent).customize({
			finalize (innerLines) {
				return innerLines.isEmpty
					? lineBuilder.single(string + theme.object.closeBracket)
					: lineBuilder.first(string)
						.concat(innerLines.withFirstPrefixed(indent.increase()).stripFlags())
						.append(lineBuilder.last(indent + theme.object.closeBracket))
			},

			maxDepth () {
				return lineBuilder.single(string + ' ' + theme.maxDepth + ' ' + theme.object.closeBracket)
			},
		})
	}

	serialize () {
		const iso = this.invalid ? null : this.value.toISOString()
		return [this.invalid, iso, super.serialize()]
	}

	tag = tag
}

const DescribedDateValue = object.DescribedMixin(DateValue)

class DeserializedDateValue extends object.DeserializedMixin(DateValue) {
	constructor (state, recursor) {
		super(state[2], recursor)
		this.invalid = state[0]
		this.value = new Date(this.invalid ? NaN : state[1])
	}
}
