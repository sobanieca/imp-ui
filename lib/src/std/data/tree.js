import { defineComponent } from '../shared/define.js'
import { div, li, span, ul } from '../../api/html.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { bindValue } from '../shared/args.js'
import { focusRing, fontFamily, hiddenRule, token } from '../shared/css.js'
import { chevronIcon } from '../shared/icons.js'
import { ownEvents } from '../shared/own-events.js'
import { icon } from '../general/icon.js'

const NAME = 'tree'

const KNOWN_PROPS = ['label', 'items', 'selected', 'expanded', 'events']

const SELECT_EVENT = 'select'

const EXPAND_ALL = 'all'

const styles = () => `
  ${hiddenRule}

  :host {
    display: block;
    min-inline-size: 0;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tree {
    ${fontFamily()}
    color: ${token('color-text')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

  [role='treeitem'] {
    outline: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: ${token('space-1')};
    padding-block: ${token('space-1')};
    padding-inline-start: calc(${
  token('space-1')
} + var(--level) * var(--imp-tree-indent, 1.25rem));
    padding-inline-end: ${token('space-2')};
    border-radius: ${token('radius-item')};
    cursor: pointer;
    user-select: none;
  }

  .row:hover {
    background-color: ${token('color-surface-hover')};
  }

  [role='treeitem']:focus-visible > .row {${focusRing()}
    outline-offset: -2px;
  }

  [aria-selected='true'] > .row {
    background-color: color-mix(in oklab, ${token('color-primary')} 12%, transparent);
    color: ${token('color-primary')};
    font-weight: ${token('font-weight-bold')};
  }

  .chevron-box {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    color: ${token('color-secondary')};
  }

  .chevron {
    inline-size: 1rem;
    block-size: 1rem;
    transition: rotate ${token('duration-fast')} ease-out;
  }

  .chevron:dir(rtl) {
    scale: -1 1;
  }

  [aria-expanded='true'] > .row .chevron {
    rotate: 90deg;
  }

  [aria-expanded='true'] > .row .chevron:dir(rtl) {
    rotate: -90deg;
  }

  .icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }

  .label {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron { transition: none }
  }

  @media (forced-colors: active) {
    [aria-selected='true'] > .row {
      outline: ${token('border-width')} solid Highlight;
      outline-offset: calc(-1 * ${token('border-width')});
      color: Highlight;
    }
  }
`

const iconNode = (
  value,
) => (typeof value.nodeType === 'number' ? value : icon({ size: 'sm' }, value))

