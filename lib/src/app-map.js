import { isPlainObject } from './render.js'
import { createState } from './state.js'
import { currentRoute, segmentsOf, url } from './location.js'
import { messageFor } from './i18n.js'

const mapKey = () => Symbol.for('imp.appMap')

const NODE_PROPS = ['path', 'label', 'description', 'access', 'nav', 'group']

const HANDLE_MEMBERS = ['href', 'spec', 'toString']

const NAME = /^\$?[A-Za-z_][A-Za-z0-9_]*$/

const EMPTY_TREE = Object.freeze([])

const EMPTY_CURRENT = Object.freeze({
  section: null,
  item: null,
  context: null,
  crumbs: [],
  pattern: null,
  params: {},
  waiting: false,
  leaving: false,
})

const fail = (message) => {
  throw new Error(`imp: appMap - ${message}`)
}

const words = (name) =>
  name
    .replace(/^\$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ')

const kebab = (name) => words(name).join('-')

const sentence = (name) => {
  const [first, ...rest] = words(name)
  return [first[0].toUpperCase() + first.slice(1), ...rest].join(' ')
}

const idOf = (node) => `app.${node.id}`

const optionEntry = (raw, node) => {
  if (isPlainObject(raw)) {
    if (raw.value === undefined) fail(`${idOf(node)}: an option needs a 'value'`)
    return {
      value: String(raw.value),
      label: raw.label === undefined ? String(raw.value) : String(raw.label),
    }
  }
  if (typeof raw === 'string' || typeof raw === 'number') {
    return { value: String(raw), label: String(raw) }
  }
  return fail(`${idOf(node)}: an option must be a { value, label } object or a string`)
}

export const normalizeOptions = (raw, node) => {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => optionEntry(entry, node))
}

const readPath = (value, node, parent) => {
  if (typeof value !== 'string' || value === '') fail(`${idOf(node)}: 'path' must be a segment`)
  if (node.param) fail(`${idOf(node)}: a param node takes its segment from its name`)
  if (value === '/') {
    if (parent.parent !== null) {
      fail(`${idOf(node)}: path '/' is the index of the app, so it goes on a top-level node`)
    }
    if (parent.children.some((sibling) => sibling.index)) {
      fail(`${idOf(node)}: the app has one index, and another node already has path '/'`)
    }
    return value
  }
  if (value.includes('/')) {
    fail(`${idOf(node)}: 'path' is one segment, like 'create-api-key' - nest a node for each level`)
  }
  return value
}

const readProps = (node, parent, value) => {
  for (const [key, raw] of Object.entries(value)) {
    if (!NODE_PROPS.includes(key)) continue
    switch (key) {
      case 'path':
        node.index = readPath(raw, node, parent) === '/'
        node.segment = node.index ? '' : raw
        break
      case 'label':
        if (typeof raw !== 'string' && typeof raw !== 'function') {
          fail(`${idOf(node)}: 'label' must be a string or a function`)
        }
        node.label = raw
        break
      case 'description':
        if (typeof raw !== 'string') fail(`${idOf(node)}: 'description' must be a string`)
        node.description = raw
        break
      case 'access':
        if (raw === undefined) fail(`${idOf(node)}: 'access' needs a value`)
        node.access = raw
        break
      case 'nav':
        if (raw !== false) fail(`${idOf(node)}: 'nav' takes false only, to hide a node`)
        if (node.param) fail(`${idOf(node)}: a param node is never a row - drop 'nav'`)
        node.nav = false
        break
      case 'group':
        if (typeof raw !== 'string' || raw === '') fail(`${idOf(node)}: 'group' must be a string`)
        node.group = raw
        break
    }
  }
}

