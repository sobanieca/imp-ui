import { defineComponent } from '../shared/define.js'
import { a, div, el, li, p, span } from '../../api/html.js'
import { defaultMessages, lang } from '../../api/i18n.js'
import { url } from '../../location.js'
import { impLogger } from '../../logger.js'
import { paletteNames } from '../../theme-colors.js'
import { bindValue } from '../shared/args.js'
import { focusRing, fontFamily, hiddenRule, token } from '../shared/css.js'
import { formatLocal } from '../shared/dates.js'
import { createKeyedRows } from '../shared/keyed-rows.js'
import { followHref, isSafeLink, onPlainClick, safeHref } from '../shared/links.js'
import {
  createLoadMore,
  LOAD_MORE_PROPS,
  loadMoreMessages,
  loadMoreStyles,
} from '../shared/load-more.js'
import { ownEvents } from '../shared/own-events.js'
import { emptyNode } from '../shared/empty.js'
import { icon } from '../general/icon.js'
import { activeLocale } from './locale.js'

const NAME = 'timeline'

const KNOWN_PROPS = ['label', 'items', 'actions', ...LOAD_MORE_PROPS, 'empty', 'events']

const SELECT_EVENT = 'select'

const NEUTRAL = 'neutral'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

let colors = null

const colorNames = () => (colors ??= [NEUTRAL, ...paletteNames()])

const colorToken = (name) => token(name === NEUTRAL ? 'color-secondary' : `color-${name}`)

const colorRules = () =>
  colorNames()
    .map((name) => `  .color-${name} { --timeline-color: ${colorToken(name)} }`)
    .join('\n')

const styles = () => `
  ${hiddenRule}

  :host {
    display: block;
    min-inline-size: 0;
  }

  .root {
    ${fontFamily()}
    color: ${token('color-text')};
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .event {
    --timeline-marker: 1.75rem;
    position: relative;
    display: grid;
    grid-template-columns: var(--timeline-marker) minmax(0, 1fr) auto;
    column-gap: ${token('space-3')};
    padding-block-end: ${token('space-4')};
  }

  .event:last-child {
    padding-block-end: 0;
  }

  .event::before {
    position: absolute;
    inset-block: var(--timeline-marker) 0;
    inset-inline-start: calc(var(--timeline-marker) / 2 - ${token('border-width')} / 2);
    inline-size: ${token('border-width')};
    background-color: ${token('color-border')};
    content: '';
  }

  .event:last-child::before {
    display: none;
  }

${colorRules()}

  .marker {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    inline-size: var(--timeline-marker);
    block-size: var(--timeline-marker);
    border: ${token('border-width')} solid var(--timeline-color);
    border-radius: 50%;
    background-color: color-mix(in oklab, var(--timeline-color) 14%, ${token('color-surface')});
    color: var(--timeline-color);
  }

  .dot {
    inline-size: 0.625rem;
    block-size: 0.625rem;
    border-radius: 50%;
    background-color: var(--timeline-color);
  }

  .words {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: ${token('space-1')};
    min-inline-size: 0;
    padding-block-start: 0.125rem;
  }

  time {
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    font-variant-numeric: tabular-nums;
  }

  .title {
    max-inline-size: 100%;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: ${token('radius-item')};
    background: none;
    color: ${token('color-text')};
    font: inherit;
    font-size: ${token('font-size-md')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
    text-align: start;
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  a.title,
  button.title {
    cursor: pointer;
  }

  a.title:hover,
  button.title:hover {
    color: ${token('color-primary')};
    text-decoration: underline;
  }

  .title:focus-visible {${focusRing()}}

  .description {
    margin: 0;
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    align-items: flex-start;
    gap: ${token('space-2')};
  }

  ${loadMoreStyles()}

  @media (forced-colors: active) {
    .marker {
      border-color: CanvasText;
      background-color: Canvas;
      color: CanvasText;
    }

    .dot,
    .event::before {
      background-color: CanvasText;
    }

    a.title:hover,
    button.title:hover {
      color: LinkText;
    }
  }
`

const hasValue = (value) => value !== undefined && value !== null

const hasHref = (item) => typeof item.href === 'string' && item.href !== '' && isSafeLink(item.href)

const iconNode = (value) =>
  typeof value.nodeType === 'number' ? value : icon(value, { size: 'sm' })

const colorOf = (item) => {
  if (!hasValue(item.color)) return NEUTRAL
  if (colorNames().includes(item.color)) return item.color
  impLogger.warn(
    `${NAME}: item '${item.id}' has the color '${item.color}' - use '${NEUTRAL}' or a palette name`,
  )
  return NEUTRAL
}

