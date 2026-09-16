import { defineComponent } from '../shared/define.js'
import { div, el, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { createState } from '../../state.js'
import { bindContent, bindText, bindValue, oneOf } from '../shared/args.js'
import { ownEvents } from '../shared/own-events.js'
import { anchoredStyles } from '../shared/anchored.js'
import { chevronDownIcon, moreIcon } from '../shared/icons.js'
import { button, VARIANTS } from './button.js'
import {
  focusRing,
  fontFamily,
  forcedColors,
  groupableSeam,
  groupSeamRules,
  hiddenRule,
  sizeRules,
  SIZES,
  token,
} from '../shared/css.js'

const NAME = 'buttonGroup'

const KNOWN_PROPS = ['items', 'trigger', 'variant', 'size', 'disabled', 'label', 'events']

const TRIGGERS = ['more', 'arrow']

const PANEL_ID = 'panel'

const SELECT_EVENT = 'select'

const MORE_KEY = 'imp.buttonGroup.more'

const CHOOSE_KEY = 'imp.buttonGroup.choose'

const messages = {
  [MORE_KEY]: 'More actions',
  [CHOOSE_KEY]: 'Choose an action',
}

const styles = () => `
  ${hiddenRule}

  .shell {
    display: contents;
  }

  .row {
    display: inline-flex;
    align-items: stretch;
  }

  ${groupSeamRules('.row')}

  .segment {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    margin: 0;
    border: ${token('border-width')} solid ${token('color-border')};
    ${groupableSeam()}
    background-color: ${token('color-surface-sunken')};
    color: ${token('color-text')};
    ${fontFamily()}
    line-height: ${token('line-height-tight')};
    white-space: nowrap;
  }

  ${sizeRules()}

  .segment.size-sm {
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-3')};
  }

  .segment.size-md {
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-4')};
  }

  .segment.size-lg {
    padding-block: ${token('space-3')};
    padding-inline: ${token('space-5')};
  }

  ${anchoredStyles({ trigger: '.row', panel: '.panel', placement: 'block-end', align: 'end' })}

  .panel {
    display: flex;
    flex-direction: column;
    gap: ${token('space-1')};
    min-inline-size: 10rem;
    padding: ${token('space-1')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-md')};
    color: ${token('color-text')};
    ${fontFamily()}
  }

  .option {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    margin: 0;
    border: none;
    border-radius: ${token('radius-item')};
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
    background-color: transparent;
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
    white-space: nowrap;
    text-align: start;
    cursor: pointer;
  }

  .option:hover:not(:disabled) {
    background-color: ${token('color-surface-hover')};
  }

  .option:focus-visible {${focusRing()}}

  .option:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .option .icon {
    display: block;
    inline-size: 1em;
    block-size: 1em;
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .panel { border-color: CanvasText }
  }
`

const normalizeItems = (value) => {
  if (value === undefined) return null
  if (!Array.isArray(value)) {
    impLogger.warn(`${NAME}: 'items' must be an array of { id, label, onClick } - showing none`)
    return []
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || entry instanceof Node || entry.label === undefined) {
      impLogger.warn(`${NAME}: an item is not an object with a 'label' - skipping it`)
      return []
    }
    return [{
      id: entry.id === undefined ? String(index) : String(entry.id),
      label: entry.label,
      icon: entry.icon === undefined || entry.icon === null ? null : entry.icon,
      onClick: typeof entry.onClick === 'function' ? entry.onClick : null,
      disabled: Boolean(entry.disabled),
    }]
  })
}

const translated = (self, key) => {
  const label = createState(`${key}.label`, t(key))
  lang.watch(self, () => label.set(t(key)))
  return label
}

const reportChoice = (row, item) =>
  row.dispatchEvent(
    new CustomEvent(SELECT_EVENT, {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: { id: item.id, item },
    }),
  )

