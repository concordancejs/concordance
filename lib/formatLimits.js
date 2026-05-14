'use strict'

const lineBuilder = require('./lineBuilder')
const mapEntryTag = require('./metaDescriptors/mapEntry').tag

const unlimited = Infinity

function normalizeLimit (value) {
  return Number.isInteger(value) && value >= 0 ? value : unlimited
}

function createLimits (options) {
  return {
    maxItems: normalizeLimit(options && options.maxItems),
    maxProperties: normalizeLimit(options && options.maxProperties),
  }
}
exports.createLimits = createLimits

function createState () {
  return {
    items: 0,
    itemsTruncated: false,
    properties: 0,
    propertiesTruncated: false,
  }
}
exports.createState = createState

function getKind (origin) {
  if (!origin || origin.isStats === true) return null
  if (origin.isProperty === true) return 'properties'
  if (origin.isItem === true || origin.tag === mapEntryTag) return 'items'
  return null
}

function getLimit (limits, kind) {
  return kind === 'properties' ? limits.maxProperties : limits.maxItems
}

function getAfter (theme, origin, kind) {
  if (origin && origin.tag === mapEntryTag) return theme.mapEntry.after
  return kind === 'properties' ? theme.property.after : theme.item.after
}

function append (record, formatted, origin, theme, limits) {
  const kind = getKind(origin)
  if (kind === null || formatted.hasGutter) {
    record.formatter.append(formatted, origin)
    return
  }

  const limit = getLimit(limits, kind)
  if (record.limitState[kind] < limit) {
    record.limitState[kind]++
    record.formatter.append(formatted, origin)
    return
  }

  const truncatedKey = `${kind}Truncated`
  if (!record.limitState[truncatedKey]) {
    record.limitState[truncatedKey] = true
    record.formatter.append(lineBuilder.single(theme.maxDepth + getAfter(theme, origin, kind)), origin)
  }
}
exports.append = append
