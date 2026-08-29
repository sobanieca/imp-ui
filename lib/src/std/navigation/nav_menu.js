import { defineComponent } from '../shared/define.js'
import { a, div, el, nav, span } from '../../api/html.js'
import { url } from '../../router.js'
import { impLogger } from '../../logger.js'
import { bindContent, bindText, bindValue } from '../shared/args.js'
import { followHref, opensElsewhere } from '../shared/links.js'
import { tag } from '../display/tag.js'
import { focusRing, fontFamily, forcedColors, hiddenRule, token } from '../shared/css.js'
import { toDirection, toSpace } from '../shared/layout.js'
import { applyValues, declarationStyles, resolveValue } from '../shared/declarations.js'

const NAME = 'navMenu'

const KNOWN_PROPS = [
  'items',
  'groups',
  'selected',
  'label',
  'direction',
  'gap',
  'events',
]

const SELECT_EVENT = 'select'

const declarations = [
  { property: 'flex-direction', variable: 'direction', fallback: 'column' },
  { property: 'gap', variable: 'gap', fallback: token('space-1') },
]

const styles = () => `
  ${hiddenRule}

  .root {
    ${fontFamily()}
    min-inline-size: 0;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    min-inline-size: 0;
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-2')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-medium')};
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
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

  .group-title .tag {
    margin-inline-start: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .link { transition: none }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .link[aria-current] {
      color: Highlight;
      text-decoration: underline;
    }
  }

  .root, .group, ul {
    display: flex;
  }

  ${declarationStyles('.root, .group, ul', declarations, '.root')}
`

const normalizeTag = (value) => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || value.text === undefined) {
    impLogger.warn(`${NAME}: a 'tag' must be an object with a 'text' - ignoring it`)
    return null
  }
  return { text: value.text, color: value.color }
}

const tagNode = (value) =>
  value === null
    ? null
    : span({ class: 'tag' }, tag({ color: value.color, size: 'sm' }, bindText(value.text)))

const normalizeItems = (value) => {
  if (!Array.isArray(value)) {
    impLogger.warn(`${NAME}: 'items' must be an array of { id, label, href } - showing none`)
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
      href: typeof entry.href === 'string' && entry.href !== '' ? entry.href : null,
      icon: entry.icon === undefined || entry.icon === null ? null : entry.icon,
      onClick: typeof entry.onClick === 'function' ? entry.onClick : null,
      group: entry.group === undefined || entry.group === null ? null : String(entry.group),
      tag: normalizeTag(entry.tag),
      disabled: Boolean(entry.disabled),
    }]
  })
}

const normalizeGroups = (value) => {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    impLogger.warn(
      `${NAME}: 'groups' must be an array of { id, label } - deriving them from the items`,
    )
    return []
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || entry.id === undefined) {
      impLogger.warn(`${NAME}: a group is not an object with an 'id' - skipping it`)
      return []
    }
    return [{
      id: String(entry.id),
      label: entry.label ?? String(entry.id),
      tag: normalizeTag(entry.tag),
    }]
  })
}

const groupedItems = (items, declaredGroups) => {
  const sections = new Map()
  for (const group of declaredGroups) sections.set(group.id, { ...group, items: [] })
  for (const item of items) {
    const id = item.group ?? ''
    if (!sections.has(id)) sections.set(id, { id, label: id, tag: null, items: [] })
    sections.get(id).items.push(item)
  }
  return [...sections.values()].filter((section) => section.items.length > 0)
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass every destination as 'items'`)
    }
    const root = nav({ class: 'root', events: props.events })
    if (props.label !== undefined) {
      bindValue(props.label, (value) => root.setAttribute('aria-label', String(value)))
    }
    applyValues(root, [
      ['direction', resolveValue(props.direction, toDirection(NAME))],
      ['gap', resolveValue(props.gap, toSpace(NAME, 'gap', 1))],
    ])

    let links = []
    let selected = null

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

    const linkNode = (item) => {
      const content = [
        item.icon === null ? null : span({ class: 'icon' }, bindContent(item.icon)),
        span({ class: 'label' }, bindText(item.label)),
        tagNode(item.tag),
      ]
      if (item.disabled || (item.href === null && item.onClick === null)) {
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

    const listNode = (section) =>
      el(
        'ul',
        section.titleId === null ? {} : { 'aria-labelledby': section.titleId },
        ...section.items.map((item) => {
          const link = linkNode(item)
          links.push({ id: item.id, link })
          return el('li', link)
        }),
      )

    const sectionNode = (section) => {
      if (section.titleId === null) return listNode(section)
      return div(
        { class: 'group' },
        div(
          { class: 'group-title', id: section.titleId },
          bindText(section.label),
          tagNode(section.tag),
        ),
        listNode(section),
      )
    }

    const paintSelected = () => {
      for (const { id, link } of links) {
        if (id === selected) link.setAttribute('aria-current', 'page')
        else link.removeAttribute('aria-current')
      }
    }

    const declaredGroups = normalizeGroups(props.groups)

    bindValue(props.items ?? [], (value) => {
      links = []
      const sections = groupedItems(normalizeItems(value), declaredGroups)
        .map((section, index) => ({
          ...section,
          titleId: section.id === '' ? null : `group-${index}`,
        }))
      root.replaceChildren(...sections.map(sectionNode))
      paintSelected()
    })
    bindValue(props.selected, (value) => {
      selected = value === undefined || value === null ? null : String(value)
      paintSelected()
    })
    return root
  },
}

export const navMenu = (...args) => defineComponent(NAME, () => definition)(...args)