const createNode = (parent, name) => {
  const param = name.startsWith('$')
  return {
    name,
    id: parent.parent === null ? name : `${parent.id}.${name}`,
    param,
    paramName: param ? name.slice(1) : null,
    index: false,
    segment: param ? `:${name.slice(1)}` : kebab(name),
    defaultLabel: sentence(name),
    parent,
    children: [],
    label: undefined,
    description: undefined,
    access: undefined,
    nav: undefined,
    group: undefined,
    handle: null,
    segments: [],
    pattern: '/',
  }
}

const reparent = (node, parent) => {
  node.parent = parent
  node.id = parent.parent === null ? node.name : `${parent.id}.${node.name}`
  for (const child of node.children) reparent(child, node)
}

const graft = (node, parent, fragment) => {
  const internals = fragment[mapKey()]
  if (internals.graftedInto !== null) {
    fail(
      `${idOf(node)}: this map is already a part of another map, under '${internals.graftedInto}'`,
    )
  }
  readProps(node, parent, internals.props)
  for (const child of internals.root.children) {
    if (child.index) {
      fail(
        `${idOf(
          node,
        )}.${child.name}: path '/' is the index of the app, so it goes on a top-level node`,
      )
    }
    reparent(child, node)
    node.children.push(child)
  }
  internals.graftedInto = idOf(node)
}

const describeValue = (parent, name) =>
  `${
    parent.parent === null ? 'the root' : idOf(parent)
  }: '${name}' is neither a node (a description, an object, or a map) nor a node prop (${NODE_PROPS.join(
    ', ',
  )})`

const parseChildren = (parent, value) => {
  for (const [name, raw] of Object.entries(value)) {
    if (NODE_PROPS.includes(name)) {
      if (parent.parent === null) fail(`'${name}' is a node prop, and the root holds nodes only`)
      continue
    }
    const fragment = isAppMap(raw)
    if (raw === true) {
      fail(
        `${
          parent.parent === null ? 'the root' : idOf(parent)
        }: '${name}' is true - write a description string, or {} for a node with nothing to say`,
      )
    }
    if (typeof raw !== 'string' && !isPlainObject(raw) && !fragment) {
      fail(describeValue(parent, name))
    }
    if (!NAME.test(name)) {
      fail(`'${name}' is not a valid node name - use an identifier like createApiKey or $projectId`)
    }
    if (HANDLE_MEMBERS.includes(name)) {
      fail(`'${name}' cannot name a node - a handle already has a '${name}' member`)
    }
    const node = createNode(parent, name)
    if (fragment) graft(node, parent, raw)
    else if (typeof raw === 'string') node.description = raw
    else readProps(node, parent, raw)
    parent.children.push(node)
    if (!fragment && typeof raw !== 'string') parseChildren(node, raw)
  }
}

const assignPatterns = (node) => {
  for (const child of node.children) {
    child.segments = child.index ? [] : [...node.segments, child.segment]
    child.pattern = child.segments.length === 0 ? '/' : `/${child.segments.join('/')}`
    assignPatterns(child)
  }
}

const rootOf = (node) => {
  let current = node
  while (current.parent !== null) current = current.parent
  return current
}

const childFor = (node, segment) =>
  node.children.find((child) => !child.param && !child.index && child.segment === segment)
  ?? node.children.find((child) => child.param)

const decodedSegment = (segment) => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

const matchRoot = (root, path) => {
  const segments = segmentsOf(path)
  const params = {}
  const chain = []
  let node = root
  for (const segment of segments) {
    let next = childFor(node, segment)
    if (!next && node === root) {
      const index = root.children.find((child) => child.index)
      if (index) {
        chain.push(index)
        next = childFor(index, segment)
      }
    }
    if (!next) return null
    if (next.param) {
      const value = decodedSegment(segment)
      if (value === null) return null
      params[next.paramName] = value
    }
    chain.push(next)
    node = next
  }
  if (node === root) {
    const index = root.children.find((child) => child.index)
    if (!index) return null
    chain.push(index)
    node = index
  }
  return { node, params, chain }
}

const currentParams = (node) => matchRoot(rootOf(node), currentRoute().path)?.params ?? {}

