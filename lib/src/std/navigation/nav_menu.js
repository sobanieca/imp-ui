import { defineComponent } from '../shared/define.js'
import { div, el, nav } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { bindText, bindValue } from '../shared/args.js'
import { fontFamily, forcedColors, hiddenRule, token } from '../shared/css.js'
import { toDirection, toSpace } from '../shared/layout.js'
import { applyValues, declarationStyles, resolveValue } from '../shared/declarations.js'
import {
  groupedNavItems,
  navActivate,
  navLinkNode,
  navLinkStyles,
  navTagNode,
  normalizeNavGroups,
  normalizeNavItems,
} from '../shared/nav_items.js'

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

  ${navLinkStyles()}

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

  .group-title .tag {
    margin-inline-start: 0;
  }

  ${forcedColors}

  .root, .group, ul {
    display: flex;
  }

  ${declarationStyles('.root, .group, ul', declarations, '.root')}
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  build: (_instance, props, children) => {
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

    const activate = (item) => navActivate(root, item)

    const listNode = (section) =>
      el(
        'ul',
        section.titleId === null ? {} : { 'aria-labelledby': section.titleId },
        ...section.items.map((item) => {
          const link = navLinkNode(item, activate)
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
          navTagNode(section.tag),
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

    const declaredGroups = normalizeNavGroups(NAME, props.groups)

    bindValue(props.items ?? [], (value) => {
      links = []
      const sections = groupedNavItems(normalizeNavItems(NAME, value), declaredGroups)
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
