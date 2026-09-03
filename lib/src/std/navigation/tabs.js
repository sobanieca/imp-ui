import { defineComponent } from '../shared/define.js'
import { div, el } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { bindText, bindValue, oneOf } from '../shared/args.js'
import { focusRing, fontFamily, forcedColors, hiddenRule, token } from '../shared/css.js'

const NAME = 'tabs'

const ORIENTATIONS = ['horizontal', 'vertical']

const KNOWN_PROPS = ['items', 'selected', 'orientation', 'label', 'events']

const SELECT_EVENT = 'select'

const styles = () => `
  ${hiddenRule}

  .root {
    display: flex;
    flex-direction: column;
    ${fontFamily()}
    min-inline-size: 0;
  }

  .root.vertical {
    flex-direction: row;
    gap: ${token('space-4')};
  }

  .tablist {
    display: flex;
    gap: ${token('space-1')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
  }

  .vertical .tablist {
    flex-direction: column;
    flex-shrink: 0;
    border-block-end: none;
    border-inline-end: ${token('border-width')} solid ${token('color-border')};
  }

  .tab {
    margin: 0;
    border: none;
    border-block-end: ${token('focus-ring-width')} solid transparent;
    border-radius: ${token('radius-item')} ${token('radius-item')} 0 0;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    background-color: transparent;
    color: ${token('color-secondary')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-medium')};
    line-height: ${token('line-height-tight')};
    white-space: nowrap;
    cursor: pointer;
    transition:
      color ${token('duration-fast')} ease-out,
      border-color ${token('duration-fast')} ease-out,
      background-color ${token('duration-fast')} ease-out;
  }

  .vertical .tab {
    border-block-end: none;
    border-inline-end: ${token('focus-ring-width')} solid transparent;
    border-radius: ${token('radius-item')} 0 0 ${token('radius-item')};
    text-align: start;
  }

  .tab:hover:not(:disabled) {
    background-color: ${token('color-surface-hover')};
    color: ${token('color-text')};
  }

  .tab:focus-visible {${focusRing()}}

  .tab:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .tab[aria-selected='true'] {
    border-color: ${token('color-primary')};
    color: ${token('color-primary')};
  }

  .panels {
    flex: 1;
    min-inline-size: 0;
  }

  .panel {
    padding-block-start: ${token('space-3')};
    color: ${token('color-text')};
  }

  .vertical .panel {
    padding-block-start: 0;
  }

  .panel:focus-visible {${focusRing()}}

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
    impLogger.warn(`${NAME}: 'items' must be an array of { id, label, content }`)
    return []
  }
  return items.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || entry.label === undefined) {
      impLogger.warn(`${NAME}: an item is not an object with a 'label' - skipping it`)
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
      impLogger.warn(
        `${NAME}: two items share the id '${id}' - ids must be unique within one tabs()`,
      )
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
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass every panel as 'items'`)
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
        bindText(self, item.label),
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
      bindValue(self, props.selected, (value) => {
        const index = indexOfId(value)
        if (index === -1) {
          impLogger.warn(`${NAME}: 'selected' is '${value}', which is not the id of any item`)
          return
        }
        selectAt(index, { notify: false })
      })
    }
    paint()

    if (props.label !== undefined) {
      bindValue(self, props.label, (value) => tablist.setAttribute('aria-label', String(value)))
    }
    return root
  },
}

export const tabs = (...args) => defineComponent(NAME, () => definition)(...args)