const fillSegments = (segments, params, strict, node) =>
  segments.map((segment) => {
    if (!segment.startsWith(':')) return segment
    const name = segment.slice(1)
    const value = params?.[name]
    if (value === undefined || value === null) {
      if (strict) fail(`${idOf(node)}.href() needs a value for '${name}'`)
      return segment
    }
    return encodeURIComponent(String(value))
  })

export const fillPattern = (node, params, { strict = false } = {}) => {
  const filled = fillSegments(node.segments, params, strict, node)
  return filled.length === 0 ? '/' : `/${filled.join('/')}`
}

const buildHandle = (node) => {
  if (node.handle !== null) return node.handle
  const members = {}
  for (const child of node.children) members[child.name] = buildHandle(child)
  const spec = Object.freeze({
    name: node.name,
    param: node.param,
    get segment() {
      return node.index ? '/' : node.segment
    },
    get pattern() {
      return node.pattern
    },
    label: node.label ?? node.defaultLabel,
    description: node.description,
    access: node.access,
    nav: node.nav,
    group: node.group,
    children: Object.freeze(node.children.map((child) => child.handle)),
  })
  const handle = Object.freeze({
    ...members,
    toString: () => node.pattern,
    href: (params) =>
      url(fillPattern(node, { ...currentParams(node), ...params }, { strict: true })),
    spec,
  })
  node.handle = handle
  return handle
}

const collect = (node, into) => {
  for (const child of node.children) {
    into.push(child)
    collect(child, into)
  }
  return into
}

const readMapProps = (props) => {
  if (!isPlainObject(props)) {
    fail('appMap(props, nodes) takes the props of the node the map hangs from, then its nodes')
  }
  const unknown = Object.keys(props).find((key) => !NODE_PROPS.includes(key))
  if (unknown) fail(`'${unknown}' is not a node prop (${NODE_PROPS.join(', ')})`)
  if (props.path === '/') fail("a map that another map grafts cannot be the index - drop path '/'")
  return props
}

export const appMap = (first, second) => {
  const [props, nodes] = second === undefined ? [{}, first] : [readMapProps(first), second]
  if (!isPlainObject(nodes)) fail('appMap(nodes) takes an object of nodes, one key per feature')
  const root = {
    name: '',
    id: '',
    param: false,
    index: false,
    parent: null,
    children: [],
    segments: [],
    pattern: '/',
  }
  parseChildren(root, nodes)
  assignPatterns(root)
  const members = {}
  for (const child of root.children) members[child.name] = buildHandle(child)
  const all = collect(root, [])
  const byPattern = new Map()
  for (const node of all) byPattern.set(node.pattern, node)
  return Object.freeze({
    ...members,
    [mapKey()]: {
      props,
      graftedInto: null,
      root,
      nodes: all,
      byPattern,
      feed: {
        tree: createState('imp.map.tree', EMPTY_TREE),
        current: createState('imp.map.current', EMPTY_CURRENT),
      },
    },
  })
}

export const isAppMap = (value) => Boolean(value?.[mapKey()])

export const mapInternals = (map) => map[mapKey()]

export const wholeMapProblem = (map) => {
  const { props, graftedInto } = map[mapKey()]
  if (graftedInto !== null) {
    return `this map is a part of another map, under '${graftedInto}' - pass the map that holds it`
  }
  if (Object.keys(props).length > 0) {
    return 'this map carries the props of a node, so it is a part of another map - pass the map that holds it'
  }
  return null
}

export const mapNav = (map) => map[mapKey()].feed

export const nodeOf = (map, handleOrPattern) =>
  map[mapKey()].byPattern.get(String(handleOrPattern)) ?? null

export const isDescendant = (node, ancestor) => {
  for (let current = node; current !== null; current = current.parent) {
    if (current === ancestor) return true
  }
  return false
}

export const matchMap = (map, path) => matchRoot(map[mapKey()].root, path)

