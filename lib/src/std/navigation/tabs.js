import { component } from '../../component.js'
import { div, el } from '../../api/html.js'
import { createLogger } from '../../logger.js'
import { bindText, bindValue, oneOf, splitArgs, warnUnknownProps } from '../shared/args.js'
import { focusRing, fontFamily, forcedColors, hiddenRule } from '../shared/css.js'

const log = createLogger('imp')

const NAME = 'tabs'

const ORIENTATIONS = ['horizontal', 'vertical']

const KNOWN_PROPS = ['items', 'selected', 'orientation', 'label', 'events']

const SELECT_EVENT = 'select'

const styles = `
  ${hiddenRule}

  .root {
    display: flex;
    flex-direction: column;
    ${fontFamily}
    min-inline-size: 0;
  }

  .root.vertical {
    flex-direction: row;
    gap: var(--imp-space-4, 16px);
  }

  .tablist {
    display: flex;
    gap: var(--imp-space-1, 4px);
    border-block-end: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
  }

  .vertical .tablist {
    flex-direction: column;
    flex-shrink: 0;
    border-block-end: none;
    border-inline-end: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
  }

  .tab {
    margin: 0;
    border: none;
    border-block-end: var(--imp-focus-ring-width, 2px) solid transparent;
    border-radius: var(--imp-radius-sm, 4px) var(--imp-radius-sm, 4px) 0 0;
    padding-block: var(--imp-space-2, 8px);
    padding-inline: var(--imp-space-3, 12px);
    background-color: transparent;
    color: var(--imp-color-secondary, #64748b);
    ${fontFamily}
    font-size: var(--imp-font-size-sm, 0.875rem);
    font-weight: var(--imp-font-weight-medium, 500);
    line-height: var(--imp-line-height-tight, 1.25);
    white-space: nowrap;
    cursor: pointer;
    transition:
      color var(--imp-duration-fast, 120ms) ease-out,
      border-color var(--imp-duration-fast, 120ms) ease-out,
      background-color var(--imp-duration-fast, 120ms) ease-out;
  }

  .vertical .tab {
    border-block-end: none;
    border-inline-end: var(--imp-focus-ring-width, 2px) solid transparent;
    border-radius: var(--imp-radius-sm, 4px) 0 0 var(--imp-radius-sm, 4px);
    text-align: start;
  }

  .tab:hover:not(:disabled) {
    background-color: var(--imp-color-surface-hover, #f1f5f9);
    color: var(--imp-color-text, #0f172a);
  }

  .tab:focus-visible {${focusRing}}

  .tab:disabled {
    cursor: not-allowed;
    opacity: var(--imp-disabled-opacity, 0.55);
  }

  .tab[aria-selected='true'] {
    border-color: var(--imp-color-primary, #2563eb);
    color: var(--imp-color-primary, #2563eb);
  }

  .panels {
    flex: 1;
    min-inline-size: 0;
  }

  .panel {
    padding-block-start: var(--imp-space-3, 12px);
    color: var(--imp-color-text, #0f172a);
  }

  .vertical .panel {
    padding-block-start: 0;
  }

  .panel:focus-visible {${focusRing}}

  @media (prefers-reduced-motion: reduce) {
    .tab { transition: none }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .tab[aria-selected='true'] {
      border-color: Highlight;
      color: Highlight;
    }
  }
`

const normalizeItems = (items) => {
  if (!Array.isArray(items)) {
    log.warn(`${NAME}: 'items' must be an array of { id, label, content }`)
    return []
  }
  return items.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || entry.label === undefined) {
      log.warn(`${NAME}: an item is not an object with a 'label' — skipping it`)
      return []
    }
    return [{
      id: entry.id === undefined ? String(index) : String(entry.id),
      label: entry.label,
      content: entry.content,
      disabled: Boolean(entry.disabled),
    }]
  })
}

const warnDuplicateIds = (items) => {
  const seen = new Set()
  for (const { id } of items) {
    if (seen.has(id)) {
      log.warn(`${NAME}: two items share the id '${id}' — ids must be unique within one tabs()`)
    }
    seen.add(id)
  }
}

const isHorizontalBack = (key, element) => {
  const rightToLeft = getComputedStyle(element).direction === 'rtl'
  return key === (rightToLeft ? 'ArrowRight' : 'ArrowLeft')
}

