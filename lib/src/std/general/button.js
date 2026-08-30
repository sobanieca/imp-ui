import { defineComponent } from '../shared/define.js'
import { div, el, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindContent, bindText, bindValue, oneOf } from '../shared/args.js'
import { moreIcon } from '../shared/icons.js'
import { anchoredStyles } from '../shared/anchored.js'
import {
  focusRing,
  fontFamily,
  forcedColors,
  hiddenRule,
  sizeRules,
  SIZES,
  token,
} from '../shared/css.js'

const NAME = 'button'

const KNOWN_PROPS = [
  'variant',
  'size',
  'disabled',
  'loading',
  'block',
  'label',
  'items',
  'events',
]

const VARIANTS = ['default', 'primary', 'ghost', 'danger', 'link']

const MENU_ID = 'menu'

const SELECT_EVENT = 'select'

const MORE_KEY = 'imp.button.more'

const messages = { [MORE_KEY]: 'More actions' }

const styles = () => `
  ${hiddenRule}

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${token('space-2')};
    margin: 0;
    border: ${token('border-width')} solid transparent;
    border-radius: ${token('radius-md')};
    ${fontFamily()}
    font-weight: ${token('font-weight-medium')};
    line-height: ${token('line-height-tight')};
    cursor: pointer;
    transition:
      background-color ${token('duration-fast')} ease-out,
      border-color ${token('duration-fast')} ease-out,
      color ${token('duration-fast')} ease-out;
  }

  .button:focus-visible {${focusRing()}}

  .button:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  ${sizeRules()}

  .size-sm {
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-3')};
  }

  .size-md {
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-4')};
  }

  .size-lg {
    padding-block: ${token('space-3')};
    padding-inline: ${token('space-5')};
  }

  .variant-default {
    background-color: ${token('color-surface')};
    border-color: ${token('color-border')};
    color: ${token('color-text')};
  }

  .variant-default:hover:not(:disabled) {
    background-color: ${token('color-surface-hover')};
  }

  .variant-primary {
    background-color: ${token('color-primary')};
    color: ${token('color-on-primary')};
  }

  .variant-primary:hover:not(:disabled) {
    background-color: ${token('color-primary-hover')};
  }

  .variant-primary:active:not(:disabled) {
    background-color: ${token('color-primary-active')};
  }

  .variant-ghost {
    background-color: transparent;
    color: ${token('color-text')};
  }

  .variant-ghost:hover:not(:disabled) {
    background-color: ${token('color-surface-hover')};
  }

  .variant-danger {
    background-color: ${token('color-danger')};
    color: ${token('color-on-danger')};
  }

  .variant-danger:hover:not(:disabled) {
    background-color: ${token('color-danger-hover')};
  }

  .variant-danger:active:not(:disabled) {
    background-color: ${token('color-danger-active')};
  }

  .variant-link {
    padding: 0;
    border: none;
    border-radius: ${token('radius-sm')};
    background-color: transparent;
    color: ${token('color-link')};
    font-weight: ${token('font-weight-normal')};
    line-height: ${token('line-height-normal')};
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .variant-link:hover:not(:disabled) {
    color: ${token('color-link-hover')};
  }

  .spinner {
    inline-size: 1em;
    block-size: 1em;
    border: 2px solid currentColor;
    border-block-start-color: transparent;
    border-radius: 50%;
    animation: imp-button-spin 600ms linear infinite;
  }

  @keyframes imp-button-spin {
    to { transform: rotate(360deg) }
  }

  .block {
    inline-size: 100%;
  }

  .group {
    display: inline-flex;
    align-items: stretch;
  }

  .group.block {
    display: flex;
    inline-size: 100%;
  }

  .group.block .button:not(.more) {
    flex: 1;
  }

  .group .button:not(.more) {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }

  .more {
    margin-inline-start: calc(-1 * ${token('border-width')});
    padding-inline: ${token('space-2')};
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }

  .variant-primary.more,
  .variant-danger.more,
  .variant-ghost.more {
    border-inline-start-color: color-mix(in oklab, currentColor 30%, transparent);
  }

  .more .icon {
    display: block;
    inline-size: 1em;
    block-size: 1em;
  }

  ${anchoredStyles({ trigger: '.more', panel: '.menu', placement: 'block-end', align: 'end' })}

  .menu {
    display: flex;
    flex-direction: column;
    gap: ${token('space-1')};
    min-inline-size: 10rem;
    padding: ${token('space-1')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-md')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-lg')};
    color: ${token('color-text')};
    ${fontFamily()}
  }

  .item {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    margin: 0;
    border: none;
    border-radius: ${token('radius-sm')};
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

  .item:hover:not(:disabled) {
    background-color: ${token('color-surface-hover')};
  }

  .item:focus-visible {${focusRing()}}

  .item:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .item .icon {
    display: block;
    inline-size: 1em;
    block-size: 1em;
  }

  @media (prefers-reduced-motion: reduce) {
    .button { transition: none }
    .spinner { animation-duration: 2s }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .menu { border-color: CanvasText }
  }
`

