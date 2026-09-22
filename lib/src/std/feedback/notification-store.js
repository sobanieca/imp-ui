import { createState } from '../../state.js'
import { impLogger } from '../../logger.js'
import { isPlainObject } from '../../render.js'
import { oneOf } from '../shared/args.js'

const NAME = 'notify'

const STORE_NAME = 'imp.notifications'

const KINDS = ['info', 'success', 'warning', 'error']

const KNOWN_KEYS = [
  'id',
  'kind',
  'title',
  'description',
  'icon',
  'image',
  'link',
  'actions',
  'duration',
  'ttl',
]

const MAX_ACTIONS = 3

const LONGEST_TIMER = 2_147_483_647

export const STORE_DEFAULTS = Object.freeze({ ttl: 86_400_000, limit: 100 })

const settings = { ttl: STORE_DEFAULTS.ttl, limit: STORE_DEFAULTS.limit }

const answers = new Map()

const expiries = new Map()

let store = null

let generatedIds = 0

let openLists = 0

export const notificationStore = () => (store ??= createState(STORE_NAME, []))

export const isListed = (entry) => entry.ttl !== 0

const answerOf = (id) => {
  if (!answers.has(id)) answers.set(id, Promise.withResolvers())
  return answers.get(id).promise
}

const answer = (id, value) => {
  const waiting = answers.get(id)
  if (!waiting) return
  answers.delete(id)
  waiting.resolve(value)
}

const stopExpiry = (id) => {
  clearTimeout(expiries.get(id))
  expiries.delete(id)
}

const forget = (id) => {
  stopExpiry(id)
  answer(id, null)
}

const write = (entries) => {
  notificationStore().set(entries.slice(0, settings.limit))
  for (const dropped of entries.slice(settings.limit)) forget(dropped.id)
}

const patch = (id, changes) =>
  write(
    notificationStore().get().map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)),
  )

const find = (id) => notificationStore().get().find((entry) => entry.id === id) ?? null

const milliseconds = (key, value, fallback) => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  impLogger.warn(`${NAME}: '${key}' must be a number of milliseconds - got '${value}'`)
  return fallback
}

const textOf = (key, value) => {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  impLogger.warn(`${NAME}: '${key}' must be a string - got ${typeof value}`)
  return undefined
}

const iconOf = (icon) => {
  if (icon === undefined || icon === null) return undefined
  if (Array.isArray(icon)) return icon
  impLogger.warn(`${NAME}: 'icon' must be an icon from 'imp/icons' - using the icon of the kind`)
  return undefined
}

const linkOf = (link) => {
  if (link === undefined || link === null) return undefined
  if (isPlainObject(link) && typeof link.href === 'string' && typeof link.label === 'string') {
    return { href: link.href, label: link.label, external: Boolean(link.external) }
  }
  impLogger.warn(`${NAME}: 'link' must be { href, label, external? } - leaving the link out`)
  return undefined
}

const actionOf = ({ id, label, variant }) =>
  variant === undefined ? { id, label } : { id, label, variant }

const actionsOf = (actions) => {
  if (actions === undefined || actions === null) return undefined
  const valid = Array.isArray(actions) &&
    actions.every((action) =>
      isPlainObject(action) && typeof action.id === 'string' && typeof action.label === 'string'
    )
  if (!valid) {
    impLogger.warn(
      `${NAME}: 'actions' must be an array of { id, label, variant? } - leaving it out`,
    )
    return undefined
  }
  if (actions.length > MAX_ACTIONS) {
    impLogger.warn(`${NAME}: takes up to ${MAX_ACTIONS} actions - keeping the first ${MAX_ACTIONS}`)
  }
  return actions.length === 0 ? undefined : actions.slice(0, MAX_ACTIONS).map(actionOf)
}

const withoutAbsentKeys = (entry) =>
  Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined))

const entryFrom = (data, id) =>
  withoutAbsentKeys({
    id,
    kind: oneOf(NAME, 'kind', data.kind, KINDS, 'info'),
    title: data.title,
    description: textOf('description', data.description),
    icon: iconOf(data.icon),
    image: textOf('image', data.image),
    link: linkOf(data.link),
    actions: actionsOf(data.actions),
    duration: milliseconds('duration', data.duration, undefined),
    ttl: milliseconds('ttl', data.ttl, settings.ttl),
    time: new Date().toISOString(),
    read: false,
    choice: null,
    popup: true,
  })

const awayFromOpenList = (entry) =>
  openLists > 0 && isListed(entry) ? { ...entry, popup: false } : entry

const expireLater = (id, ttl) => {
  stopExpiry(id)
  if (ttl > 0) expiries.set(id, setTimeout(() => dismiss(id), Math.min(ttl, LONGEST_TIMER)))
}

const placed = (entries, entry) => {
  const listed = entries.find(({ id }) => id === entry.id)
  if (listed?.popup) return entries.map((current) => (current === listed ? entry : current))
  return [entry, ...entries.filter((current) => current !== listed)]
}

export const notify = (data) => {
  const given = isPlainObject(data) ? data : {}
  if (typeof given.title !== 'string' || given.title === '') {
    impLogger.warn(`${NAME}: needs a 'title' - raising nothing`)
    return Promise.resolve(null)
  }
  for (const key of Object.keys(given)) {
    if (!KNOWN_KEYS.includes(key)) impLogger.warn(`${NAME}: unknown key '${key}' - leaving it out`)
  }
  const id = given.id === undefined || given.id === null
    ? `imp-${++generatedIds}`
    : String(given.id)
  const entry = awayFromOpenList(entryFrom(given, id))
  const answered = answerOf(id)
  write(placed(notificationStore().get(), entry))
  if (find(id)) expireLater(id, entry.ttl)
  return answered
}

export const dismiss = (id) => {
  if (!find(id)) return
  write(notificationStore().get().filter((entry) => entry.id !== id))
  forget(id)
}

export const leaveCorner = (id, { read = false } = {}) => {
  const entry = find(id)
  if (!entry || !entry.popup) return
  if (!isListed(entry)) dismiss(id)
  else patch(id, read ? { popup: false, read: true } : { popup: false })
}

export const chooseAction = (id, actionId) => {
  const entry = find(id)
  if (!entry || entry.choice !== null) return
  answer(id, actionId)
  if (!isListed(entry)) dismiss(id)
  else patch(id, { choice: actionId, read: true, popup: false })
}

export const markAllRead = () =>
  write(notificationStore().get().map((entry) => (entry.read ? entry : { ...entry, read: true })))

export const listOpened = () => {
  openLists += 1
  write(
    notificationStore().get().map((entry) =>
      isListed(entry) && (entry.popup || !entry.read)
        ? { ...entry, popup: false, read: true }
        : entry
    ),
  )
}

export const listClosed = () => {
  openLists = Math.max(0, openLists - 1)
}

export const clearList = () => {
  const entries = notificationStore().get()
  write(entries.filter((entry) => !isListed(entry)))
  for (const entry of entries.filter(isListed)) forget(entry.id)
}

export const configureStore = ({ ttl, limit }) => {
  settings.ttl = ttl
  settings.limit = limit
  write(notificationStore().get())
}