const isHorizontalForward = (key, element) => {
  const rightToLeft = getComputedStyle(element).direction === 'rtl'
  return key === (rightToLeft ? 'ArrowLeft' : 'ArrowRight')
}

const definition = {
  styles,
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs(NAME, args)
    warnUnknownProps(NAME, props, KNOWN_PROPS)
    if (children.length > 0) {
      log.warn(`${NAME}: takes no content — pass every panel as 'items'`)
    }
    const orientation = oneOf(NAME, 'orientation', props.orientation, ORIENTATIONS, 'horizontal')
    const items = normalizeItems(props.items ?? [])
    warnDuplicateIds(items)

    const tablist = div({
      class: 'tablist',
      role: 'tablist',
      'aria-orientation': orientation,
    })
    const panelsBox = div({ class: 'panels' })
    const root = div(
      { class: ['root', orientation], events: props.events },
      tablist,
      panelsBox,
    )

    const entries = items.map((item, index) => {
      const tabId = `tab-${index}`
      const panelId = `panel-${index}`
      const tab = el(
        'button',
        {
          class: 'tab',
          id: tabId,
          type: 'button',
          role: 'tab',
          'aria-controls': panelId,
          'aria-selected': 'false',
          tabindex: '-1',
          disabled: item.disabled,
          events: { click: () => selectAt(index, { focus: true }) },
        },
        bindText(item.label),
      )
      const panel = div(
        {
          class: 'panel',
          id: panelId,
          role: 'tabpanel',
          tabindex: '0',
          'aria-labelledby': tabId,
          hidden: true,
        },
        item.content,
      )
      return { ...item, tab, panel, index }
    })

    tablist.append(...entries.map(({ tab }) => tab))
    panelsBox.append(...entries.map(({ panel }) => panel))

    const firstSelectable = entries.find(({ disabled }) => !disabled) ?? entries[0] ?? null
    let selectedIndex = firstSelectable ? firstSelectable.index : -1

    const paint = () => {
      for (const { tab, panel, index } of entries) {
        const isSelected = index === selectedIndex
        tab.setAttribute('aria-selected', String(isSelected))
        tab.tabIndex = isSelected ? 0 : -1
        panel.hidden = !isSelected
      }
    }

    const indexOfId = (id) => entries.findIndex((entry) => entry.id === String(id))

    function selectAt(index, { focus = false, notify = true } = {}) {
      const entry = entries[index]
      if (!entry || entry.disabled || index === selectedIndex) {
        if (entry && focus && index === selectedIndex) entry.tab.focus()
        return
      }
      selectedIndex = index
      paint()
      if (focus) entry.tab.focus()
      if (notify) {
        root.dispatchEvent(
          new CustomEvent(SELECT_EVENT, {
            bubbles: true,
            composed: true,
            detail: { id: entry.id, index },
          }),
        )
      }
    }

    const step = (from, direction) => {
      if (entries.length === 0) return
      let cursor = from
      for (let attempt = 0; attempt < entries.length; attempt++) {
        cursor = (cursor + direction + entries.length) % entries.length
        if (!entries[cursor].disabled) return selectAt(cursor, { focus: true })
      }
    }

    const edge = (direction) => {
      const order = direction === 1 ? entries : [...entries].reverse()
      const target = order.find(({ disabled }) => !disabled)
      if (target) selectAt(target.index, { focus: true })
    }

    tablist.addEventListener('keydown', (event) => {
      const from = selectedIndex === -1 ? 0 : selectedIndex
      const vertical = orientation === 'vertical'
      const forward = vertical ? event.key === 'ArrowDown' : isHorizontalForward(event.key, tablist)
      const back = vertical ? event.key === 'ArrowUp' : isHorizontalBack(event.key, tablist)
      if (forward) step(from, 1)
      else if (back) step(from, -1)
      else if (event.key === 'Home') edge(1)
      else if (event.key === 'End') edge(-1)
      else return
      event.preventDefault()
    })

    if (props.selected !== undefined) {
      bindValue(props.selected, (value) => {
        const index = indexOfId(value)
        if (index === -1) {
          log.warn(`${NAME}: 'selected' is '${value}', which is not the id of any item`)
          return
        }
        selectAt(index, { notify: false })
      })
    }
    paint()

    if (props.label !== undefined) {
      bindValue(props.label, (value) => tablist.setAttribute('aria-label', String(value)))
    }
    return root
  },
}

let create = null

export const tabs = (...args) => {
  create ??= component('imp-tabs', definition)
  return create(...args)
}
