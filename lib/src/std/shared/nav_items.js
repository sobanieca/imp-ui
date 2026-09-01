import { a, el, span } from '../../api/html.js'
import { url } from '../../router.js'
import { impLogger } from '../../logger.js'
import { bindContent, bindText } from './args.js'
import { followHref, opensElsewhere } from './links.js'
import { tag } from '../display/tag.js'
import { focusRing, token } from './css.js'

export const NAV_SELECT_EVENT = 'select'

export const normalizeNavTag = (name, value) => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || value.text === undefined) {
    impLogger.warn(`${name}: a 'tag' must be an object with a 'text' - ignoring it`)
    return null
  }
  return { text: value.text, color: value.color }
}

export const navTagNode = (value) =>
  value === null
    ? null
    : span({ class: 'tag' }, tag({ color: value.color, size: 'sm' }, bindText(value.text)))

export const normalizeNavItems = (name, value, { nested = false } = {}) => {
  if (!Array.isArray(value)) {
    impLogger.warn(`${name}: 'items' must be an array of { id, label, href } - showing none`)
    return []
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || entry.label === undefined) {
      impLogger.warn(`${name}: an item is not an object with a 'label' - skipping it`)
      return []
    }
    return [{
      id: entry.id === undefined ? String(index) : String(entry.id),
      label: entry.label,
      href: typeof entry.href === 'string' && entry.href !== '' ? entry.href : null,
      icon: entry.icon === undefined || entry.icon === null ? null : entry.icon,
      onClick: typeof entry.onClick === 'function' ? entry.onClick : null,
      group: entry.group === undefined || entry.group === null ? null : String(entry.group),
      tag: normalizeNavTag(name, entry.tag),
      disabled: Boolean(entry.disabled),
      children: nested && entry.children !== undefined
        ? normalizeNavItems(name, entry.children)
        : [],
    }]
  })
}

export const normalizeNavGroups = (name, value) => {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    impLogger.warn(
      `${name}: 'groups' must be an array of { id, label } - deriving them from the items`,
    )
    return []
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || entry.id === undefined) {
      impLogger.warn(`${name}: a group is not an object with an 'id' - skipping it`)
      return []
    }
    return [{
      id: String(entry.id),
      label: entry.label ?? String(entry.id),
      tag: normalizeNavTag(name, entry.tag),
    }]
  })
}

export const groupedNavItems = (items, declaredGroups) => {
  const sections = new Map()
  for (const group of declaredGroups) sections.set(group.id, { ...group, items: [] })
  for (const item of items) {
    const id = item.group ?? ''
    if (!sections.has(id)) sections.set(id, { id, label: id, tag: null, items: [] })
    sections.get(id).items.push(item)
  }
  return [...sections.values()].filter((section) => section.items.length > 0)
}

export const navActivate = (origin, item) => {
  const followed = origin.dispatchEvent(
    new CustomEvent(NAV_SELECT_EVENT, {
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

export const navLinkNode = (item, activate, { alwaysActive = false } = {}) => {
  const content = [
    item.icon === null ? null : span({ class: 'icon' }, bindContent(item.icon)),
    span({ class: 'label' }, bindText(item.label)),
    navTagNode(item.tag),
  ]
  const inert = item.href === null && item.onClick === null && !alwaysActive
  if (item.disabled || inert) {
    return span(
      { class: 'link', role: 'link', 'aria-disabled': item.disabled ? 'true' : 'false' },
      ...content,
    )
  }
  if (item.href === null) {
    return el(
      'button',
      { class: 'link', type: 'button', events: { click: () => activate(item) } },
      ...content,
    )
  }
  const link = a({ class: 'link', href: url(item.href) }, ...content)
  link.addEventListener('click', (event) => {
    if (opensElsewhere(event)) return
    event.preventDefault()
    activate(item)
  })
  return link
}

export const navLinkStyles = () => `
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    min-inline-size: 0;
  }

  button.link {
    margin: 0;
    border: none;
    background: none;
    font-family: inherit;
    inline-size: 100%;
    text-align: start;
    cursor: pointer;
  }

  .link {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    border-radius: ${token('radius-md')};
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    color: ${token('color-text')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
    text-decoration: none;
    white-space: nowrap;
    transition:
      background-color ${token('duration-fast')} ease-out,
      color ${token('duration-fast')} ease-out;
  }

  .link:hover {
    background-color: ${token('color-surface-hover')};
  }

  .link:focus-visible {${focusRing()}}

  .link[aria-current] {
    background-color: ${token('color-surface-hover')};
    color: ${token('color-primary')};
    font-weight: ${token('font-weight-medium')};
  }

  .link[aria-disabled='true'] {
    color: ${token('color-secondary')};
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }

  .tag {
    display: inline-flex;
    margin-inline-start: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .link { transition: none }
  }

  @media (forced-colors: active) {
    .link[aria-current] {
      color: Highlight;
      text-decoration: underline;
    }
  }
`
