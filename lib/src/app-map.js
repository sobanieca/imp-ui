import { isPlainObject } from './render.js'
import { createState } from './state.js'
import { currentRoute, segmentsOf, url } from './location.js'
import { messageFor } from './i18n.js'

const mapKey = () => Symbol.for('imp.appMap')

const NODE_PROPS = ['description']

const ROOT_LABEL = 'Home'

const MOVED_PROPS = {
  label: (handle) =>
    `the label of a static node is the message appMap.<id>.label, and a param crumb takes the state imp.routeLabels - drop 'label' from ${handle}`,
  access: (handle) =>
    `a guard binds at the router: router({ guards: { [${handle}]: { states, check } } })`,
  nav: (handle) =>
    `a node leaves the nav at the shell: shell({ map, nav: { [${handle}]: { hidden: true } } })`,
  group: (handle) =>
    `a node heads a group of rows at the shell: shell({ map, nav: { [${handle}]: { group: true } } })`,
  path: () =>
    "the name of a node is its segment, and the map itself serves '/' - rename the node instead",
}

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

const idOf = (node) => (node.id === '' ? 'app' : `app.${node.id}`)

const failMovedProp = (key, holder) =>
  fail(`'${key}' is not a prop of the map - ${MOVED_PROPS[key](holder)}`)

const readProps = (node, value) => {
  if (value.description === undefined) return
  if (typeof value.description !== 'string') fail(`${idOf(node)}: 'description' must be a string`)
  node.description = value.description
}

