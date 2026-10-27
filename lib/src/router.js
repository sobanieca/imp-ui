import { component, LOADING_MAY_BE_SKIPPED, pendingRendersIn, rendered } from './component.js'
import { endView, readyView, startView } from './analytics-bus.js'
import {
  computed,
  createState,
  provideGlobally,
  readableState,
  stateNameProblem,
  useState,
} from './state.js'
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
  isPrefixNode,
  nodeOf,
  paramsUpTo,
  wholeMapProblem,
} from './app-map.js'
import { emptyState } from './std/display/empty-state.js'

export { safeNext, url }

const ROUTE_STATE = 'imp.route'
const LABELS_STATE = 'imp.routeLabels'
const SETTLED_STATE = 'imp.router.settled'
const LAZY = Symbol('imp.areaLoader')
const AREA = Symbol('imp.area')
const AREA_KIND = 'area'
const AREA_SCOPE = 'imp.area'
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
    if (input.guards !== undefined) {
      throw new Error(
        'imp: area({ guards }) - guards bind at the router: router({ guards: { [app.admin]: { states, check } } }) covers the node the area binds to and every node under it, and decides it before the area downloads',
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

const GUARD_PROPS = ['states', 'check']

const readGuard = (key, value) => {
  const label = `imp: router({ guards }) - the guard at '${key}'`
  if (!isPlainObject(value)) {
    throw new Error(
      `${label} must be { states, check }, like { states: ['myapp.session'], check: (session, { node }) => session === undefined ? wait : true }`,
    )
  }
  const stray = Object.keys(value).find((prop) => !GUARD_PROPS.includes(prop))
  if (stray !== undefined) {
    throw new Error(`${label} has '${stray}' - a guard has only 'states' and 'check'`)
  }
  const { states, check } = value
  if (
    !Array.isArray(states)
    || states.length === 0
    || !states.every((name) => typeof name === 'string')
  ) {
    throw new Error(`${label} - 'states' must be a non-empty array of state names the check reads`)
  }
  for (const name of states) {
    const problem = stateNameProblem(name)
    if (problem) throw new Error(`${label} - ${problem}`)
  }
  if (typeof check !== 'function') {
    throw new Error(
      `${label} - 'check' must be a function receiving the state values and { node, params, query, searchParams, path }, returning true, wait, false, or a path to redirect to`,
    )
  }
  return { at: key, states, check }
}

const NO_GUARDS = Object.freeze({ byNode: new Map(), states: [] })

const bindGuards = (map, guards) => {
  if (guards === undefined) return NO_GUARDS
  if (!isPlainObject(guards)) {
    throw new Error(
      "imp: router({ guards }) - guards is an object keyed by handles of the map, like { [app]: signedIn, [app.admin]: role('admin') }",
    )
  }
  const byNode = new Map()
  for (const [key, value] of Object.entries(guards)) {
    const node = nodeOf(map, key)
    if (node === null) {
      throw new Error(
        key === 'undefined'
          ? "imp: router({ guards }) - a key is 'undefined', so a handle is mistyped; check every [app...] key against the map"
          : `imp: router({ guards }) - '${key}' is not a node of the map; key guards by handles like [app] and [app.admin]`,
      )
    }
    byNode.set(node, readGuard(key, value))
  }
  const states = [...new Set([...byNode.values()].flatMap((entry) => entry.states))]
  return { byNode, states }
}

const guardOf = (guards, node) => {
  for (let current = node; current !== null; current = current.parent) {
    if (guards.byNode.has(current)) return guards.byNode.get(current)
  }
  return null
}

const describeVerdict = (outcome) =>
  typeof outcome === 'string' ? `'${outcome}'` : String(outcome)

const normalizeVerdict = (entry, outcome) => {
  if (outcome === wait || outcome === false) return outcome
  if (outcome === true || outcome === undefined) return true
  if (typeof outcome === 'string' && outcome.startsWith('/')) return outcome
  throw new Error(
    `imp: the guard at '${entry.at}' returned ${describeVerdict(
      outcome,
    )} - a guard must return true to allow, wait while it cannot decide yet, false to render the not-found page, or a path starting with '/' to redirect to`,
  )
}

const verdictOf = (entry, handles, context) =>
  normalizeVerdict(
    entry,
    entry.check(...entry.states.map((name) => handles.get(name).get()), {
      ...context,
      path: routeState.get().path,
    }),
  )

let navigations = 0

const queueRedirect = (path) => {
  const queuedAt = navigations
  let cancelled = false
  queueMicrotask(() => {
    if (cancelled) return
    if (navigations !== queuedAt) {
      impLogger.debug(`a redirect to '${path}' is dropped - the app navigated before it ran`)
      return
    }
    redirectTo(path)
  })
  return () => {
    cancelled = true
  }
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
  return queueRedirect(path)
}

const enterVerdict = (verdict, render, context, options, onRedirect) => {
  if (verdict === true) {
    guardRedirects = 0
    return render()
  }
  if (verdict === false) {
    guardRedirects = 0
    impLogger.debug('a route guard denied the screen - rendering the not-found page')
    return options.notFound ? options.notFound(context) : null
  }
  onRedirect(redirectFromGuard(verdict))
  return null
}

const waitWarningTimer = (entry, isDecided) =>
  setTimeout(() => {
    if (isDecided()) return
    impLogger.warn(
      `the guard at '${entry.at}' is still waiting at '${routeState.get().path}' after ${GUARD_WAIT_WARNING_MS}ms - it keeps returning wait, so nothing has settled one of [${entry.states.join(
        ', ',
      )}]`,
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

const trackPageView = (self, page) => {
  const view = startView(page)
  pageViews.set(self, view)
  untilRemoved(self, () => endView(view))
}

// A screen whose guard allows it again before its redirect ran is a page after all.
const resumePageView = (self) => {
  const view = pageViews.get(self)
  if (view?.ended) trackPageView(self, view.page)
}

const runGuard = (entry, handles, context, options, self, render) => {
  let cancelRedirect = null
  const holdRedirect = (cancel) => {
    cancelRedirect = cancel
  }
  // Set while a redirect is queued for a screen that never rendered: the guard may allow it
  // before the redirect runs, and then the screen renders after all.
  let allowAfterRedirect = null
  const enter = (verdict) => {
    if (typeof verdict !== 'string') {
      return enterVerdict(verdict, render, context, options, holdRedirect)
    }
    dropPageView(self)
    enterVerdict(verdict, render, context, options, holdRedirect)
    return new Promise((resolve) => {
      allowAfterRedirect = () => resolve(true)
      untilRemoved(self, () => resolve(false))
    }).then((allowed) => (allowed ? render() : null))
  }
  if (entry === null) {
    guardRedirects = 0
    return render()
  }
  if (!self.host.isConnected) return null

  const first = verdictOf(entry, handles, context)
  let decided = first !== wait
  let settle = null
  const decision = decided
    ? null
    : new Promise((resolve) => {
        settle = resolve
      })
  const warning = decided ? null : waitWarningTimer(entry, () => decided)
  if (warning) untilRemoved(self, () => clearTimeout(warning))

  let attaching = true
  const reevaluate = () => {
    if (attaching) return
    const verdict = verdictOf(entry, handles, context)
    if (verdict === wait) return
    if (!decided) {
      decided = true
      clearTimeout(warning)
      settle(verdict)
      return
    }
    if (verdict === true) {
      guardRedirects = 0
      cancelRedirect?.()
      cancelRedirect = null
      if (allowAfterRedirect) {
        resumePageView(self)
        allowAfterRedirect()
        allowAfterRedirect = null
      }
      return
    }
    if (verdict === false) {
      impLogger.error(
        `the guard at '${entry.at}' returned false at '${routeState.get().path}' for a screen that is already showing - only a redirect can leave a mounted screen, so it stays; return a path instead`,
      )
      return
    }
    cancelRedirect?.()
    cancelRedirect = redirectFromGuard(verdict)
  }

  for (const name of new Set(entry.states)) handles.get(name).watch(self, reevaluate)
  attaching = false

  return decided ? enter(first) : decision.then(enter)
}

const guardedTarget = (entry, handles, factory, options) => (context, self) =>
  runGuard(entry, handles, context, options, self, () => factory(context, self))

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
    if (isAreaLoader(target)) {
      if (node.parent === null) {
        throw new Error(
          `imp: ${label} - the root '/' cannot be an area; bind area(() => import(...)) to a node under it, like [app.admin]`,
        )
      }
      bound.set(node, { kind: 'area', target })
    } else if (isRedirect(target)) {
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

let labelsState = null

let settledState = null

let leafCount = 0

const labelMaps = new Set()

const leafKey = (pattern, params) => JSON.stringify([pattern, params])

const paramsOnPath = (path) => {
  const params = {}
  for (const map of labelMaps) Object.assign(params, matchMap(map, path)?.params)
  return params
}

const keptLabels = (labels, before, after) =>
  Object.fromEntries(
    Object.entries(labels).filter(([key]) => {
      const name = key.slice(1)
      return after[name] !== undefined && before[name] === after[name]
    }),
  )

const dropStaleLabels = (fromPath, toPath) => {
  const labels = labelsState.get()
  if (Object.keys(labels).length === 0) return
  labelsState.set(keptLabels(labels, paramsOnPath(fromPath), paramsOnPath(toPath)))
}

const leafKeysOn = (path) =>
  [...labelMaps].map((map) => {
    const match = matchMap(map, path)
    return match === null ? null : leafKey(match.node.pattern, match.params)
  })

const syncFromLocation = () => {
  const next = currentRoute()
  const before = routeState.get().path
  if (JSON.stringify(leafKeysOn(before)) !== JSON.stringify(leafKeysOn(next.path))) {
    settledState.set(null)
  }
  dropStaleLabels(before, next.path)
  routeState.set(next)
}

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
  !traversalAllowed
  && leaveChecks.size > 0
  && index !== null
  && index !== historyIndex
  && !sameRoute(currentRoute(), routeState.get())

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
  navigations += 1
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
    } catch {
      /* history not writable - scroll restoration degrades to top-of-page */
    }
  }
  activeKey = currentHistoryKey()
}

const ensureRouteState = () => {
  if (routeState) return routeState
  routeState = createState(ROUTE_STATE, currentRoute())
  labelsState = createState(LABELS_STATE, {})
  settledState = createState(SETTLED_STATE, null)
  provideGlobally(labelsState)
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
  navigations += 1
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
      `imp: screenRegion(self, element, { effect }) - 'effect' must be one of ${SCREEN_EFFECTS.map(
        (name) => `'${name}'`,
      ).join(', ')}, got '${effect}'`,
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
  trackPageView(self, place.page)
  leafCount += 1
  const leaf = leafCount
  queueMicrotask(() =>
    screenRendered(self.host).then(() => {
      readyView(pageViews.get(self))
      if (leaf === leafCount) settledState.set({ key: place.key, leaf })
    }),
  )
}

const defineRoutePage = () =>
  component('imp-route', {
    [LOADING_MAY_BE_SKIPPED]: true,
    loading: (_factory, context, options) => (options?.loading ? options.loading(context) : null),
    error: (self, error, _factory, context, options, place) => {
      impLogger.error('a route failed to render', error)
      if (place?.area) {
        leafCount += 1
        settledState.set({ key: place.key, leaf: leafCount })
      }
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

const stubScreen =
  (node) =>
  ({ params }) =>
    emptyState({
      title: computed([lang, labelsState], (_code, labels) => nodeLabel(node, params, labels)),
      description:
        node.description === undefined ? undefined : computed([lang], () => nodeDescription(node)),
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
    const screens = bindScreens(scope.map, node, loaded.screens, `area at '${node.pattern}'`)
    for (const [inner, binding] of screens) {
      if (binding.kind === 'area') scope.areaNodes.add(inner)
    }
    const inner = {
      map: scope.map,
      node,
      screens,
      guards: scope.guards,
      handles: scope.handles,
      areaNodes: scope.areaNodes,
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
    const to =
      typeof binding.target === 'string' ? binding.target : fillPattern(binding.target, params)
    return { kind: 'redirect', node: leaf, to }
  }
  if (binding) return { kind: 'screen', node: leaf, binding }
  const first = leaf.children.find((child) => !child.param)
  if (first) return { kind: 'redirect', node: leaf, to: fillPattern(first, params) }
  if (isPrefixNode(leaf)) return null
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
    params:
      target.kind === 'area' ? paramsUpTo(match.chain, target.node, match.params) : match.params,
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
        ? routePage(
            scope.options.notFound,
            {
              params,
              query: current.query,
              searchParams: current.searchParams,
            },
            {
              ...scope.options,
              loading: null,
            },
            {
              page: null,
              path: current.path,
              area: false,
              key: match ? leafKey(match.node.pattern, match.params) : null,
            },
          )
        : null
    }
    const { match, target } = resolved
    if (target.kind === 'redirect') {
      guardRedirects = 0
      impLogger.debug(`'${current.path}' forwards to '${target.to}'`)
      queueRedirect(target.to)
      return null
    }
    const params =
      target.kind === 'area' ? paramsUpTo(match.chain, target.node, match.params) : match.params
    const context = {
      params,
      query: current.query,
      searchParams: current.searchParams,
      node: target.node.handle,
    }
    const entry = guardOf(scope.guards, target.node)
    const factory =
      target.kind === 'area'
        ? areaFactory(scope, target.node, target.binding)
        : target.kind === 'screen'
          ? target.binding.target
          : stubScreen(target.node)
    const mayWait = entry !== null || target.kind === 'area'
    return routePage(
      guardedTarget(entry, scope.handles, factory, scope.options),
      context,
      mayWait ? scope.options : { ...scope.options, loading: null },
      {
        page: target.node.pattern,
        path: current.path,
        area: target.kind === 'area',
        key: leafKey(match.node.pattern, match.params),
      },
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

const settledVerdict = (entry, handles, context) => {
  try {
    return verdictOf(entry, handles, context)
  } catch (error) {
    impLogger.error(
      `the guard at '${entry.at}' failed at '${context.path}' - hiding the node`,
      error,
    )
    return false
  }
}

const isPageNode = (screens, node) => {
  if (!isPrefixNode(node) || screens.has(node)) return true
  for (let current = node.parent; current !== null; current = current.parent) {
    if (screens.get(current)?.kind === 'area') return true
  }
  return false
}

const stubNodes = (map, screens) =>
  mapInternals(map).nodes.filter((node) => {
    if (screens.has(node)) return false
    if (node.children.some((child) => !child.param) || isPrefixNode(node)) return false
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

const warnedLabelKeys = new Set()

const warnAboutStrayLabels = (map, labels) => {
  if (globalThis.__IMP_DEV__ !== true) return
  const match = matchMap(map, routeState.get().path)
  const pattern = match?.node.pattern ?? routeState.get().path
  for (const key of Object.keys(labels)) {
    if (match !== null && match.params[key.slice(1)] !== undefined) continue
    const warning = `${key} ${pattern}`
    if (warnedLabelKeys.has(warning)) continue
    warnedLabelKeys.add(warning)
    impLogger.warn(
      `state '${LABELS_STATE}': '${key}' names no param of the route '${pattern}' - a key is the name of a param of the route with its $, like $teamId`,
    )
  }
}

const isSettled = (map, route, settled) => {
  if (settled === null || settled.leaf !== leafCount) return false
  const match = matchMap(map, route.path)
  return settled.key === (match === null ? null : leafKey(match.node.pattern, match.params))
}

const writeTitle = (scope, map, current) => {
  if (scope.title === null || !current.settled) return
  const title = String(
    scope.title({
      crumbs: current.crumbs.map((crumb) => crumb.label),
      node: current.pattern === null ? null : nodeOf(map, current.pattern).handle,
      params: current.params,
    }) ?? '',
  )
  if (document.title !== title) document.title = title
}

const defineMapRouter = () =>
  component('imp-router', {
    setup: (self, map, scope) => {
      ensureRouteState()
      labelMaps.add(map)
      untilRemoved(self, () => labelMaps.delete(map))
      const internals = mapInternals(map)
      const handles = new Map(scope.guards.states.map((name) => [name, useState(self, name)]))
      const routed = { ...scope, handles, areaNodes: areaNodesOf(scope.screens) }
      const nav = computed(
        [routeState, lang, labelsState, settledState, ...handles.values()],
        (route, _code, labels, settled) => {
          const match = matchMap(map, route.path)
          const checks = new Map()
          const checkAt = (node) => {
            if (checks.has(node)) return checks.get(node)
            const entry = guardOf(scope.guards, node)
            const verdict =
              entry === null
                ? true
                : settledVerdict(entry, handles, {
                    node: node.handle,
                    params:
                      match !== null && match.chain.includes(node)
                        ? paramsUpTo(match.chain, node, match.params)
                        : {},
                    query: route.query,
                    searchParams: route.searchParams,
                    path: route.path,
                  })
            checks.set(node, verdict)
            return verdict
          }
          const verdicts = new Map()
          const verdictFor = (node) => {
            if (verdicts.has(node)) return verdicts.get(node)
            const checkpoints = []
            for (let current = node; current.parent !== null; current = current.parent) {
              if (current !== node && routed.areaNodes.has(current)) checkpoints.unshift(current)
            }
            checkpoints.push(node)
            let verdict = true
            for (const checkpoint of checkpoints) {
              verdict = checkAt(checkpoint)
              if (verdict !== true) break
            }
            verdicts.set(node, verdict)
            return verdict
          }
          const derived = deriveNav(map, {
            path: route.path,
            allowed: (node) => verdictFor(node) === true,
            labels,
            settled: isSettled(map, route, settled),
            scope: scope.navScope,
            isPage: (node) => isPageNode(scope.screens, node),
            ownsPage: (node) => scope.screens.get(node)?.kind === 'screen',
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
        writeTitle(scope, map, current)
      })
      labelsState.watch(self, (labels) => warnAboutStrayLabels(map, labels))
      logStubs(map, scope.screens)
      return renderRouter(routed)
    },
  })

const mapRouter = (map, scope) => {
  if (!mapRouterFactory) mapRouterFactory = defineMapRouter()
  return mapRouterFactory(map, scope)
}

const areaNodesOf = (screens) =>
  new Set([...screens].filter(([, binding]) => binding.kind === 'area').map(([node]) => node))

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

const ROUTER_OPTIONS = [
  'map',
  'screens',
  'guards',
  'scope',
  'title',
  'loading',
  'error',
  'notFound',
  'routes',
]

export const router = (options = {}) => {
  const { map, guards, screens, loading, error, notFound, routes, scope, title } = options
  const stray = Object.keys(options).find((key) => !ROUTER_OPTIONS.includes(key))
  if (stray !== undefined) {
    throw new Error(
      `imp: router({ ${stray} }) - '${stray}' is not an option of the router; it takes ${ROUTER_OPTIONS.filter(
        (key) => key !== 'routes',
      ).join(', ')}`,
    )
  }
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
    if (screens !== undefined || guards !== undefined) {
      throw new Error("imp: router({ screens }) - needs the 'map' the screens bind to")
    }
    return areaRouter({ loading, error, notFound })
  }
  if (!isAppMap(map)) {
    throw new Error("imp: router({ map }) - 'map' must be the value appMap() returned")
  }
  const problem = wholeMapProblem(map)
  if (problem) throw new Error(`imp: router({ map }) - ${problem}`)
  const bound = bindScreens(map, null, screens ?? {}, 'router({ screens })')
  const boundGuards = bindGuards(map, guards)
  return mapRouter(map, {
    map,
    node: null,
    screens: bound,
    guards: boundGuards,
    navScope: readScope(map, scope),
    title: title ?? null,
    options: routerOptions({ loading, error, notFound }, null),
  })
}

export const useRoute = () => {
  const state = ensureRouteState()
  return readableState(state.name, () => state, state.get)
}
