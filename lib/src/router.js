import { activeMountScope, component } from './component.js'
import { computed, createState } from './state.js'
import { readLang, translationSource } from './i18n.js'
import { isPlainObject } from './render.js'
import { findProvided, provideOnHost } from './provide.js'
import { createLogger } from './logger.js'

const log = createLogger('imp')

const ROUTE_STATE = 'imp.route'
const ROUTE_TABLE = Symbol('imp.routeTable')
const LAZY = Symbol('imp.areaLoader')
const AREA = Symbol('imp.area')
const AREA_KIND = 'area'
const AREA_SCOPE = 'imp.area'

const normalizeBase = (value) => {
  if (!value || value === '/') return ''
  const leading = value.startsWith('/') ? value : `/${value}`
  return leading.endsWith('/') ? leading.slice(0, -1) : leading
}

const basePath = () => normalizeBase(globalThis.__IMP_ENV__?.IMP_BASEPATH ?? '')

const stripBase = (pathname) => {
  const base = basePath()
  return base && (pathname === base || pathname.startsWith(`${base}/`))
    ? pathname.slice(base.length) || '/'
    : pathname
}

export const url = (path) => {
  const base = basePath()
  return base && path.startsWith('/') ? base + path : path
}

const segmentsOf = (path) => path.split('/').filter(Boolean)

const matchSegments = (patternSegments, pathSegments) => {
  const params = {}
  for (let i = 0; i < patternSegments.length; i++) {
    const segment = patternSegments[i]
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decodeURIComponent(pathSegments[i])
    } else if (segment !== pathSegments[i]) {
      return null
    }
  }
  return params
}

const isRouteTable = (value) => Boolean(value?.[ROUTE_TABLE])

const isAreaLoader = (value) => Boolean(value?.[LAZY])

const isAreaDefinition = (value) => Boolean(value?.[AREA])

export const area = (input) => {
  if (typeof input === 'function') return { [LAZY]: true, loader: input }
  if (isPlainObject(input) && input.routes !== undefined) {
    if (input.root !== undefined && typeof input.root !== 'function') {
      throw new Error(
        "imp: area({ root }) — root must be a function returning the section's root component, like root: () => adminShell(); render the section's screens inside it with router()",
      )
    }
    return {
      [AREA]: true,
      root: input.root ?? null,
      routes: asTable(input.routes),
      translations: input.translations,
    }
  }
  throw new Error(
    "imp: area() takes either a loader that imports the area — area(() => import('./admin/area.js')), in the routes table that points at it — or the area's own definition, area({ routes: { '/': () => dashboard() }, root: () => adminShell(), translations: { en: () => import('./locales/en.js') } })",
  )
}

const immediateScreen = (label, factory) => (context) => {
  const output = factory(context)
  if (output && typeof output.then === 'function') {
    throw new Error(
      `imp: ${label} returned a Promise — a screen renders immediately; to load code on demand, group it behind area(() => import(...))`,
    )
  }
  return output
}

const areaRoutes = (table) => {
  if (!table || typeof table !== 'object' || Array.isArray(table)) {
    throw new Error('imp: a routes table must be an object mapping path patterns to screens')
  }
  if (isRouteTable(table)) return table
  const entries = Object.entries(table).map(([pattern, target]) => {
    if (typeof pattern !== 'string' || !pattern.startsWith('/')) {
      throw new Error(`imp: routes table — '${pattern}' must be a path pattern starting with '/'`)
    }
    if (typeof target !== 'function' && !isAreaLoader(target)) {
      throw new Error(
        isAreaDefinition(target)
          ? `imp: routes table — '${pattern}' maps to an area definition; an area is always loaded on demand, so point at it with area(() => import('./${
            pattern.replace(/^\//, '')
          }/area.js'))`
          : `imp: routes table — '${pattern}' must map to a screen factory or an area(() => import(...))`,
      )
    }
    return {
      pattern,
      segments: segmentsOf(pattern),
      target: isAreaLoader(target)
        ? target
        : immediateScreen(`routes table — '${pattern}'`, target),
      isArea: isAreaLoader(target),
    }
  })
  return { [ROUTE_TABLE]: true, entries }
}

const asTable = (value) => (isRouteTable(value) ? value : areaRoutes(value))