const normalizeItems = (value) => {
  if (!Array.isArray(value)) {
    impLogger.warn(`${NAME}: 'items' must be an array of { id, label, onClick } - showing none`)
    return []
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || entry.label === undefined) {
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

const menuFor = (root, items, variant, size) => {
  const more = el('button', {
    type: 'button',
    class: ['button', 'more', `variant-${variant}`, `size-${size}`],
    popovertarget: MENU_ID,
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
  }, moreIcon())
  const menu = div({ id: MENU_ID, class: 'menu', role: 'menu', popover: 'auto' })

  const activate = (item) => {
    menu.hidePopover()
    const proceed = root.dispatchEvent(
      new CustomEvent(SELECT_EVENT, {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: { id: item.id, item },
      }),
    )
    if (!proceed) return
    item.onClick?.({ id: item.id, item })
  }

  const entries = items.map((item) => ({
    ...item,
    node: el(
      'button',
      {
        type: 'button',
        class: 'item',
        role: 'menuitem',
        tabindex: '-1',
        disabled: item.disabled,
        events: { click: () => activate(item) },
      },
      item.icon === null ? null : span({ class: 'icon' }, bindContent(item.icon)),
      bindText(item.label),
    ),
  }))
  menu.append(...entries.map(({ node }) => node))

  const selectable = entries.filter(({ disabled }) => !disabled)

  const focusItem = (entry) => {
    if (!entry) return
    for (const other of entries) other.node.tabIndex = other === entry ? 0 : -1
    entry.node.focus()
  }

  const step = (direction) => {
    const focused = menu.getRootNode().activeElement
    const from = selectable.findIndex(({ node }) => node === focused)
    const next = (from + direction + selectable.length) % selectable.length
    focusItem(selectable[next])
  }

  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') return menu.hidePopover()
    if (event.key === 'ArrowDown') step(1)
    else if (event.key === 'ArrowUp') step(-1)
    else if (event.key === 'Home') focusItem(selectable[0])
    else if (event.key === 'End') focusItem(selectable.at(-1))
    else return
    event.preventDefault()
  })

  let heldFocus = false

  menu.addEventListener('beforetoggle', (event) => {
    const open = event.newState === 'open'
    more.setAttribute('aria-expanded', String(open))
    heldFocus = !open && menu.contains(menu.getRootNode().activeElement)
  })

  menu.addEventListener('toggle', (event) => {
    if (event.newState === 'open') focusItem(selectable[0])
    else if (heldFocus) more.focus()
  })

  lang.watch(() => more.setAttribute('aria-label', t(MORE_KEY)))

  return { more, menu }
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  build: (_instance, props, children) => {
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const items = props.items === undefined ? [] : normalizeItems(props.items)
    const spinner = span({ class: 'spinner', 'aria-hidden': 'true', hidden: true })
    const control = el(
      'button',
      {
        type: 'button',
        class: [
          'button',
          `variant-${variant}`,
          `size-${size}`,
          props.block && items.length === 0 && 'block',
        ],
        events: props.events,
      },
      spinner,
      span({ class: 'label' }, ...children),
    )
    const group = items.length === 0 ? null : div({ class: ['group', props.block && 'block'] })
    const menu = group === null ? null : menuFor(group, items, variant, size)
    if (group !== null) group.append(control, menu.more, menu.menu)
    const root = group ?? control
    let disabled = false
    let loading = false
    const applyStates = () => {
      control.disabled = disabled || loading
      control.setAttribute('aria-busy', String(loading))
      spinner.hidden = !loading
      if (menu !== null) menu.more.disabled = disabled || loading
    }
    bindValue(props.disabled, (value) => {
      disabled = Boolean(value)
      applyStates()
    })
    bindValue(props.loading, (value) => {
      loading = Boolean(value)
      applyStates()
    })
    bindValue(props.label, (value) => {
      if (value !== undefined) control.setAttribute('aria-label', String(value))
    })
    return root
  },
}

export const button = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
