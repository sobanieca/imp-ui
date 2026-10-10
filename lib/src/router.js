import { component, LOADING_MAY_BE_SKIPPED, pendingRendersIn, rendered } from './component.js'
import { endView, readyView, startView } from './analytics-bus.js'
import { computed, createState, readableState, stateNameProblem, useState } from './state.js'
import { lang, readLang, translationSource } from './i18n.js'
import { isPlainObject } from './render.js'
import { findProvided, provideOnHost } from './provide.js'
import { impLogger } from './logger.js'
import { loadChunk } from './chunk-reload.js'
import {
  currentRoute,
  inTheApp,
  isWebUrl,
  resolveTarget,
  routeOf,
  safeNext,
  sameRoute,
  url,
} from './location.js'
import { allowedBy } from './veto.js'
import {
  claimScreen,
  releaseScreen,
  SCREEN_EFFECTS,
  scrollRegion,
  transitionScreen,
} from './screen.js'
import {
  deriveNav,
  fillPattern,
  isAppMap,
  isDescendant,
  mapInternals,
  matchMap,
  nodeDescription,
  nodeLabel,
  nodeOf,
  normalizeOptions,
  paramsUpTo,
  wholeMapProblem,
} from './app-map.js'
import { emptyState } from './std/display/empty-state.js'

export { safeNext, url }

const ROUTE_STATE = 'imp.route'
const LAZY = Symbol('imp.areaLoader')
const AREA = Symbol('imp.area')
const AREA_KIND = 'area'
const AREA_SCOPE = 'imp.area'
const GUARD = Symbol('imp.routeGuard')
const REDIRECT = Symbol('imp.redirect')

export const wait = Symbol('imp.router.wait')

const isRedirect = (value) => Boolean(value?.[REDIRECT])

export const redirect = (to) => {
  if (typeof to !== 'string' && typeof to?.href !== 'function') {
    throw new Error(
      "imp: redirect(to) - to is a handle of the map, like redirect(app.tasks), or a path starting with '/'",
    )
  }
  if (typeof to === 'string' && !to.startsWith('/')) {
    throw new Error(`imp: redirect('${to}') - a path starts with '/'`)
  }
  return { [REDIRECT]: true, to }
}

const MAX_GUARD_REDIRECTS = 10

const GUARD_WAIT_WARNING_MS = 5000

let guardRedirects = 0

const isAreaLoader = (value) => Boolean(value?.[LAZY])

const isAreaDefinition = (value) => Boolean(value?.[AREA])

export const area = (input) => {
  if (typeof input === 'function') return { [LAZY]: true, loader: input }
  if (isPlainObject(input) && input.screens !== undefined) {
    if (input.access !== undefined || input.guard !== undefined) {
      throw new Error(
        "imp: area({ access }) - access is a node prop of the map: write access: 'admin' on the node the area binds to",
      )
    }
    if (input.root !== undefined && typeof input.root !== 'function') {
      throw new Error(
        "imp: area({ root }) - root must be a function returning the section's root component, like root: () => adminShell(); render the section's screens inside it with router()",
      )
    }
    if (!isPlainObject(input.screens)) {
      throw new Error(
        'imp: area({ screens }) - screens must be an object keyed by handles of the map, like { [app.admin.users]: () => users() }',
      )
    }
    return {
      [AREA]: true,
      root: input.root ?? null,
      screens: input.screens,
      translations: input.translations,
    }
  }
  throw new Error(
    "imp: area() takes either a loader that imports the area - area(() => import('./admin/area.js')), bound to a node in screens - or the area's own definition, area({ screens: { [app.admin.users]: () => users() }, root: () => adminShell(), translations: { en: () => import('./locales/en.js') } })",
  )
}

const immediateScreen = (label, factory) => (context) => {
  const output = factory(context)
  if (output && typeof output.then === 'function') {
    throw new Error(
      `imp: ${label} returned a Promise - a screen renders immediately; to load code on demand, bind the node to area(() => import(...))`,
    )
  }
  return output
}

