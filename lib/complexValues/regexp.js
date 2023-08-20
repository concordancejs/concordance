import { UNEQUAL } from '../constants.js'
import * as formatUtils from '../formatUtils.js'
import lineBuilder from '../lineBuilder.js'
import * as object from './object.js'

export function describe (props) {
	const regexp = props.value
	return new DescribedRegexpValue(Object.assign({
		flags: getSortedFlags(regexp),
		source: regexp.source,
	}, props))
}

export function deserialize (state, recursor) {
	return new DeserializedRegexpValue(state, recursor)
}

export const tag = Symbol('RegexpValue')

function getSortedFlags (regexp) {
	const flags = regexp.flags || String(regexp).slice(regexp.source.length + 2)
	return flags.split('').sort().join('')
}

class RegexpValue extends object.ObjectValue {
	constructor (props) {
		super(props)
		this.flags = props.flags
		this.source = props.source
	}

	compare (expected) {
		return this.tag === expected.tag && this.flags === expected.flags && this.source === expected.source
			? super.compare(expected)
			: UNEQUAL
	}

	formatShallow (theme, indent) {
		const ctor = this.ctor || this.stringTag
		const regexp = formatUtils.wrap(theme.regexp.source, this.source) + formatUtils.wrap(theme.regexp.flags, this.flags)

		return super.formatShallow(theme, indent).customize({
			finalize: innerLines => {
				if (ctor === 'RegExp' && innerLines.isEmpty) return lineBuilder.single(regexp)

				const innerIndentation = indent.increase()
				const header = lineBuilder.first(formatUtils.formatCtorAndStringTag(theme, this) + ' ' + theme.object.openBracket)
					.concat(lineBuilder.line(innerIndentation + regexp))

				if (!innerLines.isEmpty) {
					header.append(lineBuilder.line(innerIndentation + theme.regexp.separator))
					header.append(innerLines.withFirstPrefixed(innerIndentation).stripFlags())
				}

				return header.append(lineBuilder.last(indent + theme.object.closeBracket))
			},

			maxDepth: () => {
				return lineBuilder.single(
					formatUtils.formatCtorAndStringTag(theme, this) + ' ' +
					theme.object.openBracket + ' ' +
					regexp + ' ' +
					theme.maxDepth + ' ' +
					theme.object.closeBracket)
			},
		})
	}

	serialize () {
		return [this.flags, this.source, super.serialize()]
	}

	tag = tag
}

const DescribedRegexpValue = object.DescribedMixin(RegexpValue)

class DeserializedRegexpValue extends object.DeserializedMixin(RegexpValue) {
	constructor (state, recursor) {
		super(state[2], recursor)
		this.flags = state[0]
		this.source = state[1]
	}
}
