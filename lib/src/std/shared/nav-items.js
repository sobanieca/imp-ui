import { a, el, span } from '../../api/html.js'
import { url } from '../../location.js'
import { impLogger } from '../../logger.js'
import { bindContent, bindText, bindValue } from './args.js'
import { followHref, onPlainClick } from './links.js'
import { handlerOrNull, hrefOrNull, iconOrNull, itemId, normalizeItems } from './items.js'
import { tag } from '../display/tag.js'
import { focusRing, token } from './css.js'

const NAV_SELECT_EVENT = 'select'

let tagNotes = 0

export const normalizeNavTag = (name, value) => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || value.text === undefined) {
    impLogger.warn(`${name}: a 'tag' must be an object with a 'text' - ignoring it`)
    return null
  }
  return { text: value.text, color: value.color, title: value.title }
}

const hasTitle = (value) => value?.title !== undefined && value.title !== null && value.title !== ''

export const navTagNote = (value) => (hasTitle(value) ? `tag-note-${++tagNotes}` : null)

export const navTagNode = (self, value, noteId = null) => {
  if (value === null) return null
  const node = span(
    { class: 'tag' },
    tag({ color: value.color, size: 'sm' }, bindText(self, value.text)),
  )
  if (noteId === null) return node
  bindValue(self, value.title, (title) => node.setAttribute('title', String(title)))
  node.append(span({ id: noteId, hidden: true }, bindText(self, value.title)))
  return node
}

export const normalizeNavItems = (name, value, { nested = false } = {}) =>
  normalizeItems(name, value, {
    shape: '{ id, label, href }',
    item: (entry, index) => ({
      id: itemId(entry, index),
      label: entry.label,
      href: hrefOrNull(name, entry.href),
      icon: iconOrNull(entry.icon),
      onClick: handlerOrNull(entry.onClick),
      tag: normalizeNavTag(name, entry.tag),
      disabled: Boolean(entry.disabled),
      children:
        nested && entry.children !== undefined ? normalizeNavItems(name, entry.children) : [],
    }),
  })

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

const describedBy = (node, noteId) => {
  if (noteId !== null) node.setAttribute('aria-describedby', noteId)
  return node
}

export const navLinkNode = (self, item, activate, { alwaysActive = false } = {}) => {
  const noteId = navTagNote(item.tag)
  const content = [
    item.icon === null ? null : span({ class: 'icon' }, bindContent(self, item.icon)),
    span({ class: 'label' }, bindText(self, item.label)),
    navTagNode(self, item.tag, noteId),
  ]
  const inert = item.href === null && item.onClick === null && !alwaysActive
  if (item.disabled || inert) {
    return describedBy(
      span(
        { class: 'link', role: 'link', 'aria-disabled': item.disabled ? 'true' : 'false' },
        ...content,
      ),
      noteId,
    )
  }
  if (item.href === null) {
    return describedBy(
      el(
        'button',
        { class: 'link', type: 'button', events: { click: () => activate(item) } },
        ...content,
      ),
      noteId,
    )
  }
  return describedBy(
    onPlainClick(a({ class: 'link', href: url(item.href) }, ...content), () => activate(item)),
    noteId,
  )
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
    border-radius: ${token('radius-item')};
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
    font-weight: ${token('font-weight-bold')};
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
    inline-size: 1.5rem;
    block-size: 1.5rem;
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