const createNode = (parent, name) => {
  const param = name.startsWith('$')
  return {
    name,
    id: parent.parent === null ? name : `${parent.id}.${name}`,
    param,
    paramName: param ? name.slice(1) : null,
    segment: param ? `:${name.slice(1)}` : kebab(name),
    defaultLabel: sentence(name),
    parent,
    children: [],
    description: undefined,
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
  readProps(node, internals.props)
  for (const child of internals.root.children) {
    reparent(child, node)
    node.children.push(child)
  }
  internals.graftedInto = idOf(node)
  internals.node = node
  node.handle = fragment
}

const holderOf = (parent) => (parent.parent === null ? 'the root' : idOf(parent))

const parseChildren = (parent, value) => {
  for (const [name, raw] of Object.entries(value)) {
    if (NODE_PROPS.includes(name)) {
      if (parent.parent === null) fail(`'${name}' is a node prop, and the root holds nodes only`)
      continue
    }
    const fragment = isAppMap(raw)
    const nodeShaped = typeof raw === 'string' || isPlainObject(raw) || fragment
    if (!nodeShaped && Object.hasOwn(MOVED_PROPS, name)) {
      failMovedProp(name, parent.parent === null ? 'app.<node>' : idOf(parent))
    }
    if (raw === true) {
      fail(
        `${holderOf(
          parent,
        )}: '${name}' is true - write a description string, or {} for a node with nothing to say`,
      )
    }
    if (!nodeShaped) {
      fail(
        `${holderOf(
          parent,
        )}: '${name}' is neither a node (a description, an object, or a map) nor 'description'`,
      )
    }
    if (!NAME.test(name)) {
      fail(`'${name}' is not a valid node name - use an identifier like createApiKey or $projectId`)
    }
    if (HANDLE_MEMBERS.includes(name)) {
      fail(`'${name}' cannot name a node - a handle already has a '${name}' member`)
    }
    if (parent.parent === null && name === 'label') {
      fail(
        "'label' cannot name a top-level node - the message appMap.label is the label of the root",
      )
    }
    const node = createNode(parent, name)
    if (fragment) graft(node, parent, raw)
    else if (typeof raw === 'string') node.description = raw
    else readProps(node, raw)
    parent.children.push(node)
    if (!fragment && typeof raw !== 'string') parseChildren(node, raw)
  }
}

const checkParamNames = (node, above) => {
  for (const child of node.children) {
    if (!child.param) {
      checkParamNames(child, above)
      continue
    }
    const repeated = above.get(child.name)
    if (repeated !== undefined) {
      fail(
        `${idOf(child)}: the param '${child.name}' repeats the param of ${idOf(
          repeated,
        )} - a param name names one param of a chain, so give each its own name, like $orgId and $teamId`,
      )
    }
    checkParamNames(child, new Map(above).set(child.name, child))
  }
}

const assignPatterns = (node) => {
  for (const child of node.children) {
    child.segments = [...node.segments, child.segment]
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
  node.children.find((child) => !child.param && child.segment === segment)
  ?? node.children.find((child) => child.param)

const decodedSegment = (segment) => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

const matchRoot = (root, path) => {
  const params = {}
  const chain = [root]
  let node = root
  for (const segment of segmentsOf(path)) {
    const next = childFor(node, segment)
    if (!next) return null
    if (next.param) {
      const value = decodedSegment(segment)
      if (value === null) return null
      params[next.paramName] = value
    }
    chain.push(next)
    node = next
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

const LINK_OPTIONS = ['query', 'absolute']

const queryString = (query, node) => {
  if (!isPlainObject(query)) fail(`${idOf(node)}.href(params, { query }) - query is a plain object`)
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) search.append(key, String(item))
    }
  }
  const text = search.toString()
  return text === '' ? '' : `?${text}`
}

const withLinkOptions = (path, node, options) => {
  if (options === undefined) return path
  if (!isPlainObject(options))
    fail(`${idOf(node)}.href(params, options) - options is { query, absolute }`)
  const unknown = Object.keys(options).find((key) => !LINK_OPTIONS.includes(key))
  if (unknown)
    fail(
      `${idOf(node)}.href(params, options) - '${unknown}' is not an option; use query or absolute`,
    )
  const linked = options.query === undefined ? path : path + queryString(options.query, node)
  return options.absolute === true ? new URL(linked, globalThis.location.href).href : linked
}

const handleMembers = (nodeOfHandle) => ({
  toString: () => nodeOfHandle().pattern,
  href: (params, options) => {
    const node = nodeOfHandle()
    return withLinkOptions(
      url(fillPattern(node, { ...currentParams(node), ...params }, { strict: true })),
      node,
      options,
    )
  },
  spec: Object.freeze({
    get name() {
      return nodeOfHandle().name
    },
    get param() {
      return nodeOfHandle().param
    },
    get segment() {
      const node = nodeOfHandle()
      return node.parent === null ? '/' : node.segment
    },
    get pattern() {
      return nodeOfHandle().pattern
    },
    get label() {
      return nodeOfHandle().defaultLabel
    },
    get description() {
      return nodeOfHandle().description
    },
    get children() {
      return Object.freeze(nodeOfHandle().children.map((child) => child.handle))
    },
  }),
})

const childHandles = (node) => {
  const members = {}
  for (const child of node.children) members[child.name] = buildHandle(child)
  return members
}

const buildHandle = (node) => {
  if (node.handle !== null) return node.handle
  const handle = Object.freeze({ ...childHandles(node), ...handleMembers(() => node) })
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
  for (const key of Object.keys(props)) {
    if (Object.hasOwn(MOVED_PROPS, key)) failMovedProp(key, 'app.<node>')
    if (!NODE_PROPS.includes(key))
      fail(`appMap(props, nodes) - '${key}' is not a prop; props take only 'description'`)
  }
  if (props.description !== undefined && typeof props.description !== 'string') {
    fail("appMap(props, nodes) - 'description' must be a string")
  }
  return props
}

export const appMap = (first, second) => {
  const [props, nodes] = second === undefined ? [{}, first] : [readMapProps(first), second]
  if (!isPlainObject(nodes)) fail('appMap(nodes) takes an object of nodes, one key per feature')
  const root = {
    name: '',
    id: '',
    param: false,
    paramName: null,
    segment: '',
    defaultLabel: ROOT_LABEL,
    parent: null,
    children: [],
    description: undefined,
    handle: null,
    segments: [],
    pattern: '/',
  }
  parseChildren(root, nodes)
  checkParamNames(root, new Map())
  assignPatterns(root)
  const all = collect(root, [root])
  const byPattern = new Map()
  for (const node of all) byPattern.set(node.pattern, node)
  const internals = {
    props,
    graftedInto: null,
    root,
    node: root,
    nodes: all,
    byPattern,
    feed: {
      tree: createState('imp.map.tree', EMPTY_TREE),
      current: createState('imp.map.current', EMPTY_CURRENT),
    },
  }
  const map = Object.freeze({
    ...childHandles(root),
    ...handleMembers(() => internals.node),
    [mapKey()]: internals,
  })
  root.handle = map
  return map
}

export const isAppMap = (value) => Boolean(value?.[mapKey()])

export const isPrefixNode = (node) =>
  node.description === undefined
  && node.children.length > 0
  && node.children.every((child) => child.param)

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

const messageOf = (node, prop) =>
  messageFor(node.id === '' ? `appMap.${prop}` : `appMap.${node.id}.${prop}`)

export const nodeLabel = (node, params = {}, labels = {}) => {
  if (!node.param) return messageOf(node, 'label') ?? node.defaultLabel
  const entry = labels[node.name]
  if (entry !== undefined && entry !== null) return String(entry)
  return params[node.paramName] ?? node.defaultLabel
}

const hasLabel = (node, labels) =>
  !node.param || (labels[node.name] !== undefined && labels[node.name] !== null)

export const nodeDescription = (node) =>
  node.description === undefined ? undefined : (messageOf(node, 'description') ?? node.description)

export const deriveNav = (
  map,
  { path, allowed, labels, settled, scope, isPage = () => true, ownsPage = () => false },
) => {
  const { root } = map[mapKey()]
  const match = matchMap(map, path)
  const params = match?.params ?? {}
  const chain = []
  for (const node of match?.chain ?? []) {
    if (node !== root && !allowed(node)) break
    chain.push(node)
  }
  const waitsForLabel = (node) => !settled && !hasLabel(node, labels)
  const currentLabel = (node) => (waitsForLabel(node) ? '' : nodeLabel(node, params, labels))
  const hrefOf = (node) => url(fillPattern(node, params))

  const row = (node) => ({
    id: node.pattern,
    label: currentLabel(node),
    href: hrefOf(node),
    children: rowsOf(node),
  })

  function rowsOf(node) {
    return node.children.flatMap((child) => {
      if (child.param || !allowed(child)) return []
      return [row(child)]
    })
  }

  const base = Math.max(scope === null ? 0 : chain.indexOf(scope), 0)
  const sectionRoot = chain[base] ?? root
  const rootSection = ownsPage(sectionRoot) && allowed(sectionRoot)
  const section = chain[base + 1] ?? (rootSection ? sectionRoot : null)
  const context = chain.slice(base + 1).findLast((node) => node.param) ?? section

  const sectionOf = (node, items) => ({
    id: node.pattern,
    label: currentLabel(node),
    href: hrefOf(node),
    items,
  })

  const sections = [
    ...(rootSection ? [sectionOf(sectionRoot, [])] : []),
    ...sectionRoot.children.flatMap((node) => {
      if (node.param || !allowed(node)) return []
      return [sectionOf(node, rowsOf(node === section ? context : node))]
    }),
  ]

  const rowIds = new Set()
  const addRows = (rows) => {
    for (const each of rows) {
      rowIds.add(each.id)
      addRows(each.children)
    }
  }
  addRows(sections.find((entry) => entry.id === section?.pattern)?.items ?? [])
  const item = chain.findLast((node) => rowIds.has(node.pattern)) ?? null

  const crumbs = chain
    .slice(base)
    .filter((node) => node !== root || allowed(root))
    .map((node) => ({
      id: node.pattern,
      label: currentLabel(node),
      href: isPage(node) ? hrefOf(node) : null,
      loading: waitsForLabel(node),
    }))

  return {
    sections,
    current: {
      section: section?.pattern ?? null,
      item: item?.pattern ?? null,
      context: context === null ? null : currentLabel(context),
      crumbs,
      pattern: chain.at(-1)?.pattern ?? null,
      params,
      settled,
    },
  }
}
