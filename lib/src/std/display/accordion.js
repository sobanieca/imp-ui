import { defineComponent } from '../shared/define.js'
import { div, el, span } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { bindText } from '../shared/args.js'
import { ownEvents } from '../shared/own-events.js'
import { itemId, normalizeItems } from '../shared/items.js'
import { focusRing, fontFamily, token } from '../shared/css.js'
import { icon } from '../general/icon.js'
import { luChevronDown } from '../../icons/lucide-icons.js'

const NAME = 'accordion'

const KNOWN_PROPS = ['items', 'multiple', 'events']

const TOGGLE_EVENT = 'toggle'

const EXCLUSIVE_GROUP = 'imp-accordion'

const styles = () => `
  :host {
    display: block;
  }

  .root {
    box-sizing: border-box;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    ${fontFamily()}
    color: ${token('color-text')};
    overflow: clip;
  }

  .item + .item {
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }

  .summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${token('space-3')};
    padding-block: ${token('space-3')};
    padding-inline: ${token('space-4')};
    font-size: ${token('font-size-md')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
    cursor: pointer;
    transition: background-color ${token('duration-fast')} ease-out;
  }

  .summary::-webkit-details-marker {
    display: none;
  }

  .summary:hover {
    background-color: ${token('color-surface-hover')};
  }

  .summary:focus-visible {
    ${focusRing()}
    outline-offset: calc(-1 * ${token('focus-ring-width')});
    border-radius: ${token('radius-item')};
  }

  .title {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  .chevron {
    display: inline-flex;
    flex: none;
    color: ${token('color-secondary')};
    transition: rotate ${token('duration-fast')} ease-out;
  }

  .item[open] .chevron {
    rotate: 180deg;
  }

  .content {
    padding-block: ${token('space-1')} ${token('space-4')};
    padding-inline: ${token('space-4')};
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-normal')};
  }

  @media (prefers-reduced-motion: reduce) {
    .summary, .chevron { transition: none }
  }

  @media (forced-colors: active) {
    .root, .item + .item { border-color: CanvasText }
  }
`

const normalizeSections = (items) =>
  normalizeItems(NAME, items, {
    shape: '{ id, title, content }',
    key: 'title',
    item: (entry, index) => ({
      id: itemId(entry, index),
      title: entry.title,
      content: entry.content,
      open: Boolean(entry.open),
    }),
  })

const closeAllButFirstOpen = (items) => {
  const firstOpen = items.findIndex(({ open }) => open)
  if (items.filter(({ open }) => open).length > 1) {
    impLogger.warn(`${NAME}: more than one item is 'open' - pass 'multiple: true' to keep them`)
  }
  return items.map((item, index) => ({ ...item, open: index === firstOpen }))
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass every section as 'items'`)
    }
    const multiple = Boolean(props.multiple)
    const normalized = normalizeSections(props.items ?? [])
    const items = multiple ? normalized : closeAllButFirstOpen(normalized)
    const root = div({ class: 'root', events: ownEvents(props.events, [TOGGLE_EVENT]) })

    const sections = items.map((item) => {
      const chevron = span({ class: 'chevron' }, icon(luChevronDown, { size: 'sm' }))
      const section = el(
        'details',
        { class: 'item' },
        el(
          'summary',
          { class: 'summary' },
          span({ class: 'title' }, bindText(self, item.title)),
          chevron,
        ),
        div({ class: 'content' }, item.content),
      )
      if (!multiple) section.setAttribute('name', EXCLUSIVE_GROUP)
      if (item.open) section.setAttribute('open', '')
      let reported = item.open
      section.addEventListener('toggle', () => {
        if (section.open === reported) return
        reported = section.open
        root.dispatchEvent(
          new CustomEvent(TOGGLE_EVENT, {
            bubbles: true,
            composed: true,
            detail: { id: item.id, open: section.open },
          }),
        )
      })
      return section
    })

    root.append(...sections)
    return root
  },
}

export const accordion = (...args) => defineComponent(NAME, () => definition)(...args)
