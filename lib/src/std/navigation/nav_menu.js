import { defineComponent } from '../shared/define.js'
import { a, div, el, nav, span } from '../../api/html.js'
import { url } from '../../router.js'
import { impLogger } from '../../logger.js'
import { bindText, bindValue } from '../shared/args.js'
import { followHref, opensElsewhere } from '../shared/links.js'
import { focusRing, fontFamily, forcedColors, hiddenRule, token } from '../shared/css.js'
import { toDirection, toSpace } from '../shared/layout.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'

const NAME = 'navMenu'

const KNOWN_PROPS = [
  'items',
  'groups',
  'selected',
  'label',
  'direction',
  'gap',
  'events',
  ...VISIBILITY_PROPS,
]

const SELECT_EVENT = 'select'

const declarations = [
  displayDeclaration('flex'),
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

  .badge {
    margin-inline-start: auto;
    border-radius: ${token('radius-sm')};
    padding-inline: ${token('space-1')};
    background-color: ${token('color-surface-hover')};
    color: ${token('color-secondary')};
    font-family: ${token('font-family-mono')};
    font-size: ${token('font-size-sm')};
  }

  .group-title .badge {
    margin-inline-start: 0;
    background-color: transparent;
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

  ${responsiveStyles('.root, .group, ul', declarations)}
`

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
      group: entry.group === undefined || entry.group === null ? null : String(entry.group),
      badge: entry.badge,
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
    return [{ id: String(entry.id), label: entry.label ?? String(entry.id), badge: entry.badge }]
  })
}

const groupedItems = (items, declaredGroups) => {
  const sections = new Map()
  for (const group of declaredGroups) sections.set(group.id, { ...group, items: [] })
  for (const item of items) {
    const id = item.group ?? ''
    if (!sections.has(id)) sections.set(id, { id, label: id, badge: undefined, items: [] })
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
    const responsive = [
      ['display', resolveVisibility(NAME, props)],
      ['direction', resolveResponsive(NAME, 'direction', props.direction, toDirection(NAME))],
      ['gap', resolveResponsive(NAME, 'gap', props.gap, toSpace(NAME, 'gap', 1))],
    ]
    for (const [variable, resolved] of responsive) applyResponsive(root, variable, resolved)

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
      if (followed && item.href !== null) followHref(item.href)
    }

    const linkNode = (item) => {
      const content = [
        span({ class: 'label' }, bindText(item.label)),
        item.badge === undefined ? null : span({ class: 'badge' }, bindText(item.badge)),
      ]
      if (item.disabled || item.href === null) {
        return span(
          { class: 'link', role: 'link', 'aria-disabled': item.disabled ? 'true' : 'false' },
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
          section.badge === undefined ? null : span({ class: 'badge' }, bindText(section.badge)),
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
