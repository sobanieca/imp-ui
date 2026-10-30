import { impLogger } from '../../logger.js'
import { isPlainObject, isStateShaped } from '../../render.js'
import { isAppMap, nodeLabel, nodeOf } from '../../app-map.js'
import { iconOrNull } from '../shared/items.js'
import { normalizeNavTag } from '../shared/nav-items.js'

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
        `${NAME}: unknown '${prop}' key '${key}' - supported keys are ${keys
          .map((known) => `'${known}'`)
          .join(', ')}`,
      )
    }
  }
  return Object.fromEntries(
    keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]),
  )
}

export const readMap = (value) => {
  if (value === undefined || value === null) return null
  if (!isAppMap(value)) {
    impLogger.warn(`${NAME}: 'map' must be the value appMap() returned - ignoring it`)
    return null
  }
  return value
}

const FOOTER_KEYS = ['note', 'items']

export const readFooter = (value) => {
  if (value === undefined || value === null || value === false) return null
  return normalizeKeyed('footer', FOOTER_KEYS, value)
}

const isPageNode = (node) => {
  for (let current = node; current !== null; current = current.parent) {
    if (current.param) return false
  }
  return true
}

// One entry of 'footer.items' as data: a link { href, label }, or the DOM or text to show as it is.
// A node of the map links to its page and takes the label of its nav row unless the entry names one.
export const readFooterItem = (map, item) => {
  if (item === undefined || item === null || item === false) return null
  if (item instanceof Node || typeof item === 'string' || isStateShaped(item)) {
    return { content: item }
  }
  const own = map === null ? null : nodeOf(map, item)
  const handle = own !== null ? item : isPlainObject(item) ? item.node : undefined
  if (handle === undefined) {
    if (!isPlainObject(item) || typeof item.href !== 'string' || item.href === '') {
      impLogger.warn(
        `${NAME}: a 'footer.items' entry must be a node of the map, { node, label }, { href, label }, text or DOM - ignoring it`,
      )
      return null
    }
    return { href: item.href, label: item.label ?? item.href, node: null }
  }
  const node = own ?? (map === null ? null : nodeOf(map, handle))
  if (node === null) {
    impLogger.warn(
      `${NAME}: 'footer.items' holds { node } that is not a node of the map - pass a handle like app.contact`,
    )
    return null
  }
  if (!isPageNode(node)) {
    impLogger.warn(
      `${NAME}: the footer cannot link '${node.pattern}' - a node under a param needs its value; pass { href, label }`,
    )
    return null
  }
  return { href: handle.href(), label: own === null ? (item.label ?? null) : null, node }
}

const NAVBAR_KEYS = ['label', 'background', 'hidden']

export const readNavbar = (value) => {
  if (value === false) return { shown: false, data: {} }
  if (value === undefined || value === null) return { shown: true, data: {} }
  const data = normalizeKeyed('navbar', NAVBAR_KEYS, value) ?? {}
  if (data.hidden !== undefined && typeof data.hidden !== 'boolean') {
    impLogger.warn(`${NAME}: 'navbar.hidden' must be true or false - showing the bar`)
    return { shown: true, data }
  }
  return { shown: data.hidden !== true, data }
}

const NAV_KEYS = ['icon', 'tag', 'group', 'hidden']

const NAV_SHAPE = '{ [handle]: { icon, tag, group, hidden } }'

const readFlag = (handle, key, value) => {
  if (value === undefined || value === null) return false
  if (typeof value === 'boolean') return value
  impLogger.warn(`${NAME}: 'nav[${handle}].${key}' must be true or false - ignoring it`)
  return false
}

const readTag = (handle, value) => {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') return value
  if (!isPlainObject(value)) {
    impLogger.warn(
      `${NAME}: 'nav[${handle}].tag' must be a state name or { text, color, title } - ignoring it`,
    )
    return null
  }
  return normalizeNavTag(NAME, value)
}

