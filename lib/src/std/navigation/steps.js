import { defineComponent } from '../shared/define.js'
import { div, el, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindText, bindValue, oneOf } from '../shared/args.js'
import { ownEvents } from '../shared/own-events.js'
import { itemId, normalizeItems } from '../shared/items.js'
import { stepsStyles } from './steps-css.js'
import { icon } from '../general/icon.js'
import { luCheck, luX } from '../../icons/lucide-icons.js'

const NAME = 'steps'

const KNOWN_PROPS = ['items', 'current', 'orientation', 'label', 'events']

const ORIENTATIONS = ['horizontal', 'vertical']

const SELECT_EVENT = 'select'

const ERROR_STATUS = 'error'

const PHASES = ['done', 'current', 'upcoming']

const STATE_KEYS = {
  done: 'imp.steps.done',
  current: 'imp.steps.current',
  upcoming: 'imp.steps.upcoming',
  error: 'imp.steps.error',
}

const messages = {
  'imp.steps.done': 'Completed',
  'imp.steps.current': 'Current',
  'imp.steps.upcoming': 'Upcoming',
  'imp.steps.error': 'Error',
}

const normalizeSteps = (items) =>
  normalizeItems(NAME, items, {
    shape: '{ id, label, description }',
    item: (entry, index) => ({
      id: itemId(entry, index),
      label: entry.label,
      description: entry.description,
      status: entry.status,
    }),
  })

const warnDuplicateIds = (items) => {
  const seen = new Set()
  for (const { id } of items) {
    if (seen.has(id)) {
      impLogger.warn(
        `${NAME}: two items share the id '${id}' - ids must be unique within one steps()`,
      )
    }
    seen.add(id)
  }
}

const hasListener = (events, name) => {
  const entry = events?.[name]
  return typeof (Array.isArray(entry) ? entry[0] : entry) === 'function'
}

const phaseOf = (index, currentIndex) => {
  if (index < currentIndex) return 'done'
  return index === currentIndex ? 'current' : 'upcoming'
}

const isFailed = (status) => {
  if (status === undefined || status === null || status === '') return false
  if (status === ERROR_STATUS) return true
  impLogger.warn(`${NAME}: an item 'status' must be '${ERROR_STATUS}' - got '${status}'`)
  return false
}

const stepNodes = (self, item, index, interactive) => {
  const number = span({ class: 'number' }, String(index + 1))
  const check = icon(luCheck, { size: 'sm' })
  const cross = icon(luX, { size: 'sm' })
  const state = document.createTextNode('')
  const marker = span({ class: 'marker', 'aria-hidden': 'true' }, number, check, cross)
  const words = span(
    { class: 'words' },
    span({ class: 'label' }, bindText(self, item.label)),
    span({ class: 'state' }, state),
    item.description === undefined
      ? null
      : span({ class: 'description' }, bindText(self, item.description)),
  )
  const plain = div({ class: 'body' })
  const action = interactive ? el('button', { class: 'body', type: 'button' }) : null
  const step = el('li', { class: 'step' }, action, plain)
  return {
    ...item,
    index,
    failed: false,
    number,
    check,
    cross,
    state,
    marker,
    words,
    plain,
    action,
    step,
  }
}

const paintStep = (entry, phase) => {
  const { step, failed, number, check, cross, state, marker, words, plain, action } = entry
  for (const name of PHASES) step.classList.toggle(name, name === phase)
  step.classList.toggle(ERROR_STATUS, failed)
  if (phase === 'current') step.setAttribute('aria-current', 'step')
  else step.removeAttribute('aria-current')
  const done = phase === 'done'
  cross.hidden = !failed
  check.hidden = failed || !done
  number.hidden = failed || done
  state.data = t(STATE_KEYS[failed ? ERROR_STATUS : phase])
  const body = done && action !== null ? action : plain
  if (marker.parentNode !== body) body.append(marker, words)
  plain.hidden = body !== plain
  if (action !== null) action.hidden = body !== action
}

const definition = {
  styles: stepsStyles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass every step as 'items'`)
    }
    const orientation = oneOf(NAME, 'orientation', props.orientation, ORIENTATIONS, 'horizontal')
    const items = normalizeSteps(props.items ?? [])
    warnDuplicateIds(items)
    const interactive = hasListener(props.events, SELECT_EVENT)
    const entries = items.map((item, index) => stepNodes(self, item, index, interactive))
    const list = el(
      'ol',
      { class: ['list', orientation], role: 'list' },
      ...entries.map(({ step }) => step),
    )
    const root = div({ class: 'root', events: ownEvents(props.events, [SELECT_EVENT]) }, list)

    let currentIndex = 0
    const paint = () => {
      for (const entry of entries) paintStep(entry, phaseOf(entry.index, currentIndex))
    }

    for (const entry of entries) {
      entry.action?.addEventListener('click', () => {
        root.dispatchEvent(
          new CustomEvent(SELECT_EVENT, {
            bubbles: true,
            composed: true,
            detail: { id: entry.id, index: entry.index },
          }),
        )
      })
      bindValue(self, entry.status, (value) => {
        entry.failed = isFailed(value)
        paint()
      })
    }

    if (props.current !== undefined) {
      bindValue(self, props.current, (value) => {
        const index = entries.findIndex((entry) => entry.id === String(value))
        if (index === -1) {
          impLogger.warn(`${NAME}: 'current' is '${value}', which is not the id of any item`)
          return
        }
        currentIndex = index
        paint()
      })
    }

    if (props.label === undefined) {
      impLogger.warn(`${NAME}: needs a 'label' - it is the accessible name of the list`)
    } else {
      bindValue(self, props.label, (value) => list.setAttribute('aria-label', String(value)))
    }

    lang.watch(self, paint)
    return root
  },
}

export const steps = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
