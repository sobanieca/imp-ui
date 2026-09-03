import { component } from './component.js'
import { computed, createState, stateNameProblem, useState } from './state.js'
import { readLang, translationSource } from './i18n.js'
import { isPlainObject } from './render.js'
import { findProvided, provideOnHost } from './provide.js'
import { impLogger } from './logger.js'

const ROUTE_STATE = 'imp.route'
const ROUTE_TABLE = Symbol('imp.routeTable')
const LAZY = Symbol('imp.areaLoader')
const AREA = Symbol('imp.area')
const AREA_KIND = 'area'
const AREA_SCOPE = 'imp.area'
const GUARD = Symbol('imp.routeGuard')
const ROUTE_ENTRY = Symbol('imp.routeEntry')

export const wait = Symbol('imp.router.wait')

const MAX_GUARD_REDIRECTS = 10

const GUARD_WAIT_WARNING_MS = 5000

let guardRedirects = 0

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
    if (input.guard !== undefined) {
      throw new Error(
        'imp: area({ guard }) - a guard belongs to a single route: guard the entry pointing at this area with route({ guard, screen: area(() => import(...)) }), or guard entries inside its own table',
      )
    }
    if (input.root !== undefined && typeof input.root !== 'function') {
      throw new Error(
        "imp: area({ root }) - root must be a function returning the section's root component, like root: () => adminShell(); render the section's screens inside it with router()",
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
    "imp: area() takes either a loader that imports the area - area(() => import('./admin/area.js')), in the routes table that points at it - or the area's own definition, area({ routes: { '/': () => dashboard() }, root: () => adminShell(), translations: { en: () => import('./locales/en.js') } })",
  )
}

const immediateScreen = (label, factory) => (context) => {
  const output = factory(context)
  if (output && typeof output.then === 'function') {
    throw new Error(
      `imp: ${label} returned a Promise - a screen renders immediately; to load code on demand, group it behind area(() => import(...))`,
    )
  }
  return output
}

const isGuard = (value) => Boolean(value?.[GUARD])

const isRouteEntry = (value) => Boolean(value?.[ROUTE_ENTRY])

export const guard = (states, check) => {
  if (
    !Array.isArray(states) || states.length === 0 || !states.every((n) => typeof n === 'string')
  ) {
    throw new Error(
      "imp: guard(states, check) - 'states' must be a non-empty array of state names the check reads, like guard(['myapp.session'], (session) => session === undefined ? wait : true)",
    )
  }
  for (const name of states) {
    const problem = stateNameProblem(name)
    if (problem) throw new Error(`imp: guard - ${problem}`)
  }
  if (typeof check !== 'function') {
    throw new Error(
      "imp: guard(states, check) - 'check' must be a function receiving the state values and returning true, wait, false, or a path to redirect to",
    )
  }
  return { [GUARD]: true, states, check }
}

export const route = (input) => {
  if (!isPlainObject(input) || input.screen === undefined || input.guard === undefined) {
    throw new Error(
      "imp: route({ guard, screen }) - both are required; 'screen' is the factory or area() the pattern maps to, 'guard' is the single guard() protecting it",
    )
  }
  if (!isGuard(input.guard)) {
    throw new Error(
      'imp: route({ guard }) - must be one guard from guard(states, check); a route has exactly one guard, so write the conditions of several as one check',
    )
  }
  return { [ROUTE_ENTRY]: true, guard: input.guard, screen: input.screen }
}

const describeVerdict = (outcome) => typeof outcome === 'string' ? `'${outcome}'` : String(outcome)

const verdictOf = ({ states, check, handles }, context) => {
  const outcome = check(...handles.map((handle) => handle.get()), {
    ...context,
    path: routeState.get().path,
  })
  if (outcome === wait || outcome === false) return outcome
  if (outcome === true || outcome === undefined) return true
  if (typeof outcome === 'string' && outcome.startsWith('/')) return outcome
  throw new Error(
    `imp: guard([${states.join(', ')}]) returned ${
      describeVerdict(outcome)
    } - a guard must return true to allow, wait while it cannot decide yet, false to render the not-found page, or a path starting with '/' to redirect to`,
  )
}