const isGuard = (value) => Boolean(value?.[GUARD])

export const guard = (states, check) => {
  if (
    !Array.isArray(states) || states.length === 0 || !states.every((n) => typeof n === 'string')
  ) {
    throw new Error(
      "imp: guard(states, check) - 'states' must be a non-empty array of state names the check reads, like guard(['myapp.session'], (session, { need }) => session === undefined ? wait : true)",
    )
  }
  for (const name of states) {
    const problem = stateNameProblem(name)
    if (problem) throw new Error(`imp: guard - ${problem}`)
  }
  if (typeof check !== 'function') {
    throw new Error(
      "imp: guard(states, check) - 'check' must be a function receiving the state values and { need, params, query, searchParams, path }, returning true, wait, false, or a path to redirect to",
    )
  }
  return { [GUARD]: true, states, check }
}

const describeVerdict = (outcome) => typeof outcome === 'string' ? `'${outcome}'` : String(outcome)

const normalizeVerdict = (states, outcome) => {
  if (outcome === wait || outcome === false) return outcome
  if (outcome === true || outcome === undefined) return true
  if (typeof outcome === 'string' && outcome.startsWith('/')) return outcome
  throw new Error(
    `imp: guard([${states.join(', ')}]) returned ${
      describeVerdict(outcome)
    } - a guard must return true to allow, wait while it cannot decide yet, false to render the not-found page, or a path starting with '/' to redirect to`,
  )
}

const accessVerdict = (access, values, needs, context) => {
  for (const need of needs) {
    const outcome = normalizeVerdict(access.states, access.check(...values, { ...context, need }))
    if (outcome !== true) return outcome
  }
  return true
}

const needsBetween = (chain, from, to) => {
  const needs = []
  for (const node of chain) {
    if (from !== null && isDescendant(from, node)) continue
    if (node.access !== undefined) needs.push(node.access)
    if (node === to) break
  }
  return needs
}

const verdictOf = ({ access, needs, handles }, context) =>
  accessVerdict(access, handles.map((handle) => handle.get()), needs, {
    ...context,
    path: routeState.get().path,
  })

