import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { isAppMap } from '../../app-map.js'
import { icon } from '../general/icon.js'
import { normalizeNavItems, normalizeNavTag } from '../shared/nav-items.js'

export const NAME = 'shell'

const DEFAULT_MAX_WIDTH = '125rem'

export const toMaxWidth = (value) => {
  if (value === undefined || value === null) return DEFAULT_MAX_WIDTH
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  impLogger.warn(
    `${NAME}: 'maxWidth' must be a CSS length such as '90rem', or 'none' - got '${value}', using '${DEFAULT_MAX_WIDTH}'`,
  )
  return DEFAULT_MAX_WIDTH
}

export const normalizeKeyed = (prop, keys, value) => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value) || typeof value.nodeType === 'number') {
    impLogger.warn(`${NAME}: '${prop}' must be an object of { ${keys.join(', ')} } - ignoring it`)
    return null
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      impLogger.warn(
        `${NAME}: unknown '${prop}' key '${key}' - supported keys are ${
          keys.map((known) => `'${known}'`).join(', ')
        }`,
      )
    }
  }
  return Object.fromEntries(
    keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]),
  )
}

export const normalizeGroupList = (value, fallbackItems) => {
  if (value === undefined || value === null) {
    const items = normalizeNavItems(NAME, fallbackItems ?? [], { nested: true })
    return items.length === 0 ? [] : [{ id: '', label: null, tag: null, items }]
  }
  if (!Array.isArray(value)) {
    impLogger.warn(`${NAME}: 'groups' must be an array of { label, items } - showing none`)
    return []
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.items)) {
      impLogger.warn(`${NAME}: a group is not an object with an 'items' array - skipping it`)
      return []
    }
    const items = normalizeNavItems(NAME, entry.items, { nested: true })
    if (items.length === 0) return []
    return [{
      id: entry.id === undefined ? `g${index}` : String(entry.id),
      label: entry.label ?? null,
      tag: normalizeNavTag(NAME, entry.tag),
      items,
    }]
  })
}

export const normalizeSections = (value) => {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const [section] = normalizeNavItems(NAME, [entry])
    if (section === undefined) return []
    return [{ ...section, groups: normalizeGroupList(entry.groups, entry.items) }]
  })
}

export const flattenGroups = (groups) => groups.flatMap((group) => group.items)

export const readMap = (navbarData) => {
  const value = navbarData?.map
  if (value === undefined || value === null) return null
  if (!isAppMap(value)) {
    impLogger.warn(`${NAME}: 'navbar.map' must be the value appMap() returned - ignoring it`)
    return null
  }
  return value
}

const iconNode = (value) => {
  if (value === undefined || value === null) return null
  return typeof value.nodeType === 'number' ? value : icon(value)
}

const tagValue = (raw) => {
  const value = isStateShaped(raw) ? raw.get() : raw
  if (value === undefined || value === null) return null
  if (typeof value === 'object') {
    return value.text === undefined || value.text === null
      ? null
      : { text: value.text, color: value.color, title: value.title }
  }
  return { text: value }
}

export const withTags = (sections, tags) => {
  const tagged = (row) => ({
    ...row,
    tag: tagValue(tags[row.id]),
    children: row.children.map(tagged),
  })
  return sections.map((section) => ({
    ...section,
    tag: tagValue(tags[section.id]),
    groups: section.groups.map((group) => ({ ...group, items: group.items.map(tagged) })),
  }))
}

export const withIcons = (sections, icons) => {
  const iconed = (row) => ({
    ...row,
    icon: iconNode(icons[row.id]),
    children: row.children.map(iconed),
  })
  return sections.map((section) => ({
    ...section,
    icon: iconNode(icons[section.id]),
    groups: section.groups.map((group) => ({ ...group, items: group.items.map(iconed) })),
  }))
}

export const withChildren = (items) =>
  items.flatMap((item) => [item, ...item.children.map((child) => ({ ...child, parent: item }))])
