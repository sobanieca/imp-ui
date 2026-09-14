import { defineComponent } from '../shared/define.js'
import { a, div, el, nav, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { url } from '../../location.js'
import { impLogger } from '../../logger.js'
import { bindContent, bindText, bindValue } from '../shared/args.js'
import { followHref, onPlainClick } from '../shared/links.js'
import { chevronIcon } from '../shared/icons.js'
import { anchoredStyles } from '../shared/anchored.js'
import { focusRing, fontFamily, forcedColors, hoverColor, token } from '../shared/css.js'

const NAME = 'breadcrumbs'

const KNOWN_PROPS = ['items', 'label', 'separator', 'events']

const SELECT_EVENT = 'select'

const LABEL_KEY = 'imp.breadcrumbs.label'

const CHANGE_KEY = 'imp.breadcrumbs.change'

const messages = {
  [LABEL_KEY]: 'Breadcrumb',
  [CHANGE_KEY]: 'Change {label}',
}

const styles = () => `
  nav {
    ${fontFamily()}
    min-inline-size: 0;
  }

  ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${token('space-1')};
    margin: 0;
    padding: 0;
    list-style: none;
    min-inline-size: 0;
  }

  li {
    display: flex;
    align-items: center;
    gap: ${token('space-1')};
    min-inline-size: 0;
  }

  .crumb {
    display: flex;
    align-items: center;
    gap: ${token('space-1')};
    border-radius: ${token('radius-item')};
    padding-inline: ${token('space-1')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
    text-decoration: none;
    min-inline-size: 0;
  }

  button.crumb,
  .picker {
    margin: 0;
    border: none;
    background: none;
    font-family: inherit;
    cursor: pointer;
  }

  a.crumb:hover,
  button.crumb:hover {
    color: ${hoverColor('color-primary')};
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  a.crumb:focus-visible,
  button.crumb:focus-visible,
  .picker:focus-visible,
  .option:focus-visible {${focusRing()}}

  .crumb[aria-current] {
    color: ${token('color-text')};
    font-weight: ${token('font-weight-bold')};
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    inline-size: 1rem;
    block-size: 1rem;
  }

  .separator {
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
  }

  .picker {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 1.5rem;
    block-size: 1.5rem;
    padding: 0;
    border-radius: ${token('radius-item')};
    color: ${token('color-secondary')};
  }

  .picker:hover { background-color: ${token('color-surface-hover')} }

  .picker .caret {
    inline-size: 1rem;
    block-size: 1rem;
    rotate: 90deg;
  }

  ${anchoredStyles({ trigger: '.picker', panel: '.panel', placement: 'block-end', align: 'start' })}

  .panel {
    display: flex;
    flex-direction: column;
    min-inline-size: 12rem;
    padding: ${token('space-1')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    box-shadow: ${token('shadow-md')};
  }

  .panel:not(:popover-open) { display: none }

  .option {
    display: block;
    border-radius: ${token('radius-item')};
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    color: ${token('color-text')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
    text-decoration: none;
    white-space: nowrap;
  }

  .option:hover { background-color: ${token('color-surface-hover')} }

  ${forcedColors}

  @media (forced-colors: active) {
    .panel { border-color: CanvasText }
  }
`

const normalizeOptions = (value) => {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value)) {
    impLogger.warn(
      `${NAME}: a crumb 'options' must be an array of { id, label, href } - ignoring it`,
    )
    return null
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || entry.label === undefined) {
      impLogger.warn(`${NAME}: an option is not an object with a 'label' - skipping it`)
      return []
    }
    return [{
      id: entry.id === undefined ? String(index) : String(entry.id),
      label: entry.label,
      href: typeof entry.href === 'string' && entry.href !== '' ? entry.href : null,
      onClick: typeof entry.onClick === 'function' ? entry.onClick : null,
    }]
  })
}