const redirectFromGuard = (path) => {
  guardRedirects++
  if (guardRedirects > MAX_GUARD_REDIRECTS) {
    guardRedirects = 0
    throw new Error(
      `imp: route guards redirected ${MAX_GUARD_REDIRECTS} times without a screen rendering - they are redirecting in a cycle (the last hop was '${path}'); make sure the target of a redirect is not itself guarded back to where it came from`,
    )
  }
  impLogger.debug(`route guard redirecting to '${path}'`)
  queueMicrotask(() => redirectTo(path))
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

const pageViews = new WeakMap()

const dropPageView = (self) => {
  const view = pageViews.get(self)
  if (view) endView(view)
}

const runGuard = (access, needs, context, options, self, render) => {
  const enter = (verdict) => {
    if (typeof verdict === 'string') dropPageView(self)
    return enterVerdict(verdict, render, context, options)
  }
  if (needs.length === 0) {
    guardRedirects = 0
    return render()
  }
  if (!self.host.isConnected) return null
  const resolved = {
    access,
    needs,
    handles: access.states.map((name) => useState(self, name)),
  }

  const entry = verdictOf(resolved, context)
  let decided = entry !== wait
  let settle = null
  const decision = decided ? null : new Promise((resolve) => {
    settle = resolve
  })
  const warning = decided ? null : waitWarningTimer(access.states, () => decided)
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

  return decided ? enter(entry) : decision.then(enter)
}

const guardedTarget = (access, needs, factory, options) => (context, self) =>
  runGuard(access, needs, context, options, self, () => factory(context, self))

const bindScreens = (map, scopeNode, screens, label) => {
  if (!isPlainObject(screens)) {
    throw new Error(`imp: ${label} - screens must be an object keyed by handles of the map`)
  }
  const bound = new Map()
  for (const [key, target] of Object.entries(screens)) {
    const node = nodeOf(map, key)
    if (node === null) {
      throw new Error(
        key === 'undefined'
          ? `imp: ${label} - a key is 'undefined', so a handle is mistyped; check every [app...] key against the map`
          : `imp: ${label} - '${key}' is not a node of the map; key screens by handles like [app.admin.users]`,
      )
    }
    if (scopeNode !== null && !isDescendant(node, scopeNode)) {
      throw new Error(
        `imp: ${label} - '${key}' is outside the area at '${scopeNode.pattern}'; an area binds only its own nodes`,
      )
    }
    if (isAreaLoader(target)) bound.set(node, { kind: 'area', target })
    else if (isRedirect(target)) {
      const to = typeof target.to === 'string' ? null : nodeOf(map, target.to)
      if (typeof target.to !== 'string' && to === null) {
        throw new Error(
          `imp: ${label} - '${key}' redirects to '${target.to}', which is not a node of the map`,
        )
      }
      bound.set(node, { kind: 'redirect', target: to ?? target.to })
    } else if (typeof target === 'function') {
      bound.set(node, { kind: 'screen', target: immediateScreen(`${label} '${key}'`, target) })
    } else {
      throw new Error(
        isAreaDefinition(target)
          ? `imp: ${label} - '${key}' maps to an area definition; an area is always loaded on demand, so bind it with area(() => import('./area.js'))`
          : `imp: ${label} - '${key}' must map to a screen factory or an area(() => import(...))`,
      )
    }
  }
  return bound
}

let routeState = null

const syncFromLocation = () => routeState.set(currentRoute())

const MAX_REMEMBERED_SCROLL_POSITIONS = 50

const TOP = { page: 0, region: 0 }

const scrollPositions = new Map()
const leaveChecks = new Set()
let nextHistoryKey = 1
let historyIndex = 0
let activeKey = null
let pendingNavigation = null
let leaving = false
let heldTraversal = null
let traversalAllowed = false

const newHistoryKey = () => `${globalThis.performance.timeOrigin}:${nextHistoryKey++}`

const currentHistoryKey = () => globalThis.history.state?.__impRouterKey ?? null

const currentHistoryIndex = () => globalThis.history.state?.__impRouterIndex ?? null

const rememberScrollPosition = (key, position) => {
  scrollPositions.delete(key)
  scrollPositions.set(key, position)
  while (scrollPositions.size > MAX_REMEMBERED_SCROLL_POSITIONS) {
    scrollPositions.delete(scrollPositions.keys().next().value)
  }
}

const recallScrollPosition = (key) => {
  if (!scrollPositions.has(key)) return TOP
  const position = scrollPositions.get(key)
  scrollPositions.delete(key)
  scrollPositions.set(key, position)
  return position
}

const readScroll = () => ({
  page: globalThis.scrollY || 0,
  region: scrollRegion()?.scrollTop ?? 0,
})

const rememberScroll = () => {
  if (activeKey != null) rememberScrollPosition(activeKey, readScroll())
}

const restoreScroll = ({ page, region }) => {
  globalThis.scrollTo(0, page)
  const element = scrollRegion()
  if (element) element.scrollTop = region
}

const askToLeave = async () => {
  if (leaving) return false
  leaving = true
  try {
    return await allowedBy([...leaveChecks], 'beforeLeave')
  } finally {
    leaving = false
  }
}

const holdsTraversal = (index) =>
  !traversalAllowed && leaveChecks.size > 0 && index !== null && index !== historyIndex &&
  !sameRoute(currentRoute(), routeState.get())

const resumeHeldTraversal = () => {
  const { steps } = heldTraversal
  heldTraversal = null
  askToLeave().then((allowed) => {
    if (!allowed) return
    traversalAllowed = true
    globalThis.history.go(steps)
  })
}

const onPopState = () => {
  const index = currentHistoryIndex()
  if (heldTraversal) {
    resumeHeldTraversal()
    return
  }
  if (holdsTraversal(index)) {
    heldTraversal = { steps: index - historyIndex }
    globalThis.history.go(historyIndex - index)
    return
  }
  traversalAllowed = false
  rememberScroll()
  const back = index !== null && index < historyIndex
  historyIndex = index ?? historyIndex
  activeKey = currentHistoryKey()
  pendingNavigation = { type: 'pop', scroll: recallScrollPosition(activeKey) }
  transitionScreen(syncFromLocation, { back })
}

const stampCurrentHistoryEntry = () => {
  historyIndex = currentHistoryIndex() ?? 0
  if (currentHistoryKey() == null || currentHistoryIndex() == null) {
    try {
      globalThis.history.replaceState(
        {
          ...globalThis.history.state,
          __impRouterKey: currentHistoryKey() ?? newHistoryKey(),
          __impRouterIndex: historyIndex,
        },
        '',
      )
    } catch { /* history not writable - scroll restoration degrades to top-of-page */ }
  }
  activeKey = currentHistoryKey()
}

const ensureRouteState = () => {
  if (routeState) return routeState
  routeState = createState(ROUTE_STATE, currentRoute())
  pendingNavigation = { type: 'initial' }
  globalThis.history.scrollRestoration = 'manual'
  stampCurrentHistoryEntry()
  globalThis.addEventListener('popstate', onPopState)
  return routeState
}

const checkedTarget = (to, external, subject) => {
  const target = resolveTarget(to)
  if (inTheApp(target)) return target
  if (!isWebUrl(target)) {
    throw new Error(`imp: ${subject}('${to}') - only an http or https url can be followed`)
  }
  if (!external) {
    throw new Error(
      `imp: ${subject}('${to}') - '${target.origin}' is another site; pass navigate(url, { external: true }) to leave the app, or safeNext(value, fallback) for a path from the url`,
    )
  }
  return target
}

const moveTo = (target, replace) => {
  if (!inTheApp(target)) {
    globalThis.location.href = target.href
    return
  }
  ensureRouteState()
  rememberScroll()
  if (!replace) historyIndex += 1
  activeKey = newHistoryKey()
  pendingNavigation = { type: replace ? 'replace' : 'push' }
  globalThis.history[replace ? 'replaceState' : 'pushState'](
    { __impRouterKey: activeKey, __impRouterIndex: historyIndex },
    '',
    target.href,
  )
  transitionScreen(syncFromLocation)
}

const redirectTo = (to) => moveTo(checkedTarget(to, false, 'redirect'), true)

const leavesTheRoute = (target) =>
  !inTheApp(target) || !sameRoute(routeOf(target.href), currentRoute())

export const navigate = (to, { replace = false, external = false } = {}) => {
  const target = checkedTarget(to, external, 'navigate')
  if (!replace && target.href === globalThis.location.href) return
  if (leaveChecks.size === 0 || !leavesTheRoute(target)) {
    moveTo(target, replace)
    return
  }
  askToLeave().then((allowed) => {
    if (allowed) moveTo(target, replace)
  })
}

export const screenRegion = (self, element, { effect = 'none' } = {}) => {
  if (typeof self?.abortSignal?.addEventListener !== 'function') {
    throw new Error(
      "imp: screenRegion(self, element) - 'self' must be the self of the component that renders the element, so the claim ends when it unmounts",
    )
  }
  if (!(element instanceof Element)) {
    throw new Error(
      'imp: screenRegion(self, element) - the element must be the box that scrolls the screens, such as your <main>',
    )
  }
  if (!SCREEN_EFFECTS.includes(effect)) {
    throw new Error(
      `imp: screenRegion(self, element, { effect }) - 'effect' must be one of ${
        SCREEN_EFFECTS.map((name) => `'${name}'`).join(', ')
      }, got '${effect}'`,
    )
  }
  claimScreen(element, effect)
  untilRemoved(self, () => releaseScreen(element))
}

export const beforeLeave = (self, check) => {
  if (typeof self?.abortSignal?.addEventListener !== 'function') {
    throw new Error(
      "imp: beforeLeave(self, check) - 'self' must be the self of the component that holds the unsaved work, so the check ends when it unmounts",
    )
  }
  if (typeof check !== 'function') {
    throw new Error(
      "imp: beforeLeave(self, check) - 'check' must be a function returning false, or a Promise of false, to stay, like () => !dirty.get() || confirmDiscard()",
    )
  }
  ensureRouteState()
  const entry = () => check()
  leaveChecks.add(entry)
  untilRemoved(self, () => leaveChecks.delete(entry))
}

const applyNavigationEffects = () => {
  const navigation = pendingNavigation
  pendingNavigation = null
  if (!navigation || navigation.type === 'initial') return
  restoreScroll(navigation.type === 'pop' ? navigation.scroll : TOP)
}

let routePageFactory = null

const screenRendered = async (host) => {
  await rendered(host)
  await Promise.all(pendingRendersIn(host.shadowRoot))
}

const recordView = (self, place) => {
  if (place.area) return
  const view = startView(place.page)
  pageViews.set(self, view)
  untilRemoved(self, () => endView(view))
  queueMicrotask(() => screenRendered(self.host).then(() => readyView(view)))
}

const defineRoutePage = () =>
  component('imp-route', {
    [LOADING_MAY_BE_SKIPPED]: true,
    loading: (_factory, context, options) => options?.loading ? options.loading(context) : null,
    error: (self, error, _factory, context, options) => {
      impLogger.error('a route failed to render', error)
      return options?.error ? options.error(self, error, context) : null
    },
    setup: (self, factory, context, _options, place) => {
      recordView(self, place)
      return factory(context, self)
    },
    onMount: applyNavigationEffects,
  })

const routePage = (factory, context, options, place) => {
  if (!routePageFactory) routePageFactory = defineRoutePage()
  return routePageFactory(factory, context, options, place)
}

const stubScreen = (node) => ({ params }) =>
  emptyState({
    title: computed([lang], () => nodeLabel(node, params)),
    description: node.description === undefined
      ? undefined
      : computed([lang], () => nodeDescription(node)),
  })

const renderAreaBody = (scope, definition, context, self) => {
  if (!definition.root) return renderRouter(scope)
  provideOnHost(AREA_KIND, AREA_SCOPE, { scope }, self.host, {
    addCleanup: (cleanup) => untilRemoved(self, cleanup),
  })
  return immediateScreen('area({ root })', definition.root)(context)
}

const areaFactory = (scope, node, binding) => (context, self) =>
  loadChunk(binding.target.loader).then((module) => {
    const loaded = module?.default ?? module
    if (!isAreaDefinition(loaded)) {
      throw new Error(
        `imp: the area at '${node.pattern}' loaded a module whose default export is not an area({ screens }) definition`,
      )
    }
    const inner = {
      map: scope.map,
      node,
      screens: bindScreens(scope.map, node, loaded.screens, `area at '${node.pattern}'`),
      access: scope.access,
      options: scope.options,
    }
    const render = () => renderAreaBody(inner, loaded, context, self)
    if (loaded.translations === undefined) return render()
    const source = translationSource(loaded.translations, 'area({ translations })')
    untilRemoved(self, () => source.dispose())
    return source.load(readLang()).then(render)
  })

const targetFor = (scope, { chain, params }) => {
  const start = scope.node === null ? 0 : chain.indexOf(scope.node) + 1
  if (scope.node !== null && start === 0) return null
  for (let index = start; index < chain.length; index++) {
    const binding = scope.screens.get(chain[index])
    if (binding?.kind === 'area') return { kind: 'area', node: chain[index], binding }
  }
  const leaf = chain.at(-1)
  const binding = scope.screens.get(leaf)
  if (binding?.kind === 'redirect') {
    const to = typeof binding.target === 'string'
      ? binding.target
      : fillPattern(binding.target, params)
    return { kind: 'redirect', node: leaf, to }
  }
  if (binding) return { kind: 'screen', node: leaf, binding }
  const first = leaf.children.find((child) => !child.param)
  if (first) return { kind: 'redirect', node: leaf, to: fillPattern(first, params) }
  return { kind: 'stub', node: leaf, binding: null }
}

const resolve = (scope, path) => {
  const match = matchMap(scope.map, path)
  if (!match) return null
  const target = targetFor(scope, match)
  return target && { match, target }
}

const keyOf = (scope) => {
  const resolved = resolve(scope, routeState.get().path)
  if (!resolved) return { miss: true }
  const { match, target } = resolved
  if (target.kind === 'redirect') return { kind: 'redirect', to: target.to }
  return {
    kind: target.kind,
    pattern: target.node.pattern,
    params: target.kind === 'area'
      ? paramsUpTo(match.chain, target.node, match.params)
      : match.params,
  }
}

const baseParams = (scope, match) =>
  scope.node === null ? {} : paramsUpTo(match.chain, scope.node, match.params)

const renderRouter = (scope) => {
  ensureRouteState()
  return computed([routeState], () => keyOf(scope)).view(() => {
    const current = routeState.get()
    const resolved = resolve(scope, current.path)
    if (!resolved) {
      guardRedirects = 0
      const match = matchMap(scope.map, current.path)
      const params = match ? baseParams(scope, match) : {}
      return scope.options.notFound
        ? routePage(scope.options.notFound, {
          params,
          query: current.query,
          searchParams: current.searchParams,
        }, {
          ...scope.options,
          loading: null,
        }, { page: null, path: current.path, area: false })
        : null
    }
    const { match, target } = resolved
    if (target.kind === 'redirect') {
      guardRedirects = 0
      impLogger.debug(`'${current.path}' forwards to '${target.to}'`)
      queueMicrotask(() => redirectTo(target.to))
      return null
    }
    const params = target.kind === 'area'
      ? paramsUpTo(match.chain, target.node, match.params)
      : match.params
    const context = {
      params,
      query: current.query,
      searchParams: current.searchParams,
      node: target.node.handle,
    }
    const needs = scope.access === null ? [] : needsBetween(match.chain, scope.node, target.node)
    const factory = target.kind === 'area'
      ? areaFactory(scope, target.node, target.binding)
      : target.kind === 'screen'
      ? target.binding.target
      : stubScreen(target.node)
    const mayWait = needs.length > 0 || target.kind === 'area'
    return routePage(
      guardedTarget(scope.access, needs, factory, scope.options),
      context,
      mayWait ? scope.options : { ...scope.options, loading: null },
      { page: target.node.pattern, path: current.path, area: target.kind === 'area' },
    )
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
          "imp: router() with no 'map' renders the screens of the area around it, so it only works inside the component an area({ root }) renders - pass router({ map, screens }) anywhere else",
        )
      }
      return renderRouter({
        ...enclosing.scope,
        options: routerOptions(options, enclosing.scope.options),
      })
    },
  })

