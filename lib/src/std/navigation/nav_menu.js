import { component } from '../../component.js'
import { a, div, el, nav, span } from '../../api/html.js'
import { url } from '../../router.js'
import { createLogger } from '../../logger.js'
import { bindText, bindValue, splitArgs, warnUnknownProps } from '../shared/args.js'
import { followHref, opensElsewhere } from '../shared/links.js'
import { focusRing, fontFamily, forcedColors, hiddenRule } from '../shared/css.js'
import { toDirection, toSpace } from '../shared/layout.js'
import {
  applyResponsive,
  displayDeclaration,
  resolveResponsive,
  resolveVisibility,
  responsiveStyles,
  VISIBILITY_PROPS,
} from '../shared/responsive.js'

const log = createLogger('imp')

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
  { property: 'gap', variable: 'gap', fallback: 'var(--imp-space-1, 4px)' },
]

const styles = `
  ${hiddenRule}

  .root {
    ${fontFamily}
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
    gap: var(--imp-space-2, 8px);
    padding-block: var(--imp-space-2, 8px);
    padding-inline: var(--imp-space-2, 8px);
    color: var(--imp-color-secondary, #64748b);
    font-size: var(--imp-font-size-sm, 0.875rem);
    font-weight: var(--imp-font-weight-medium, 500);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .link {
    display: flex;
    align-items: center;
    gap: var(--imp-space-2, 8px);
    border-radius: var(--imp-radius-md, 6px);
    padding-block: var(--imp-space-2, 8px);
    padding-inline: var(--imp-space-3, 12px);
    color: var(--imp-color-text, #0f172a);
    font-size: var(--imp-font-size-sm, 0.875rem);
    line-height: var(--imp-line-height-tight, 1.25);
    text-decoration: none;
    white-space: nowrap;
    transition:
      background-color var(--imp-duration-fast, 120ms) ease-out,
      color var(--imp-duration-fast, 120ms) ease-out;
  }

  .link:hover {
    background-color: var(--imp-color-surface-hover, #f1f5f9);
  }

  .link:focus-visible {${focusRing}}

  .link[aria-current] {
    background-color: var(--imp-color-surface-hover, #f1f5f9);
    color: var(--imp-color-primary, #2563eb);
    font-weight: var(--imp-font-weight-medium, 500);
  }

  .link[aria-disabled='true'] {
    color: var(--imp-color-secondary, #64748b);
    cursor: not-allowed;
    opacity: var(--imp-disabled-opacity, 0.55);
  }

  .badge {
    margin-inline-start: auto;
    border-radius: var(--imp-radius-sm, 4px);
    padding-inline: var(--imp-space-1, 4px);
    background-color: var(--imp-color-surface-hover, #f1f5f9);
    color: var(--imp-color-secondary, #64748b);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: var(--imp-font-size-sm, 0.875rem);
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
    log.warn(`${NAME}: 'items' must be an array of { id, label, href } — showing none`)
    return []
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || entry.label === undefined) {
      log.warn(`${NAME}: an item is not an object with a 'label' — skipping it`)
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
    log.warn(`${NAME}: 'groups' must be an array of { id, label } — deriving them from the items`)
    return []
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || entry.id === undefined) {
      log.warn(`${NAME}: a group is not an object with an 'id' — skipping it`)
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
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs(NAME, args)
    warnUnknownProps(NAME, props, KNOWN_PROPS)
    if (children.length > 0) {
      log.warn(`${NAME}: takes no content — pass every destination as 'items'`)
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

let create = null

export const navMenu = (...args) => {
  create ??= component('imp-nav-menu', definition)
  return create(...args)
}
