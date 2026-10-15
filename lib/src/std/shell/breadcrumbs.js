import { defineComponent } from '../shared/define.js'
import { a, div, el, nav, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { url } from '../../location.js'
import { impLogger } from '../../logger.js'
import { bindContent, bindText, bindValue } from '../shared/args.js'
import { followHref, onPlainClick } from '../shared/links.js'
import { handlerOrNull, hrefOrNull, iconOrNull, itemId, normalizeItems } from '../shared/items.js'
import { chevronIcon } from '../shared/icons.js'
import { anchoredStyles } from '../shared/anchored.js'
import { MENU_OPTION, menuStyles, wireMenu } from '../shared/menu.js'
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

  ${menuStyles()}

  ${forcedColors}
`

const normalizeOptions = (value) =>
  value === undefined || value === null
    ? null
    : normalizeItems(NAME, value, {
        prop: 'options',
        shape: '{ id, label, href }',
        noun: 'an option',
        item: (entry, index) => ({
          id: itemId(entry, index),
          label: entry.label,
          href: hrefOrNull(NAME, entry.href),
          onClick: handlerOrNull(entry.onClick),
        }),
      })

const normalizeCrumbs = (value) =>
  normalizeItems(NAME, value, {
    shape: '{ id, label, href }',
    noun: 'a crumb',
    item: (entry, index) => ({
      id: itemId(entry, index),
      label: entry.label,
      href: hrefOrNull(NAME, entry.href),
      icon: iconOrNull(entry.icon, { size: 'sm' }),
      onClick: handlerOrNull(entry.onClick),
      options: normalizeOptions(entry.options),
    }),
  })

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
      return onPlainClick(a({ class: 'crumb', href: url(item.href) }, ...crumbContent(item)), () =>
        activate(item),
      )
    }

    const pickerNodes = (item, index) => {
      if (item.options === null || item.options.length === 0) return []
      const panelId = `panel-${index}`
      const anchor = `--imp-crumb-${index}`
      const trigger = el(
        'button',
        {
          class: 'picker',
          type: 'button',
          popovertarget: panelId,
          'aria-haspopup': 'menu',
          'aria-expanded': 'false',
          style: `anchor-name: ${anchor}`,
        },
        chevronIcon('caret'),
      )
      const panel = div({
        id: panelId,
        class: 'panel',
        role: 'menu',
        popover: 'auto',
        style: `position-anchor: ${anchor}`,
      })
      lang.watch(self, () =>
        trigger.setAttribute('aria-label', t(CHANGE_KEY, { label: String(readLabel(item.label)) })),
      )
      const choose = (option) => {
        panel.hidePopover()
        if (!report({ id: option.id, item: option, crumb: item })) return
        option.onClick?.({ id: option.id, item: option })
        if (option.href !== null) followHref(option.href)
      }
      const options = item.options.map((option) => {
        const label = bindText(self, option.label)
        if (option.href === null) {
          return el(
            'button',
            { ...MENU_OPTION, type: 'button', events: { click: () => choose(option) } },
            label,
          )
        }
        return onPlainClick(a({ ...MENU_OPTION, href: url(option.href) }, label), () =>
          choose(option),
        )
      })
      wireMenu({
        panel,
        opener: trigger,
        options,
        onToggle: (open) => trigger.setAttribute('aria-expanded', String(open)),
      })
      return [trigger, panel]
    }

    const readLabel = (label) => (typeof label?.get === 'function' ? label.get() : label)

    const list = el('ol')
    root.append(list)
    bindValue(self, props.items ?? [], (value) => {
      const items = normalizeCrumbs(value)
      list.replaceChildren(
        ...items.map((item, index) =>
          el(
            'li',
            index === 0 ? null : span({ class: 'separator', 'aria-hidden': 'true' }, separator),
            crumbNode(item, index === items.length - 1),
            ...pickerNodes(item, index),
          ),
        ),
      )
    })
    return root
  },
}

export const breadcrumbs = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(messages),
  )(...args)