const areaRouter = (options) => {
  if (!areaRouterFactory) areaRouterFactory = defineAreaRouter()
  return areaRouterFactory(options)
}

const readOptions = (scope, node, values) => {
  const source = scope.optionsByNode.get(node)
  if (source === undefined) return []
  return typeof source === 'string' ? normalizeOptions(values[source], node) : source
}

const settledVerdict = (access, values, needs, context) => {
  try {
    return accessVerdict(access, values, needs, context)
  } catch (error) {
    impLogger.error(`the access guard failed at '${context.path}' - hiding the node`, error)
    return false
  }
}

const stubNodes = (map, screens) =>
  mapInternals(map).nodes.filter((node) => {
    if (screens.has(node)) return false
    if (node.children.some((child) => !child.param)) return false
    for (let ancestor = node.parent; ancestor !== null; ancestor = ancestor.parent) {
      if (screens.get(ancestor)?.kind === 'area') return false
    }
    return true
  })

const logStubs = (map, screens) => {
  const stubs = stubNodes(map, screens)
  if (stubs.length === 0) return
  impLogger.info(
    `router: ${stubs.length} node${stubs.length === 1 ? '' : 's'} of the map render${
      stubs.length === 1 ? 's' : ''
    } a stub until bound in screens - ${stubs.map((node) => node.pattern).join(', ')}`,
  )
}