const matchTable = (table, pathSegments) => {
  for (const entry of table.entries) {
    if (entry.isArea) {
      if (pathSegments.length < entry.segments.length) continue
      const params = matchSegments(entry.segments, pathSegments.slice(0, entry.segments.length))
      if (params) return { entry, params, consumed: entry.segments.length }
    } else {
      if (pathSegments.length !== entry.segments.length) continue
      const params = matchSegments(entry.segments, pathSegments)
      if (params) return { entry, params, consumed: entry.segments.length }
    }
  }
  return null
}

const readLocation = () => {
  const location = new URL(globalThis.location.href)
  return { path: stripBase(location.pathname), query: Object.fromEntries(location.searchParams) }
}

let routeState = null

const syncFromLocation = () => routeState.set(readLocation())

const MAX_REMEMBERED_SCROLL_POSITIONS = 50

const scrollPositions = new Map()
let nextHistoryKey = 1
let scrollFrame = 0
let pendingNavigation = null

const currentHistoryKey = () => globalThis.history.state?.__impRouterKey ?? null

const rememberScrollPosition = (key, position) => {
  scrollPositions.delete(key)
  scrollPositions.set(key, position)
  while (scrollPositions.size > MAX_REMEMBERED_SCROLL_POSITIONS) {
    scrollPositions.delete(scrollPositions.keys().next().value)
  }
}

const recallScrollPosition = (key) => {
  if (!scrollPositions.has(key)) return 0
  const position = scrollPositions.get(key)
  scrollPositions.delete(key)
  scrollPositions.set(key, position)
  return position
}

const rememberScroll = () => {
  const key = currentHistoryKey()
  if (key != null) rememberScrollPosition(key, globalThis.scrollY || 0)
}

const onScroll = () => {
  if (scrollFrame) return
  scrollFrame = globalThis.requestAnimationFrame(() => {
    scrollFrame = 0
    rememberScroll()
  })
}

const onPopState = () => {
  pendingNavigation = { type: 'pop', scroll: recallScrollPosition(currentHistoryKey()) }
  syncFromLocation()
}

const stampCurrentHistoryEntry = () => {
  if (currentHistoryKey() != null) return
  try {
    globalThis.history.replaceState(
      { ...globalThis.history.state, __impRouterKey: nextHistoryKey++ },
      '',
    )
  } catch { /* history not writable — scroll restoration degrades to top-of-page */ }
}

const ensureRouteState = () => {
  if (routeState) return routeState
  routeState = createState(ROUTE_STATE, readLocation())
  pendingNavigation = { type: 'initial' }
  try {
    if ('scrollRestoration' in globalThis.history) globalThis.history.scrollRestoration = 'manual'
  } catch { /* not supported — leave the browser's default in place */ }
  stampCurrentHistoryEntry()
  globalThis.addEventListener('popstate', onPopState)
  globalThis.addEventListener('scroll', onScroll, { passive: true })
  return routeState
}

export const navigate = (to, { replace = false } = {}) => {
  const target = new URL(url(to), globalThis.location.href)
  if (target.origin !== globalThis.location.origin) {
    globalThis.location.href = target.href
    return
  }
  if (!replace && target.href === globalThis.location.href) return
  ensureRouteState()
  rememberScroll()
  pendingNavigation = { type: replace ? 'replace' : 'push' }
  globalThis.history[replace ? 'replaceState' : 'pushState'](
    { __impRouterKey: nextHistoryKey++ },
    '',
    target.href,
  )
  syncFromLocation()
}

const applyNavigationEffects = () => {
  const navigation = pendingNavigation
  pendingNavigation = null
  if (!navigation || navigation.type === 'initial') return
  globalThis.scrollTo?.(0, navigation.type === 'pop' ? navigation.scroll : 0)
}

let routePageFactory = null

const defineRoutePage = () =>
  component('imp-route', {
    placeholder: (_factory, context, options) =>
      options?.placeholder ? options.placeholder(context) : null,
    onError: (error, _factory, context, options) => {
      log.error('a route failed to render', error)
      return options?.onError ? options.onError(error, context) : null
    },
    onMount: (instance, factory, context) => {
      instance.afterMount(applyNavigationEffects)
      return factory(context)
    },
  })