const normalizeItems = (value) => {
  if (!Array.isArray(value)) {
    impLogger.warn(`${NAME}: 'items' must be an array of { id, label, href } - showing none`)
    return []
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || entry.label === undefined) {
      impLogger.warn(`${NAME}: a crumb is not an object with a 'label' - skipping it`)
      return []
    }
    return [{
      id: entry.id === undefined ? String(index) : String(entry.id),
      label: entry.label,
      href: typeof entry.href === 'string' && entry.href !== '' ? entry.href : null,
      icon: entry.icon === undefined || entry.icon === null ? null : entry.icon,
      onClick: typeof entry.onClick === 'function' ? entry.onClick : null,
      options: normalizeOptions(entry.options),
    }]
  })
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the trail as 'items'`)
    }
    const root = nav({ class: 'root', events: props.events })
    if (props.label === undefined) {
      lang.watch(self, () => root.setAttribute('aria-label', t(LABEL_KEY)))
    } else bindValue(self, props.label, (value) => root.setAttribute('aria-label', String(value)))

    const separator = props.separator === undefined ? '/' : props.separator

    const report = (detail) =>
      root.dispatchEvent(
        new CustomEvent(SELECT_EVENT, {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail,
        }),
      )

    const activate = (item) => {
      if (!report({ id: item.id, item })) return
      item.onClick?.({ id: item.id, item })
      if (item.href !== null) followHref(item.href)
    }

    const crumbContent = (item) => [
      item.icon === null ? null : span({ class: 'icon' }, bindContent(self, item.icon)),
      span({ class: 'label' }, bindText(self, item.label)),
    ]

    const crumbNode = (item, isLast) => {
      if (isLast) {
        return span({ class: 'crumb', 'aria-current': 'page' }, ...crumbContent(item))
      }
      if (item.href === null && item.onClick === null) {
        return span({ class: 'crumb' }, ...crumbContent(item))
      }
      if (item.href === null) {
        return el(
          'button',
          { class: 'crumb', type: 'button', events: { click: () => activate(item) } },
          ...crumbContent(item),
        )
      }
      return onPlainClick(
        a({ class: 'crumb', href: url(item.href) }, ...crumbContent(item)),
        () => activate(item),
      )
    }

    const pickerNodes = (item, index) => {
      if (item.options === null || item.options.length === 0) return []
      const panelId = `panel-${index}`
      const anchor = `--imp-crumb-${index}`
      const trigger = el('button', {
        class: 'picker',
        type: 'button',
        popovertarget: panelId,
        'aria-haspopup': 'menu',
        'aria-expanded': 'false',
        style: `anchor-name: ${anchor}`,
      }, chevronIcon('caret'))
      const panel = div({
        id: panelId,
        class: 'panel',
        role: 'menu',
        popover: 'auto',
        style: `position-anchor: ${anchor}`,
      })
      lang.watch(self, () =>
        trigger.setAttribute(
          'aria-label',
          t(CHANGE_KEY, { label: String(readLabel(item.label)) }),
        ))
      const choose = (option) => {
        panel.hidePopover()
        if (!report({ id: option.id, item: option, crumb: item })) return
        option.onClick?.({ id: option.id, item: option })
        if (option.href !== null) followHref(option.href)
      }
      const entries = item.options.map((option) => {
        const attributes = { class: 'option', role: 'menuitem', tabindex: '-1' }
        const label = bindText(self, option.label)
        if (option.href === null) {
          return el(
            'button',
            { ...attributes, type: 'button', events: { click: () => choose(option) } },
            label,
          )
        }
        return onPlainClick(
          a({ ...attributes, href: url(option.href) }, label),
          () => choose(option),
        )
      })
      panel.append(...entries)
      const focusEntry = (entry) => {
        if (!entry) return
        for (const other of entries) other.tabIndex = other === entry ? 0 : -1
        entry.focus()
      }
      const step = (direction) => {
        const focused = panel.getRootNode().activeElement
        const from = entries.indexOf(focused)
        focusEntry(entries[(from + direction + entries.length) % entries.length])
      }
      panel.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') return panel.hidePopover()
        if (event.key === 'ArrowDown') step(1)
        else if (event.key === 'ArrowUp') step(-1)
        else if (event.key === 'Home') focusEntry(entries[0])
        else if (event.key === 'End') focusEntry(entries.at(-1))
        else return
        event.preventDefault()
      })
      let heldFocus = false
      panel.addEventListener('beforetoggle', (event) => {
        const open = event.newState === 'open'
        trigger.setAttribute('aria-expanded', String(open))
        heldFocus = !open && panel.contains(panel.getRootNode().activeElement)
      })
      panel.addEventListener('toggle', (event) => {
        if (event.newState === 'open') focusEntry(entries[0])
        else if (heldFocus) trigger.focus()
      })
      return [trigger, panel]
    }

    const readLabel = (label) => (typeof label?.get === 'function' ? label.get() : label)

    const list = el('ol')
    root.append(list)
    bindValue(self, props.items ?? [], (value) => {
      const items = normalizeItems(value)
      list.replaceChildren(...items.map((item, index) =>
        el(
          'li',
          index === 0 ? null : span({ class: 'separator', 'aria-hidden': 'true' }, separator),
          crumbNode(item, index === items.length - 1),
          ...pickerNodes(item, index),
        )
      ))
    })
    return root
  },
}

export const breadcrumbs = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