const stateNamesOf = (scope) => {
  const names = new Set()
  for (const source of scope.optionsByNode.values()) {
    if (typeof source === 'string') names.add(source)
  }
  return [...names]
}

let mapRouterFactory = null

const pageDescriptions = new WeakMap()

const descriptionMeta = (text) => {
  const found = document.head.querySelector('meta[name="description"]')
  if (found !== null || text === undefined) return found
  const created = document.createElement('meta')
  created.setAttribute('name', 'description')
  pageDescriptions.set(created, null)
  document.head.append(created)
  return created
}

const writeDescription = (text) => {
  const meta = descriptionMeta(text)
  if (meta === null) return
  if (!pageDescriptions.has(meta)) pageDescriptions.set(meta, meta.getAttribute('content'))
  const content = text ?? pageDescriptions.get(meta)
  if (content === null) meta.remove()
  else meta.setAttribute('content', content)
}

const defineMapRouter = () =>
  component('imp-router', {
    setup: (self, map, scope) => {
      ensureRouteState()
      const internals = mapInternals(map)
      const guardHandles = scope.access === null
        ? []
        : scope.access.states.map((name) => useState(self, name))
      const names = stateNamesOf(scope)
      const namedHandles = names.map((name) => useState(self, name))
      const nav = computed(
        [routeState, lang, ...guardHandles, ...namedHandles],
        (route, _code, ...values) => {
          const guardValues = values.slice(0, guardHandles.length)
          const named = Object.fromEntries(
            names.map((name, index) => [name, values[guardHandles.length + index]]),
          )
          const verdicts = new Map()
          const verdictFor = (node) => {
            if (verdicts.has(node)) return verdicts.get(node)
            const chain = []
            for (let current = node; current.parent !== null; current = current.parent) {
              chain.unshift(current)
            }
            const needs = needsBetween(chain, null, node)
            const match = matchMap(map, route.path)
            const verdict = needs.length === 0 ? true : settledVerdict(
              scope.access,
              guardValues,
              needs,
              {
                params: match?.params ?? {},
                query: route.query,
                searchParams: route.searchParams,
                path: route.path,
              },
            )
            verdicts.set(node, verdict)
            return verdict
          }
          const derived = deriveNav(map, {
            path: route.path,
            allowed: (node) => verdictFor(node) === true,
            optionsOf: (node) => readOptions(scope, node, named),
            scope: scope.navScope,
          })
          const matched = matchMap(map, route.path)
          const verdict = matched === null ? true : verdictFor(matched.node)
          const waiting = verdict === wait
          const leaving = typeof verdict === 'string'
          return { ...derived, current: { ...derived.current, waiting, leaving } }
        },
      )
      nav.watch(self, ({ sections, current }) => {
        internals.feed.tree.set(sections)
        internals.feed.current.set(current)
        writeDescription(
          current.pattern === null ? undefined : nodeDescription(nodeOf(map, current.pattern)),
        )
        if (scope.title !== null) {
          document.title = String(
            scope.title({
              crumbs: current.crumbs.map((crumb) => crumb.label),
              node: current.pattern === null ? null : nodeOf(map, current.pattern).handle,
              params: current.params,
            }) ?? '',
          )
        }
      })
      logStubs(map, scope.screens)
      return renderRouter(scope)
    },
  })

