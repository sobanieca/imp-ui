import { impLogger } from './logger.js'

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const analyticsNameProblem = (name, subject) =>
  typeof name === 'string' && KEBAB_CASE.test(name)
    ? null
    : `${subject} name ${
      typeof name === 'string' ? `'${name}'` : String(name)
    } must be kebab case, like 'invoice-sent'`

export const analyticsBus = {
  collector: null,
  zones: new Set(),
  view: null,
  previousPage: null,
  entryPending: true,
  navigationStart: null,
}

const now = () => globalThis.performance.now()

export const markNavigationStart = () => {
  const mark = { at: now() }
  analyticsBus.navigationStart ??= mark
  return mark
}

export const clearNavigationStart = (mark) => {
  if (analyticsBus.navigationStart === mark) analyticsBus.navigationStart = null
}

export const endView = (view) => {
  if (view.ended) return
  view.ended = true
  if (analyticsBus.view === view) analyticsBus.view = null
  analyticsBus.entryPending = false
  analyticsBus.previousPage = view.page
  analyticsBus.collector?.viewEnded(view)
}

export const startView = (page, path) => {
  const bus = analyticsBus
  if (bus.view) endView(bus.view)
  const startedAt = bus.entryPending ? 0 : bus.navigationStart?.at ?? now()
  bus.navigationStart = null
  const view = {
    page,
    path,
    from: bus.previousPage,
    startedAt,
    readyMs: undefined,
    ended: false,
  }
  bus.view = view
  bus.collector?.viewStarted(view)
  return view
}

export const readyView = (view) => {
  if (view.ended || view.readyMs !== undefined) return
  view.readyMs = Math.round(now() - view.startedAt)
  analyticsBus.entryPending = false
  analyticsBus.collector?.viewReady(view)
}

export const dropView = (view) => {
  if (view.ended) return
  view.ended = true
  if (analyticsBus.view === view) analyticsBus.view = null
  analyticsBus.navigationStart = { at: view.startedAt }
  analyticsBus.collector?.viewDropped(view)
}

export const reportError = (source, error) => {
  analyticsBus.collector?.error(source, error)
}

export const reportRequestFailure = (failure) => {
  analyticsBus.collector?.requestFailed(failure)
}

export const zoneConnected = (zone) => {
  analyticsBus.zones.add(zone)
  analyticsBus.collector?.zoneConnected(zone)
}

export const zoneDisconnected = (zone) => {
  analyticsBus.zones.delete(zone)
  analyticsBus.collector?.zoneDisconnected(zone)
}

export const track = (name, value) => {
  const problem = analyticsNameProblem(name, 'track()')
  if (problem) {
    impLogger.error(`${problem} - the action is dropped`)
    return
  }
  if (value !== undefined && typeof value !== 'string' && typeof value !== 'number') {
    impLogger.error(
      `track('${name}', value) - value must be a string or a number that names a fixed choice, like 'invalid' - the action is dropped`,
    )
    return
  }
  analyticsBus.collector?.action(name, value)
}
