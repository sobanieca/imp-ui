import { impLogger } from './logger.js'
import { namespacedNameProblem } from './provide.js'

const ANALYTICS_NAME = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/

const MAX_ANALYTICS_NAME_LENGTH = 128

export const analyticsNameProblem = (name, subject, example) => {
  const label = `${subject} name`
  const problem = namespacedNameProblem(name, label, example)
  if (problem) return problem
  if (name.length > MAX_ANALYTICS_NAME_LENGTH || !ANALYTICS_NAME.test(name)) {
    return `${label} '${name}' must use only ASCII letters, digits, '-' and '_' between the dots, up to ${MAX_ANALYTICS_NAME_LENGTH} characters, like '${example}'`
  }
  return null
}

export const analyticsBus = {
  collector: null,
  zones: new Set(),
  view: null,
}

export const endView = (view) => {
  if (view.ended) return
  view.ended = true
  if (analyticsBus.view === view) analyticsBus.view = null
  analyticsBus.collector?.viewEnded(view)
}

export const startView = (page) => {
  if (analyticsBus.view) endView(analyticsBus.view)
  const view = { page, ready: false, ended: false }
  analyticsBus.view = view
  analyticsBus.collector?.viewStarted(view)
  return view
}

export const readyView = (view) => {
  if (view.ended || view.ready) return
  view.ready = true
  analyticsBus.collector?.viewReady(view)
}

export const reportError = () => {
  analyticsBus.collector?.error()
}

export const zoneConnected = (zone) => {
  analyticsBus.zones.add(zone)
  analyticsBus.collector?.zoneConnected(zone)
}

export const zoneDisconnected = (zone) => {
  analyticsBus.zones.delete(zone)
  analyticsBus.collector?.zoneDisconnected(zone)
}

export const track = (...args) => {
  if (args.length !== 1) {
    throw new Error(
      "imp: track(name) takes a name only, like track('myapp.invoice-sent') - put a different outcome under its own name",
    )
  }
  const [name] = args
  const problem = analyticsNameProblem(name, 'outcome', 'myapp.invoice-sent')
  if (problem) {
    impLogger.error(`${problem} - the outcome is dropped`)
    return
  }
  analyticsBus.collector?.outcome(name)
}