export const paramsUpTo = (chain, node, params) => {
  const kept = {}
  for (const link of chain) {
    if (link.param) kept[link.paramName] = params[link.paramName]
    if (link === node) break
  }
  return kept
}

const messageOf = (node, prop) => messageFor(`appMap.${node.id}.${prop}`)

export const nodeLabel = (node, params, option) => {
  const message = messageOf(node, 'label')
  if (message !== undefined) return message
  if (typeof node.label === 'function') return String(node.label({ params, option }) ?? '')
  if (typeof node.label === 'string') return node.label
  if (node.param) return option?.label ?? params[node.paramName] ?? node.defaultLabel
  return node.defaultLabel
}

export const nodeDescription = (node) =>
  node.description === undefined ? undefined : (messageOf(node, 'description') ?? node.description)

const nodeGroup = (node) =>
  node.group === undefined ? null : (messageOf(node, 'group') ?? node.group)

const groupRows = (rows) => {
  const groups = []
  for (const { group, ...row } of rows) {
    const last = groups.at(-1)
    if (last && last.label === group) last.items.push(row)
    else groups.push({ label: group, items: [row] })
  }
  return groups
}

export const deriveNav = (map, { path, allowed, optionsOf, scope }) => {
  const { root } = map[mapKey()]
  const match = matchMap(map, path)
  const params = match?.params ?? {}
  const chain = []
  for (const node of match?.chain ?? []) {
    if (!allowed(node)) break
    chain.push(node)
  }
  const optionFor = (node) =>
    node.param
      ? optionsOf(node).find((option) => option.value === params[node.paramName])
      : undefined
  const currentLabel = (node) => nodeLabel(node, params, optionFor(node))
  const hrefOf = (node) => url(fillPattern(node, params))

  const row = (node, deep) => ({
    id: node.pattern,
    label: currentLabel(node),
    href: hrefOf(node),
    group: nodeGroup(node),
    children: deep ? rowsOf(node, false) : [],
  })

  function rowsOf(node, deep) {
    return node.children.flatMap((child) => {
      if (child.param || child.nav === false || !allowed(child)) return []
      return [row(child, deep)]
    })
  }

  const base = scope === null ? -1 : chain.indexOf(scope)
  const sectionRoot = base === -1 ? root : scope
  const section = chain[base + 1] ?? null
  const context = chain.slice(base + 1).findLast((node) => node.param) ?? section

  const sections = sectionRoot.children.flatMap((node) => {
    if (node.param || node.nav === false || !allowed(node)) return []
    const within = node === section ? context : node
    return [
      {
        id: node.pattern,
        label: currentLabel(node),
        href: hrefOf(node),
        groups: groupRows(rowsOf(within, true)),
      },
    ]
  })

  const rowIds = new Set()
  for (const entry of sections.find((entry) => entry.id === section?.pattern)?.groups ?? []) {
    for (const item of entry.items) {
      rowIds.add(item.id)
      for (const child of item.children) rowIds.add(child.id)
    }
  }
  const item = chain.findLast((node) => rowIds.has(node.pattern)) ?? null

  const pickerOf = (index) => {
    const node = chain[index]
    if (!node.param) return null
    const options = optionsOf(node)
    if (options.length === 0) return null
    let tail = index
    while (tail + 1 < chain.length && !chain[tail + 1].param) tail++
    return options.map((option) => ({
      id: option.value,
      label: option.label,
      href: url(fillPattern(chain[tail], { ...params, [node.paramName]: option.value })),
    }))
  }

  const crumbs = chain
    .map((node, index) => ({
      id: node.pattern,
      label: currentLabel(node),
      href: hrefOf(node),
      options: pickerOf(index),
    }))
    .slice(base === -1 ? 0 : base)

  return {
    sections,
    current: {
      section: section?.pattern ?? null,
      item: item?.pattern ?? null,
      context: context === null ? null : currentLabel(context),
      crumbs,
      pattern: chain.at(-1)?.pattern ?? null,
      params,
    },
  }
}