const mapRouter = (map, scope) => {
  if (!mapRouterFactory) mapRouterFactory = defineMapRouter()
  return mapRouterFactory(map, scope)
}

const bindOptions = (map, options) => {
  const bound = new Map()
  if (options === undefined) return bound
  if (!isPlainObject(options)) {
    throw new Error(
      "imp: router({ options }) - options is an object keyed by param handles, like { [app.projects.$projectId]: 'acme.projects' }",
    )
  }
  for (const [key, source] of Object.entries(options)) {
    const node = nodeOf(map, key)
    if (node === null || !node.param) {
      throw new Error(
        `imp: router({ options }) - '${key}' is not a param node of the map; key options by handles like [app.projects.$projectId]`,
      )
    }
    if (typeof source === 'string') {
      const problem = stateNameProblem(source)
      if (problem) throw new Error(`imp: router({ options }) - '${key}': ${problem}`)
      bound.set(node, source)
    } else if (Array.isArray(source)) {
      bound.set(node, normalizeOptions(source, node))
    } else {
      throw new Error(
        `imp: router({ options }) - '${key}' must name a state that holds [{ value, label }], or list the options`,
      )
    }
  }
  return bound
}

const readScope = (map, scope) => {
  if (scope === undefined) return null
  const node = nodeOf(map, scope)
  if (node === null || !node.param) {
    throw new Error(
      'imp: router({ scope }) - scope is the param handle the app lives under, like scope: app.organizations.$org',
    )
  }
  return node
}