const isBack = (key, element) =>
  key === (getComputedStyle(element).direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft')

const isForward = (key, element) =>
  key === (getComputedStyle(element).direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight')

const isTypedCharacter = (event) =>
  event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass every node in 'items'`)
    }
    if (props.label === undefined) {
      impLogger.warn(`${NAME}: pass a 'label' - it names the tree for a screen reader`)
    }

    let entries = new Map()
    let labelCount = 0
    const entryByNode = new WeakMap()
    let expandedIds = new Set()
    let expandEverything = false
    let selectedId = null
    let focusId = null

    const tree = ul({
      class: 'tree',
      role: 'tree',
      events: ownEvents(props.events, [SELECT_EVENT]),
    })

    const build = (items, level, parent) => {
      if (!Array.isArray(items)) {
        impLogger.warn(
          `${NAME}: 'items' must be an array of { id, label, children } - showing none`,
        )
        return []
      }
      return items.flatMap((item) => {
        if (
          !item || typeof item !== 'object' || item.id === undefined || item.label === undefined
        ) {
          impLogger.warn(
            `${NAME}: an item is not an object with an 'id' and a 'label' - skipping it`,
          )
          return []
        }
        const id = String(item.id)
        if (entries.has(id)) {
          impLogger.warn(`${NAME}: two items share the id '${id}' - ids must be unique in one tree`)
          return []
        }
        const entry = { id, item, parent, level, label: String(item.label), children: [] }
        const labelId = `label-${labelCount++}`
        entries.set(id, entry)
        const hasChildren = Array.isArray(item.children) && item.children.length > 0
        entry.row = div(
          { class: 'row', style: { '--level': String(level) } },
          span({ class: 'chevron-box' }, hasChildren ? chevronIcon('chevron') : null),
          item.icon === undefined || item.icon === null
            ? null
            : span({ class: 'icon' }, iconNode(item.icon)),
          span({ class: 'label', id: labelId }, entry.label),
        )
        entry.node = li(
          {
            role: 'treeitem',
            'aria-labelledby': labelId,
            'aria-selected': 'false',
            tabindex: '-1',
          },
          entry.row,
        )
        entryByNode.set(entry.node, entry)
        if (hasChildren) {
          entry.children = build(item.children, level + 1, entry)
          entry.group = ul({ role: 'group' }, ...entry.children.map((child) => child.node))
          entry.node.append(entry.group)
        }
        return [entry]
      })
    }

    const isParent = (entry) => entry.children.length > 0

    const isExpanded = (entry) => isParent(entry) && expandedIds.has(entry.id)

    const visibleBelow = (list) =>
      list.flatMap((entry) => [entry, ...(isExpanded(entry) ? visibleBelow(entry.children) : [])])

    const roots = () => [...entries.values()].filter((entry) => entry.parent === null)

    const visible = () => visibleBelow(roots())

    const hiddenBy = (entry) => {
      let folded = null
      for (let ancestor = entry.parent; ancestor !== null; ancestor = ancestor.parent) {
        if (!isExpanded(ancestor)) folded = ancestor
      }
      return folded
    }

    const paint = () => {
      const focusEntry = entries.get(focusId) ?? entries.get(selectedId)
      const tabStop = focusEntry ? hiddenBy(focusEntry) ?? focusEntry : visible()[0] ?? null
      focusId = tabStop?.id ?? null
      for (const entry of entries.values()) {
        entry.node.setAttribute('aria-selected', String(entry.id === selectedId))
        entry.node.tabIndex = entry === tabStop ? 0 : -1
        if (!isParent(entry)) continue
        entry.node.setAttribute('aria-expanded', String(isExpanded(entry)))
        entry.group.hidden = !isExpanded(entry)
      }
    }

    const focusedEntry = () => entryByNode.get(tree.getRootNode().activeElement) ?? null

    const focusOn = (entry) => {
      if (!entry) return
      focusId = entry.id
      paint()
      entry.node.focus()
    }

    const writeBack = (prop, value) => {
      const source = props[prop]
      if (!isStateShaped(source)) return
      if (typeof source.set === 'function') source.set(value)
      else {
        impLogger.warn(
          `${NAME}: '${prop}' is a read-only state - pass a writable state so ${NAME} can write it back`,
        )
      }
    }

    const setExpanded = (entry, wanted) => {
      if (!isParent(entry) || isExpanded(entry) === wanted) return
      if (wanted) expandedIds.add(entry.id)
      else expandedIds.delete(entry.id)
      const hadFocusInside = focusedEntry() !== null && hiddenBy(focusedEntry()) === entry
      paint()
      if (hadFocusInside) entry.node.focus()
      writeBack('expanded', [...expandedIds].map((id) => entries.get(id)?.item.id ?? id))
    }

    const select = (entry) => {
      selectedId = entry.id
      focusId = entry.id
      paint()
      writeBack('selected', entry.item.id)
      tree.dispatchEvent(
        new CustomEvent(SELECT_EVENT, {
          bubbles: true,
          composed: true,
          detail: { id: entry.item.id, item: entry.item },
        }),
      )
    }

    const activate = (entry) => {
      select(entry)
      setExpanded(entry, !isExpanded(entry))
    }

    const entryOf = (node) => entryByNode.get(node?.closest?.('[role="treeitem"]')) ?? null

    const typeahead = (from, character) => {
      const shown = visible()
      const start = shown.indexOf(from) + 1
      const wanted = character.toLowerCase()
      return [...shown.slice(start), ...shown.slice(0, start)]
        .find((entry) => entry.label.toLowerCase().startsWith(wanted))
    }

    const moveForward = (entry) => {
      if (!isParent(entry)) return
      if (isExpanded(entry)) focusOn(entry.children[0])
      else setExpanded(entry, true)
    }

    const moveBack = (entry) => {
      if (isExpanded(entry)) setExpanded(entry, false)
      else focusOn(entry.parent)
    }

    tree.addEventListener('click', (event) => {
      const entry = entryOf(event.target)
      if (entry === null) return
      if (event.target.closest('.chevron-box') && isParent(entry)) {
        setExpanded(entry, !isExpanded(entry))
      } else activate(entry)
    })

    tree.addEventListener('focusin', (event) => {
      const entry = entryOf(event.target)
      if (entry === null || entry.id === focusId) return
      focusId = entry.id
      paint()
    })

    tree.addEventListener('keydown', (event) => {
      const entry = entryOf(event.target)
      if (entry === null) return
      const shown = visible()
      const index = shown.indexOf(entry)
      if (event.key === 'ArrowDown') focusOn(shown[index + 1])
      else if (event.key === 'ArrowUp') focusOn(shown[index - 1])
      else if (isForward(event.key, tree)) moveForward(entry)
      else if (isBack(event.key, tree)) moveBack(entry)
      else if (event.key === 'Home') focusOn(shown[0])
      else if (event.key === 'End') focusOn(shown.at(-1))
      else if (event.key === 'Enter' || event.key === ' ') activate(entry)
      else if (isTypedCharacter(event)) focusOn(typeahead(entry, event.key))
      else return
      event.preventDefault()
    })

    const expandUnknown = (known) => {
      for (const entry of entries.values()) {
        if (isParent(entry) && !known.has(entry.id)) expandedIds.add(entry.id)
      }
    }

    if (props.label !== undefined) {
      bindValue(self, props.label, (value) => tree.setAttribute('aria-label', String(value)))
    }
    bindValue(self, props.expanded, (value) => {
      expandEverything = value === EXPAND_ALL
      if (expandEverything) expandUnknown(new Map())
      else if (Array.isArray(value)) expandedIds = new Set(value.map(String))
      else {
        if (value !== undefined && value !== null) {
          impLogger.warn(`${NAME}: 'expanded' must be an array of ids, or 'all' - got '${value}'`)
        }
        expandedIds = new Set()
      }
      paint()
    })
    bindValue(self, props.selected, (value) => {
      selectedId = value === undefined || value === null ? null : String(value)
      paint()
    })
    bindValue(self, props.items, (value) => {
      const focusedId = focusedEntry()?.id ?? null
      const known = entries
      entries = new Map()
      tree.replaceChildren(...build(value ?? [], 0, null).map((entry) => entry.node))
      if (expandEverything) expandUnknown(known)
      paint()
      if (focusedId !== null) entries.get(focusedId)?.node.focus()
    })
    return tree
  },
}

export const tree = (...args) => defineComponent(NAME, () => definition)(...args)