const redirectFromGuard = (path) => {
  guardRedirects++
  if (guardRedirects > MAX_GUARD_REDIRECTS) {
    guardRedirects = 0
    throw new Error(
      `imp: route guards redirected ${MAX_GUARD_REDIRECTS} times without a screen rendering - they are redirecting in a cycle (the last hop was '${path}'); make sure the target of a redirect is not itself guarded back to where it came from`,
    )
  }
  impLogger.debug(`route guard redirecting to '${path}'`)
  queueMicrotask(() => navigate(path, { replace: true }))
}

const enterVerdict = (verdict, render, context, options) => {
  if (verdict === true) {
    guardRedirects = 0
    return render()
  }
  if (verdict === false) {
    guardRedirects = 0
    impLogger.debug('a route guard denied the screen - rendering the not-found page')
    return options.notFound ? options.notFound(context) : null
  }
  redirectFromGuard(verdict)
  return null
}

const waitWarningTimer = (states, isDecided) =>
  setTimeout(() => {
    if (isDecided()) return
    impLogger.warn(
      `a route guard at '${routeState.get().path}' is still waiting after ${GUARD_WAIT_WARNING_MS}ms - it keeps returning wait, so nothing has settled one of [${
        states.join(', ')
      }]`,
    )
  }, GUARD_WAIT_WARNING_MS)

const untilRemoved = (self, cleanup) => {
  self.abortSignal.addEventListener('abort', cleanup, { once: true })
}

const runGuard = (routeGuard, context, options, self, render) => {
  if (!routeGuard) {
    guardRedirects = 0
    return render()
  }
  if (!self.host.isConnected) return null
  const resolved = {
    states: routeGuard.states,
    check: routeGuard.check,
    handles: routeGuard.states.map((name) => useState(self, name)),
  }

  const entry = verdictOf(resolved, context)
  let decided = entry !== wait
  let settle = null
  const decision = decided ? null : new Promise((resolve) => {
    settle = resolve
  })
  const warning = decided ? null : waitWarningTimer(resolved.states, () => decided)
  if (warning) untilRemoved(self, () => clearTimeout(warning))

  let attaching = true
  const reevaluate = () => {
    if (attaching) return
    const verdict = verdictOf(resolved, context)
    if (verdict === wait) return
    if (!decided) {
      decided = true
      clearTimeout(warning)
      settle(verdict)
      return
    }
    if (verdict === true) {
      guardRedirects = 0
      return
    }
    if (verdict === false) {
      impLogger.error(
        `a route guard at '${routeState.get().path}' returned false for a screen that is already showing - only a redirect can leave a mounted screen, so it stays; return a path instead`,
      )
      return
    }
    redirectFromGuard(verdict)
  }

  for (const handle of resolved.handles) handle.watch(self, reevaluate)
  attaching = false

  return decided
    ? enterVerdict(entry, render, context, options)
    : decision.then((verdict) => enterVerdict(verdict, render, context, options))
}

const guardedTarget = (routeGuard, factory, options) => (context, self) =>
  runGuard(routeGuard, context, options, self, () => factory(context, self))