const routePage = (factory, context, options) => {
  if (!routePageFactory) routePageFactory = defineRoutePage()
  return routePageFactory(factory, context, options)
}

const renderAreaBody = (definition, options, consumedBase, baseParams, context, scope) => {
  if (!definition.root) return renderRouter(definition.routes, options, consumedBase, baseParams)
  if (scope?.host) {
    provideOnHost(
      AREA_KIND,
      AREA_SCOPE,
      { table: definition.routes, options, consumedBase, baseParams },
      scope.host,
      scope,
    )
  } else {
    log.warn('an area with a root loaded outside a component — router() inside it finds no routes')
  }
  return immediateScreen('area({ root })', definition.root)(context)
}

const areaFactory = (target, consumedBase, baseParams, options) => (context) => {
  const scope = activeMountScope()
  return Promise.resolve(target.loader()).then((module) => {
    const loaded = module?.default ?? module
    if (!isAreaDefinition(loaded)) {
      return renderRouter(asTable(loaded), options, consumedBase, baseParams)
    }
    const render = () => renderAreaBody(loaded, options, consumedBase, baseParams, context, scope)
    if (loaded.translations === undefined) return render()
    const source = translationSource(loaded.translations, 'area({ translations })')
    if (scope) scope.addCleanup(() => source.dispose())
    else log.warn('an area loaded outside a component — its translations will not be released')
    return source.load(readLang()).then(render)
  })
}

const renderRouter = (table, options, consumedBase, baseParams) => {
  ensureRouteState()
  const keyOf = () => {
    const tail = segmentsOf(routeState.get().path).slice(consumedBase)
    const match = matchTable(table, tail)
    if (!match) return { miss: true }
    return {
      kind: match.entry.isArea ? 'area' : 'screen',
      pattern: match.entry.pattern,
      params: match.params,
    }
  }
  return computed([routeState], keyOf).view(() => {
    const current = routeState.get()
    const tail = segmentsOf(current.path).slice(consumedBase)
    const match = matchTable(table, tail)
    if (!match) {
      return options.onNotFound
        ? routePage(options.onNotFound, { params: baseParams, query: current.query }, options)
        : null
    }
    const params = { ...baseParams, ...match.params }
    const context = { params, query: current.query }
    if (!match.entry.isArea) return routePage(match.entry.target, context, options)
    const factory = areaFactory(match.entry.target, consumedBase + match.consumed, params, options)
    return routePage(factory, context, options)
  })
}

const enclosingArea = () => {
  const scope = activeMountScope()
  if (!scope?.host) return null
  return findProvided(AREA_KIND, AREA_SCOPE, scope.host)?.value ?? null
}

export const router = ({ routes: table, placeholder, onError, onNotFound } = {}) => {
  const enclosing = table === undefined ? enclosingArea() : null
  if (table === undefined && !enclosing) {
    throw new Error(
      "imp: router({ routes }) — 'routes' is required; pass a routes table like { '/': () => home() }. router() without a table renders the routes of the area around it, so it only works inside the component an area({ root }) renders",
    )
  }
  if (placeholder !== undefined && typeof placeholder !== 'function') {
    throw new Error('imp: router({ placeholder }) — placeholder must be a function returning DOM')
  }
  if (onError !== undefined && typeof onError !== 'function') {
    throw new Error('imp: router({ onError }) — onError must be a function returning fallback DOM')
  }
  if (onNotFound !== undefined && typeof onNotFound !== 'function') {
    throw new Error(
      'imp: router({ onNotFound }) — onNotFound must be a function returning the not-found page',
    )
  }
  const inherited = enclosing?.options
  const options = {
    placeholder: placeholder ?? inherited?.placeholder ?? null,
    onError: onError ?? inherited?.onError ?? null,
    onNotFound: onNotFound
      ? immediateScreen('router({ onNotFound })', onNotFound)
      : (inherited?.onNotFound ?? null),
  }
  return enclosing
    ? renderRouter(enclosing.table, options, enclosing.consumedBase, enclosing.baseParams)
    : renderRouter(asTable(table), options, 0, {})
}

export const useRoute = () => {
  const state = ensureRouteState()
  return {
    name: state.name,
    get: state.get,
    watch: state.watch,
    text: state.text,
    view: state.view,
    each: state.each,
  }
}