const readEntry = (handle, entry) => {
  if (!isPlainObject(entry)) {
    impLogger.warn(`${NAME}: 'nav[${handle}]' must be an object of { ${NAV_KEYS.join(', ')} }`)
    return null
  }
  for (const key of Object.keys(entry)) {
    if (!NAV_KEYS.includes(key)) {
      impLogger.warn(
        `${NAME}: unknown 'nav[${handle}]' key '${key}' - supported keys are ${NAV_KEYS.map(
          (known) => `'${known}'`,
        ).join(', ')}`,
      )
    }
  }
  return {
    icon: entry.icon ?? null,
    tag: readTag(handle, entry.tag),
    group: readFlag(handle, 'group', entry.group),
    hidden: readFlag(handle, 'hidden', entry.hidden),
  }
}

export const readNav = (map, value) => {
  const settings = new Map()
  if (value === undefined || value === null) return settings
  if (map === null) {
    impLogger.warn(`${NAME}: 'nav' needs a 'map' - it binds settings to nodes of that map`)
    return settings
  }
  if (!isPlainObject(value)) {
    impLogger.warn(`${NAME}: 'nav' must be an object of ${NAV_SHAPE} - ignoring it`)
    return settings
  }
  for (const [handle, entry] of Object.entries(value)) {
    if (nodeOf(map, handle) === null) {
      impLogger.warn(
        `${NAME}: 'nav' holds '${handle}', which is not a node of the map - pass a handle like [app.reports]`,
      )
      continue
    }
    const read = readEntry(handle, entry)
    if (read !== null) settings.set(handle, read)
  }
  return settings
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

const NO_SETTING = Object.freeze({ icon: null, tag: null, group: false, hidden: false })

export const arrangeNav = (map, tree, { settings, tags, barShown, warnBarGroup }) => {
  const settingOf = (id) => settings.get(id) ?? NO_SETTING
  const shown = (node) => !settingOf(node.id).hidden
  const entry = (node, children) => ({
    id: node.id,
    label: node.label,
    href: node.href,
    icon: null,
    tag: tagValue(tags.get(node.id) ?? null),
    children,
  })
  const row = (node) =>
    entry(
      node,
      node.children.filter(shown).map((kid) => entry(kid, [])),
    )
  const groupsOf = (rows) => {
    const groups = []
    for (const node of rows.filter(shown)) {
      if (settingOf(node.id).group) {
        const items = node.children.filter(shown).map(row)
        if (items.length > 0) groups.push({ ...entry(node, []), items })
        continue
      }
      const last = groups.at(-1)
      if (last !== undefined && last.label === null) last.items.push(row(node))
      else groups.push({ id: `rows-${groups.length}`, label: null, tag: null, items: [row(node)] })
    }
    return groups
  }
  if (!barShown) {
    if (tree.length === 0) return []
    const top = tree.map(({ items, ...section }) => ({ ...section, children: items }))
    return [
      {
        ...entry({ id: String(map), label: nodeLabel(nodeOf(map, map)), href: map.href() }, []),
        groups: groupsOf(top),
      },
    ]
  }
  return tree.filter(shown).map((section) => {
    if (settingOf(section.id).group) warnBarGroup(section.id)
    return { ...entry(section, []), groups: groupsOf(section.items) }
  })
}

export const withIcons = (sections, settings) => {
  const iconed = (item) => ({
    ...item,
    icon: iconOrNull(settings.get(item.id)?.icon ?? null),
    children: item.children.map(iconed),
  })
  return sections.map((section) => ({
    ...iconed(section),
    groups: section.groups.map((group) => ({ ...group, items: group.items.map(iconed) })),
  }))
}

export const rowIdsOf = (sections) =>
  new Set(
    sections.flatMap((section) =>
      section.groups.flatMap((group) => withChildren(group.items).map((row) => row.id)),
    ),
  )

export const flattenGroups = (groups) => groups.flatMap((group) => group.items)

export const withChildren = (items) =>
  items.flatMap((item) => [item, ...item.children.map((child) => ({ ...child, parent: item }))])