export const router = (options = {}) => {
  const { map, access, screens, loading, error, notFound, routes, scope, title } = options
  if (routes !== undefined) {
    throw new Error(
      'imp: router({ routes }) - the route table is the map: pass router({ map, screens }), with the app-map.js the app describes itself in',
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
  if (title !== undefined && typeof title !== 'function') {
    throw new Error(
      "imp: router({ title }) - title is a function of { crumbs, node, params } returning the document title, like ({ crumbs }) => [...crumbs].reverse().join(' - ')",
    )
  }
  if (map === undefined) {
    if (screens !== undefined || access !== undefined) {
      throw new Error("imp: router({ screens }) - needs the 'map' the screens bind to")
    }
    return areaRouter({ loading, error, notFound })
  }
  if (!isAppMap(map)) {
    throw new Error("imp: router({ map }) - 'map' must be the value appMap() returned")
  }
  const problem = wholeMapProblem(map)
  if (problem) throw new Error(`imp: router({ map }) - ${problem}`)
  if (access !== undefined && !isGuard(access)) {
    throw new Error(
      "imp: router({ access }) - access must be one guard(states, check); it receives the 'access' value of a node as need",
    )
  }
  const bound = bindScreens(map, null, screens ?? {}, 'router({ screens })')
  if (access === undefined) {
    const guarded = mapInternals(map).nodes.find((node) => node.access !== undefined)
    if (guarded) {
      throw new Error(
        `imp: router({ map }) - the map sets access on '${guarded.pattern}', so pass router({ access: guard(states, check) }) to decide it`,
      )
    }
  }
  return mapRouter(map, {
    map,
    node: null,
    screens: bound,
    access: access ?? null,
    optionsByNode: bindOptions(map, options.options),
    navScope: readScope(map, scope),
    title: title ?? null,
    options: routerOptions({ loading, error, notFound }, null),
  })
}

export const useRoute = () => {
  const state = ensureRouteState()
  return readableState(state.name, () => state, state.get)
}