const areaRoutes = (table) => {
  if (!table || typeof table !== 'object' || Array.isArray(table)) {
    throw new Error('imp: a routes table must be an object mapping path patterns to screens')
  }
  if (isRouteTable(table)) return table
  const entries = Object.entries(table).map(([pattern, entry]) => {
    if (typeof pattern !== 'string' || !pattern.startsWith('/')) {
      throw new Error(`imp: routes table - '${pattern}' must be a path pattern starting with '/'`)
    }
    const routeGuard = isRouteEntry(entry) ? entry.guard : null
    const target = isRouteEntry(entry) ? entry.screen : entry
    if (typeof target !== 'function' && !isAreaLoader(target)) {
      throw new Error(
        isAreaDefinition(target)
          ? `imp: routes table - '${pattern}' maps to an area definition; an area is always loaded on demand, so point at it with area(() => import('./${
            pattern.replace(/^\//, '')
          }/area.js'))`
          : `imp: routes table - '${pattern}' must map to a screen factory or an area(() => import(...))`,
      )
    }
    return {
      pattern,
      segments: segmentsOf(pattern),
      target: isAreaLoader(target)
        ? target
        : immediateScreen(`routes table - '${pattern}'`, target),
      isArea: isAreaLoader(target),
      guard: routeGuard,
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
  } catch { /* history not writable - scroll restoration degrades to top-of-page */ }
}

const ensureRouteState = () => {
  if (routeState) return routeState
  routeState = createState(ROUTE_STATE, readLocation())
  pendingNavigation = { type: 'initial' }
  try {
    if ('scrollRestoration' in globalThis.history) globalThis.history.scrollRestoration = 'manual'
  } catch { /* not supported - leave the browser's default in place */ }
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
    loading: (_factory, context, options) => options?.loading ? options.loading(context) : null,
    error: (self, error, _factory, context, options) => {
      impLogger.error('a route failed to render', error)
      return options?.error ? options.error(self, error, context) : null
    },
    setup: (self, factory, context) => factory(context, self),
    onMount: applyNavigationEffects,
  })

const routePage = (factory, context, options) => {
  if (!routePageFactory) routePageFactory = defineRoutePage()
  return routePageFactory(factory, context, options)
}

const renderAreaBody = (definition, options, consumedBase, baseParams, context, self) => {
  if (!definition.root) return renderRouter(definition.routes, options, consumedBase, baseParams)
  provideOnHost(
    AREA_KIND,
    AREA_SCOPE,
    { table: definition.routes, options, consumedBase, baseParams },
    self.host,
    { addCleanup: (cleanup) => untilRemoved(self, cleanup) },
  )
  return immediateScreen('area({ root })', definition.root)(context)
}

const areaFactory = (target, consumedBase, baseParams, options) => (context, self) =>
  Promise.resolve(target.loader()).then((module) => {
    const loaded = module?.default ?? module
    if (!isAreaDefinition(loaded)) {
      return renderRouter(asTable(loaded), options, consumedBase, baseParams)
    }
    const render = () => renderAreaBody(loaded, options, consumedBase, baseParams, context, self)
    if (loaded.translations === undefined) return render()
    const source = translationSource(loaded.translations, 'area({ translations })')
    untilRemoved(self, () => source.dispose())
    return source.load(readLang()).then(render)
  })

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
      guardRedirects = 0
      return options.notFound
        ? routePage(options.notFound, { params: baseParams, query: current.query }, options)
        : null
    }
    const params = { ...baseParams, ...match.params }
    const context = { params, query: current.query }
    const factory = match.entry.isArea
      ? areaFactory(match.entry.target, consumedBase + match.consumed, params, options)
      : match.entry.target
    return routePage(guardedTarget(match.entry.guard, factory, options), context, options)
  })
}

const routerOptions = ({ loading, error, notFound }, inherited) => ({
  loading: loading ?? inherited?.loading ?? null,
  error: error ?? inherited?.error ?? null,
  notFound: notFound
    ? immediateScreen('router({ notFound })', notFound)
    : (inherited?.notFound ?? null),
})

let areaRouterFactory = null

const defineAreaRouter = () =>
  component('imp-area-router', {
    setup: (self, options) => {
      const enclosing = findProvided(AREA_KIND, AREA_SCOPE, self.host)?.value ?? null
      if (!enclosing) {
        throw new Error(
          "imp: router() with no 'routes' renders the routes of the area around it, so it only works inside the component an area({ root }) renders - pass a routes table like { '/': () => home() } anywhere else",
        )
      }
      return renderRouter(
        enclosing.table,
        routerOptions(options, enclosing.options),
        enclosing.consumedBase,
        enclosing.baseParams,
      )
    },
  })

const areaRouter = (options) => {
  if (!areaRouterFactory) areaRouterFactory = defineAreaRouter()
  return areaRouterFactory(options)
}

export const router = ({ routes: table, loading, error, notFound, guard } = {}) => {
  if (guard !== undefined) {
    throw new Error(
      'imp: router({ guard }) - a guard belongs to a single route: map the pattern to route({ guard, screen }) instead, so every guarded route names its guard where it is declared',
    )
  }
  if (loading !== undefined && typeof loading !== 'function') {
    throw new Error('imp: router({ loading }) - loading must be a function returning DOM')
  }
  if (error !== undefined && typeof error !== 'function') {
    throw new Error(
      'imp: router({ error }) - error must be a function returning the DOM to render in place of a failed screen',
    )
  }
  if (notFound !== undefined && typeof notFound !== 'function') {
    throw new Error(
      'imp: router({ notFound }) - notFound must be a function returning the not-found page',
    )
  }
  if (table === undefined) return areaRouter({ loading, error, notFound })
  return renderRouter(asTable(table), routerOptions({ loading, error, notFound }, null), 0, {})
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
