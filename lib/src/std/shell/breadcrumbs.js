import { defineComponent } from '../shared/define.js'
import { a, el, nav, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { url } from '../../router.js'
import { impLogger } from '../../logger.js'
import { bindContent, bindText, bindValue } from '../shared/args.js'
import { followHref, opensElsewhere } from '../shared/links.js'
import { focusRing, fontFamily, forcedColors, token } from '../shared/css.js'

const NAME = 'breadcrumbs'

const KNOWN_PROPS = ['items', 'label', 'separator', 'events']

const SELECT_EVENT = 'select'

const LABEL_KEY = 'imp.breadcrumbs.label'

const messages = {
  [LABEL_KEY]: 'Breadcrumb',
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
    border-radius: ${token('radius-sm')};
    padding-inline: ${token('space-1')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
    text-decoration: none;
    min-inline-size: 0;
  }

  button.crumb {
    margin: 0;
    border: none;
    background: none;
    font-family: inherit;
    cursor: pointer;
  }

  a.crumb:hover,
  button.crumb:hover {
    color: ${token('color-link-hover')};
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  a.crumb:focus-visible,
  button.crumb:focus-visible {${focusRing()}}

  .crumb[aria-current] {
    color: ${token('color-text')};
    font-weight: ${token('font-weight-medium')};
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

  ${forcedColors}
`

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
    }]
  })
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  build: (_instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the trail as 'items'`)
    }
    const root = nav({ class: 'root', events: props.events })
    if (props.label === undefined) {
      lang.watch(() => root.setAttribute('aria-label', t(LABEL_KEY)))
    } else bindValue(props.label, (value) => root.setAttribute('aria-label', String(value)))

    const separator = props.separator === undefined ? '/' : props.separator

    const activate = (item) => {
      const followed = root.dispatchEvent(
        new CustomEvent(SELECT_EVENT, {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { id: item.id, item },
        }),
      )
      if (!followed) return
      item.onClick?.({ id: item.id, item })
      if (item.href !== null) followHref(item.href)
    }

    const crumbContent = (item) => [
      item.icon === null ? null : span({ class: 'icon' }, bindContent(item.icon)),
      span({ class: 'label' }, bindText(item.label)),
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
      const link = a({ class: 'crumb', href: url(item.href) }, ...crumbContent(item))
      link.addEventListener('click', (event) => {
        if (opensElsewhere(event)) return
        event.preventDefault()
        activate(item)
      })
      return link
    }

    const list = el('ol')
    root.append(list)
    bindValue(props.items ?? [], (value) => {
      const items = normalizeItems(value)
      list.replaceChildren(...items.map((item, index) =>
        el(
          'li',
          index === 0 ? null : span({ class: 'separator', 'aria-hidden': 'true' }, separator),
          crumbNode(item, index === items.length - 1),
        )
      ))
    })
    return root
  },
}

export const breadcrumbs = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