const timeOf = (item) => {
  if (!hasValue(item.time)) return null
  const dateOnly = typeof item.time === 'string' && DATE_ONLY.test(item.time)
  const date = new Date(item.time)
  if (Number.isNaN(date.getTime())) {
    impLogger.warn(`${NAME}: item '${item.id}' has the time '${item.time}', which is not a date`)
    return null
  }
  return { date, dateOnly }
}

const DATE_FORMAT = { dateStyle: 'medium', timeZone: 'UTC' }

const DATE_TIME_FORMAT = { dateStyle: 'medium', timeStyle: 'short' }

const formatTime = ({ date, dateOnly }) =>
  formatLocal(date, dateOnly ? DATE_FORMAT : DATE_TIME_FORMAT, activeLocale())

const timeNode = (moment) =>
  el(
    'time',
    {
      datetime: moment.dateOnly
        ? moment.date.toISOString().slice(0, 10)
        : moment.date.toISOString(),
    },
    formatTime(moment),
  )

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass every event in 'items'`)
    }
    if (props.label === undefined) {
      impLogger.warn(`${NAME}: pass a 'label' - it names the timeline for a screen reader`)
    }
    if (props.actions !== undefined && typeof props.actions !== 'function') {
      impLogger.warn(`${NAME}: 'actions' must be a function (item) => content - ignoring it`)
    }
    const actionsOf = typeof props.actions === 'function' ? props.actions : null
    const selectable =
      typeof props.events?.[SELECT_EVENT] === 'function'
      || Array.isArray(props.events?.[SELECT_EVENT])
    const keyed = createKeyedRows(NAME, 'id')
    const times = new Map()
    let moreItemsExist = false
    let shownCount = 0

    const activate = (item) => {
      const followed = root.dispatchEvent(
        new CustomEvent(SELECT_EVENT, {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { id: item.id, item },
        }),
      )
      if (followed && hasHref(item)) followHref(item.href)
    }

    const titleNode = (item) => {
      const text = String(item.title ?? '')
      const href = safeHref(NAME, item.href)
      if (href !== null) {
        return onPlainClick(a({ class: 'title', href: url(href) }, text), () => activate(item))
      }
      if (!selectable) return span({ class: 'title' }, text)
      return el(
        'button',
        { class: 'title', type: 'button', events: { click: () => activate(item) } },
        text,
      )
    }

    const markerNode = (item) =>
      span(
        { class: ['marker', `color-${colorOf(item)}`], 'aria-hidden': 'true' },
        hasValue(item.icon) ? iconNode(item.icon) : span({ class: 'dot' }),
      )

    const renderTime = (key, item) => {
      const moment = timeOf(item)
      if (moment === null) {
        times.delete(key)
        return null
      }
      const node = timeNode(moment)
      times.set(key, { node, moment })
      return node
    }

    const renderRow = (key, item) =>
      li(
        { class: ['event', `color-${colorOf(item)}`] },
        markerNode(item),
        div(
          { class: 'words' },
          renderTime(key, item),
          titleNode(item),
          hasValue(item.description) ? p({ class: 'description' }, String(item.description)) : null,
        ),
        actionsOf === null ? null : div({ class: 'actions' }, actionsOf(item)),
      )

    const events = el('ol', { class: 'events', role: 'list' }, keyed.region(renderRow))
    const empty = div({ class: 'empty', hidden: true })
    const root = div(
      { class: 'root', events: ownEvents(props.events, [SELECT_EVENT]) },
      events,
      empty,
    )

    const paintEmpty = () => {
      const isEmpty = shownCount === 0 && !moreItemsExist
      empty.hidden = !isEmpty
      if (isEmpty && empty.childNodes.length === 0) {
        empty.append(emptyNode(NAME, 'empty', props.empty, 'empty'))
      }
    }

    const paintTimes = () => {
      for (const { node, moment } of times.values()) node.textContent = formatTime(moment)
    }

    if (props.label !== undefined) {
      bindValue(self, props.label, (value) => events.setAttribute('aria-label', String(value)))
    }
    const loadMore = createLoadMore(self, NAME, props, events)
    if (loadMore !== null) {
      events.after(loadMore)
      bindValue(self, props.hasMore, (value) => {
        moreItemsExist = Boolean(value)
        paintEmpty()
      })
    }
    bindValue(self, props.items, (value) => {
      const items = keyed.take(value)
      const kept = new Set(items.map((item) => item.id))
      for (const key of times.keys()) {
        if (!kept.has(key)) times.delete(key)
      }
      shownCount = items.length
      keyed.show(items)
      paintEmpty()
    })
    lang.watch(self, paintTimes)
    return root
  },
}

export const timeline = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(loadMoreMessages),
  )(...args)