const buildPanel = ({ self, row, panel, opener, items, expanded }) => {
  let open = false

  const closePanel = () => {
    if (open) panel.hidePopover()
  }

  const choose = (item) => {
    closePanel()
    if (reportChoice(row, item)) item.onClick?.({ id: item.id, item })
  }

  const entries = items.map((item) => ({
    ...item,
    node: el(
      'button',
      {
        type: 'button',
        class: 'option',
        role: 'menuitem',
        tabindex: '-1',
        disabled: item.disabled,
        events: { click: () => choose(item) },
      },
      item.icon === null ? null : span({ class: 'icon' }, bindContent(self, item.icon)),
      bindText(self, item.label),
    ),
  }))
  panel.append(...entries.map(({ node }) => node))

  const selectable = entries.filter(({ disabled }) => !disabled)

  const focusEntry = (entry) => {
    if (!entry) return
    for (const other of entries) other.node.tabIndex = other === entry ? 0 : -1
    entry.node.focus()
  }

  const step = (direction) => {
    const focused = panel.getRootNode().activeElement
    const from = selectable.findIndex(({ node }) => node === focused)
    const next = (from + direction + selectable.length) % selectable.length
    focusEntry(selectable[next])
  }

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') return closePanel()
    if (event.key === 'ArrowDown') step(1)
    else if (event.key === 'ArrowUp') step(-1)
    else if (event.key === 'Home') focusEntry(selectable[0])
    else if (event.key === 'End') focusEntry(selectable.at(-1))
    else return
    event.preventDefault()
  })

  let heldFocus = false

  panel.addEventListener('beforetoggle', (event) => {
    open = event.newState === 'open'
    expanded.set(open)
    heldFocus = !open && panel.contains(panel.getRootNode().activeElement)
  })

  panel.addEventListener('toggle', (event) => {
    if (event.newState === 'open') {
      focusEntry(selectable.find(({ node }) => node.tabIndex === 0) ?? selectable[0])
      return
    }
    if (heldFocus) opener.focus()
  })

  return { close: closePanel }
}

const segmentOf = (node, size) => {
  if (!(node instanceof Text)) return node
  return span({ class: ['segment', `size-${size}`] }, node)
}

const buildMenu = ({ self, props, row, variant, size, items }) => {
  const trigger = oneOf(NAME, 'trigger', props.trigger, TRIGGERS, 'more')
  const panel = div({ id: PANEL_ID, class: 'panel', role: 'menu', popover: 'auto' })
  const expanded = createState('imp.buttonGroup.expanded', false)
  const opener = button({
    variant,
    size,
    square: true,
    disabled: props.disabled,
    label: translated(self, trigger === 'arrow' ? CHOOSE_KEY : MORE_KEY),
    haspopup: 'menu',
    expanded,
    popoverTarget: panel,
  }, trigger === 'arrow' ? chevronDownIcon() : moreIcon())
  opener.classList.add('trigger')
  const menu = buildPanel({ self, row, panel, opener, items, expanded })
  bindValue(self, props.disabled, (value) => {
    if (value) menu.close()
  })
  row.append(opener)
  return panel
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const items = normalizeItems(props.items)

    if (items !== null && items.length === 0) {
      impLogger.warn(`${NAME}: 'items' holds no usable entry - rendering the row with no menu`)
    }
    if (items === null && props.trigger !== undefined) {
      impLogger.warn(`${NAME}: 'trigger' selects what opens the menu - pass 'items' as well`)
    }
    if (children.length === 0 && !items?.length) {
      impLogger.warn(`${NAME}: has nothing to render - pass controls as children, or 'items'`)
    }

    const row = div(
      { class: 'row', role: 'group', events: ownEvents(props.events, [SELECT_EVENT]) },
      ...children.map((child) => segmentOf(child, size)),
    )
    bindValue(self, props.label, (value) => {
      if (value !== undefined) row.setAttribute('aria-label', String(value))
    })

    const panel = items?.length ? buildMenu({ self, props, row, variant, size, items }) : null
    return div({ class: 'shell' }, row, panel)
  },
}

export const buttonGroup = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
