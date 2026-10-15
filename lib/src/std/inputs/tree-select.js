import { defineComponent } from '../shared/define.js'
import { div, el, li, span, ul } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { createState } from '../../state.js'
import { luSearch, luX } from '../../icons/lucide-icons.js'
import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import { chevronDownIcon, chevronIcon, selectionMarkIcon } from '../shared/icons.js'
import { blockStep, inlineStep } from '../shared/roving.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form-state.js'
import { asValueList, isEmptyList, lowered } from './options.js'
import { BINDING_PROPS, CONTROL_ID, createShell, LABEL_ID, SHELL_PROPS } from './shell.js'
import { treeSelectStyles } from './tree-select-css.js'
import { closeOnTabOut } from '../shared/tab-out.js'

const NAME = 'treeSelect'

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  'items',
  'placeholder',
  'searchPlaceholder',
  'validate',
  'validateAsync',
]

const PANEL_ID = 'panel'

const VALUE_ID = 'value'

const SEARCH_ID = 'search'

const TREE_ID = 'tree'

const SEARCH_KEY = 'imp.treeSelect.search'

const NO_MATCHES_KEY = 'imp.treeSelect.noMatches'

const MORE_KEY = 'imp.treeSelect.more'

const CLEAR_KEY = 'imp.treeSelect.clear'

const SELECTED_KEY = 'imp.treeSelect.selected'

const WITH_CHILDREN_KEY = 'imp.treeSelect.withChildren'

const ONLY_SELF_KEY = 'imp.treeSelect.onlySelf'

const WITH_SOME_KEY = 'imp.treeSelect.withSome'

const messages = {
  ...FORM_MESSAGES,
  [SEARCH_KEY]: 'Search',
  [NO_MATCHES_KEY]: 'No matches',
  [MORE_KEY]: '{label} +{count}',
  [CLEAR_KEY]: 'Clear',
  [SELECTED_KEY]: '{count} selected',
  [WITH_CHILDREN_KEY]: 'Everything below is selected too',
  [ONLY_SELF_KEY]: 'Only this item is selected',
  [WITH_SOME_KEY]: 'Some items below are selected too',
}

const MARK_NONE = 'none'

const MARK_CHECKED = 'checked'

const MARK_ALL = 'all'

const MARK_MIXED = 'mixed'

const ARIA_CHECKED = {
  [MARK_NONE]: 'false',
  [MARK_CHECKED]: 'true',
  [MARK_ALL]: 'true',
  [MARK_MIXED]: 'mixed',
}

const isBlank = (value) => value === undefined || value === null || value === ''

const isTypedCharacter = (event) =>
  event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey

const descendantsOf = (entry) => entry.children.flatMap((child) => [child, ...descendantsOf(child)])

const isParent = (entry) => entry.children.length > 0

const highlighted = (label, query) => {
  if (query === '') return [label]
  const at = lowered(NAME, label).indexOf(query)
  if (at === -1) return [label]
  const end = at + query.length
  return [label.slice(0, at), el('mark', {}, label.slice(at, end)), label.slice(end)]
}

const definition = {
  styles: treeSelectStyles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the tree as 'items'`)
    }
    if (props.items === undefined) {
      impLogger.warn(`${NAME}: has nothing to choose from - pass 'items'`)
    }
    const binding = createFieldBinding(NAME, props, { self, emptyWhen: isEmptyList })

    let entries = new Map()
    let rowCount = 0
    const entryByNode = new WeakMap()
    const folded = new Set()
    let shown = new Set()
    let query = ''
    let focusValue = null
    let placeholder = ''
    let disabled = false
    let open = false
    let heldFocus = false

    const chosenValues = () => asValueList(binding.read())

    const valueText = document.createTextNode('')
    const valueBox = span({ class: 'value', id: VALUE_ID }, valueText)
    const trigger = el(
      'button',
      {
        id: CONTROL_ID,
        class: 'trigger',
        type: 'button',
        'aria-haspopup': 'dialog',
        'aria-expanded': 'false',
        events: {
          blur: () => {
            if (open) return
            binding.leave()
            binding.check()
          },
          keydown: (event) => {
            if (open || blockStep(event.key) === 0) return
            event.preventDefault()
            panel.showPopover()
          },
        },
      },
      valueBox,
      chevronDownIcon('chevron'),
    )

    const clearLabel = createState('imp.treeSelect.clearLabel', t(CLEAR_KEY))
    const noneChosen = createState('imp.treeSelect.noneChosen', true)
    const clearAll = (focusTarget) => {
      commit([])
      focusTarget.focus()
    }
    const clearBox = props.required
      ? null
      : span(
          { class: 'clear', hidden: true },
          button(
            {
              variant: 'ghost',
              size: 'sm',
              square: true,
              label: clearLabel,
              events: { click: () => clearAll(trigger) },
            },
            icon(luX, { size: 'sm' }),
          ),
        )

    const search = el('input', {
      id: SEARCH_ID,
      class: 'search',
      type: 'text',
      autocomplete: 'off',
      autocapitalize: 'none',
      spellcheck: 'false',
      'aria-controls': TREE_ID,
    })
    const status = div({ class: 'status', role: 'status' })
    const tree = ul({ id: TREE_ID, class: 'tree', role: 'tree', 'aria-multiselectable': 'true' })
    const countText = document.createTextNode('')
    const footer = div(
      { class: 'footer' },
      span({ class: 'count', 'aria-live': 'polite' }, countText),
      button(
        {
          variant: 'ghost',
          size: 'sm',
          disabled: noneChosen,
          events: { click: () => clearAll(search) },
        },
        lang.text(() => t(CLEAR_KEY)),
      ),
    )
    const panel = div(
      { id: PANEL_ID, class: 'panel', role: 'dialog', popover: 'auto' },
      div(
        { class: 'search-box' },
        span({ class: 'search-glyph' }, icon(luSearch, { size: 'sm' })),
        search,
      ),
      status,
      div({ class: 'scroller' }, tree),
      footer,
    )
    trigger.popoverTargetElement = panel
    const picker = div({ class: 'picker' }, trigger, clearBox, panel)

    if (props.label !== undefined) {
      tree.setAttribute('aria-labelledby', LABEL_ID)
      panel.setAttribute('aria-labelledby', LABEL_ID)
    } else if (props.ariaLabel !== undefined) {
      bindValue(self, props.ariaLabel, (value) => {
        tree.setAttribute('aria-label', String(value))
        panel.setAttribute('aria-label', String(value))
      })
    }

    const buildEntries = (items, level, parent) => {
      if (!Array.isArray(items)) {
        impLogger.warn(`${NAME}: 'items' must be an array of { value, label, children } - skipping`)
        return []
      }
      return items.flatMap((item) => {
        if (!item || typeof item !== 'object' || isBlank(item.value)) {
          impLogger.warn(`${NAME}: an item is not an object with a 'value' - skipping it`)
          return []
        }
        const value = String(item.value)
        if (entries.has(value)) {
          impLogger.warn(`${NAME}: two items share the value '${value}' - values must be unique`)
          return []
        }
        const entry = {
          value,
          label: String(item.label ?? value),
          parent,
          level,
          children: [],
          highlight: '',
        }
        entries.set(value, entry)
        entry.children = buildEntries(item.children ?? [], level + 1, entry)
        return [entry]
      })
    }

    const renderEntry = (entry) => {
      const id = `item-${rowCount++}`
      entry.labelBox = span({ class: 'item-label', id: `${id}-label` }, entry.label)
      entry.hint = isParent(entry) ? span({ class: 'hint', id: `${id}-hint` }) : null
      entry.toggle = span(
        { class: ['toggle', isParent(entry) && 'fold'], 'aria-hidden': 'true' },
        isParent(entry) ? chevronIcon('chevron') : null,
      )
      entry.node = li(
        {
          id,
          role: 'treeitem',
          tabindex: '-1',
          'aria-labelledby': entry.labelBox.id,
          'aria-level': String(entry.level + 1),
          'aria-checked': 'false',
          ...(entry.hint ? { 'aria-describedby': entry.hint.id } : {}),
        },
        div(
          { class: 'row', style: { '--level': String(entry.level) } },
          entry.toggle,
          span({ class: 'mark' }, selectionMarkIcon()),
          entry.labelBox,
          entry.hint,
        ),
      )
      entryByNode.set(entry.node, entry)
      if (isParent(entry)) {
        entry.group = ul({ role: 'group' }, ...entry.children.map(renderEntry))
        entry.node.append(entry.group)
      }
      return entry.node
    }

    const roots = () => [...entries.values()].filter((entry) => entry.parent === null)

    const isFiltering = () => query !== ''

    const canExpand = (entry) => entry.children.some((child) => shown.has(child))

    const isExpanded = (entry) => canExpand(entry) && (isFiltering() || !folded.has(entry.value))

    const visibleBelow = (list) =>
      list
        .filter((entry) => shown.has(entry))
        .flatMap((entry) => [entry, ...(isExpanded(entry) ? visibleBelow(entry.children) : [])])

    const visibleRows = () => visibleBelow(roots())

    const markOf = (entry, chosen) => {
      const below = descendantsOf(entry)
      if (chosen.has(entry.value)) {
        if (below.length === 0) return MARK_CHECKED
        return below.every((child) => chosen.has(child.value)) ? MARK_ALL : MARK_CHECKED
      }
      return below.some((child) => chosen.has(child.value)) ? MARK_MIXED : MARK_NONE
    }

    const filter = () => {
      if (!isFiltering()) {
        shown = new Set(entries.values())
        return
      }
      shown = new Set()
      for (const entry of entries.values()) {
        if (!lowered(NAME, entry.label).includes(query)) continue
        for (let cursor = entry; cursor !== null; cursor = cursor.parent) shown.add(cursor)
      }
    }

    const labelOf = (value) => entries.get(value)?.label ?? value

    const paintValue = () => {
      const values = chosenValues()
      const text =
        values.length === 0
          ? placeholder
          : values.length === 1
            ? labelOf(values[0])
            : t(MORE_KEY, { label: labelOf(values[0]), count: values.length - 1 })
      if (valueText.data !== text) valueText.data = text
      valueBox.classList.toggle('placeholder', values.length === 0)
      noneChosen.set(values.length === 0)
      const count = t(SELECTED_KEY, { count: values.length })
      if (countText.data !== count) countText.data = count
      if (clearBox !== null) clearBox.hidden = values.length === 0 || disabled
      picker.classList.toggle('clearable', clearBox !== null && !clearBox.hidden)
    }

    const paintTree = () => {
      const chosen = new Set(chosenValues())
      const rows = visibleRows()
      const focusEntry = entries.get(focusValue)
      const tabStop = rows.includes(focusEntry) ? focusEntry : (rows[0] ?? null)
      for (const entry of entries.values()) {
        const mark = markOf(entry, chosen)
        entry.node.hidden = !shown.has(entry)
        entry.node.dataset.mark = mark
        entry.node.setAttribute('aria-checked', ARIA_CHECKED[mark])
        entry.node.tabIndex = entry === tabStop ? 0 : -1
        if (entry.highlight !== query) {
          entry.highlight = query
          entry.labelBox.replaceChildren(...highlighted(entry.label, query))
        }
        if (!isParent(entry)) continue
        const hint =
          mark === MARK_ALL
            ? t(WITH_CHILDREN_KEY)
            : mark !== MARK_CHECKED
              ? ''
              : descendantsOf(entry).some((child) => chosen.has(child.value))
                ? t(WITH_SOME_KEY)
                : t(ONLY_SELF_KEY)
        if (entry.hint.textContent !== hint) entry.hint.textContent = hint
        entry.group.hidden = !isExpanded(entry)
        if (canExpand(entry)) entry.node.setAttribute('aria-expanded', String(isExpanded(entry)))
        else entry.node.removeAttribute('aria-expanded')
      }
      const message = rows.length === 0 ? t(NO_MATCHES_KEY) : ''
      if (status.textContent !== message) status.textContent = message
    }

    const paint = () => {
      paintValue()
      paintTree()
    }

    const ordered = (chosen) => {
      const known = [...entries.keys()].filter((value) => chosen.has(value))
      const unknown = chosenValues().filter((value) => !entries.has(value) && chosen.has(value))
      return [...known, ...unknown]
    }

    function commit(next) {
      binding.touch()
      binding.commit(next)
      binding.check()
    }

    const cycle = (entry) => {
      if (disabled) return
      const chosen = new Set(chosenValues())
      const below = descendantsOf(entry).map((child) => child.value)
      const mark = markOf(entry, chosen)
      if (below.length === 0) {
        if (!chosen.delete(entry.value)) chosen.add(entry.value)
      } else if (mark === MARK_ALL) {
        for (const value of below) chosen.delete(value)
      } else if (mark === MARK_CHECKED) {
        chosen.delete(entry.value)
      } else {
        for (const value of [entry.value, ...below]) chosen.add(value)
      }
      commit(ordered(chosen))
    }

    const focusedEntry = () => entryByNode.get(tree.getRootNode().activeElement) ?? null

    const focusOn = (entry) => {
      if (!entry) return
      focusValue = entry.value
      paintTree()
      entry.node.focus()
      entry.node.scrollIntoView({ block: 'nearest' })
    }

    const setFolded = (entry, wanted) => {
      if (!canExpand(entry) || isFiltering() || folded.has(entry.value) === wanted) return
      if (wanted) folded.add(entry.value)
      else folded.delete(entry.value)
      paintTree()
    }

    const moveForward = (entry) => {
      if (!canExpand(entry)) return
      if (isExpanded(entry)) focusOn(entry.children.find((child) => shown.has(child)))
      else setFolded(entry, false)
    }

    const moveBack = (entry) => {
      if (isExpanded(entry) && !isFiltering()) setFolded(entry, true)
      else focusOn(entry.parent)
    }

    const entryOf = (node) => entryByNode.get(node?.closest?.('[role="treeitem"]')) ?? null

    tree.addEventListener('click', (event) => {
      const entry = entryOf(event.target)
      if (entry === null) return
      focusValue = entry.value
      if (event.target.closest('.fold') && canExpand(entry) && !isFiltering()) {
        setFolded(entry, !folded.has(entry.value))
      } else cycle(entry)
      entry.node.focus()
    })

    tree.addEventListener('focusin', (event) => {
      const entry = entryOf(event.target)
      if (entry === null || entry.value === focusValue) return
      focusValue = entry.value
      paintTree()
    })

    tree.addEventListener('keydown', (event) => {
      const entry = entryOf(event.target)
      if (entry === null) return
      if (isTypedCharacter(event) || event.key === 'Backspace') {
        search.focus()
        return
      }
      const rows = visibleRows()
      const index = rows.indexOf(entry)
      const block = blockStep(event.key)
      const inline = inlineStep(event.key, tree)
      if (block === -1 && index === 0) search.focus()
      else if (block !== 0) focusOn(rows[index + block])
      else if (inline === 1) moveForward(entry)
      else if (inline === -1) moveBack(entry)
      else if (event.key === 'Home') focusOn(rows[0])
      else if (event.key === 'End') focusOn(rows.at(-1))
      else if (event.key === 'Enter' || event.key === ' ') cycle(entry)
      else return
      event.preventDefault()
      event.stopPropagation()
    })

    search.addEventListener('input', () => {
      query = lowered(NAME, search.value.trim())
      focusValue = null
      filter()
      paintTree()
    })

    search.addEventListener('keydown', (event) => {
      if (event.isComposing) return
      if (event.key !== 'ArrowDown' && event.key !== 'Enter') return
      event.preventDefault()
      event.stopPropagation()
      const rows = visibleRows()
      focusOn(rows.includes(entries.get(focusValue)) ? entries.get(focusValue) : rows[0])
    })

    closeOnTabOut(panel)

    panel.addEventListener('beforetoggle', (event) => {
      open = event.newState === 'open'
      trigger.setAttribute('aria-expanded', String(open))
      heldFocus = !open && panel.contains(panel.getRootNode().activeElement)
      if (!open) return
      search.value = ''
      query = ''
      focusValue = ordered(new Set(chosenValues()))[0] ?? null
      filter()
      paintTree()
    })

    panel.addEventListener('toggle', (event) => {
      if (event.newState === 'open') return search.focus()
      if (heldFocus) trigger.focus()
      binding.leave()
      binding.check()
    })

    bindValue(self, props.placeholder, (value) => {
      placeholder = isBlank(value) ? '' : String(value)
      paintValue()
    })
    bindValue(self, props.searchPlaceholder, (value) => {
      if (isBlank(value)) search.removeAttribute('placeholder')
      else search.setAttribute('placeholder', String(value))
    })
    bindValue(self, props.disabled, (value) => {
      disabled = Boolean(value)
      trigger.disabled = disabled
      if (disabled && open) panel.hidePopover()
      paintValue()
    })
    bindValue(self, props.items, (value) => {
      const keepFocus = focusedEntry()?.value ?? null
      entries = new Map()
      const top = buildEntries(value ?? [], 0, null)
      tree.replaceChildren(...top.map(renderEntry))
      filter()
      paint()
      if (keepFocus !== null) entries.get(keepFocus)?.node.focus()
    })
    stopOnRemove(self, binding.watch(paint))
    lang.watch(self, () => {
      search.setAttribute('aria-label', t(SEARCH_KEY))
      clearLabel.set(t(CLEAR_KEY))
      paint()
    })

    const shell = createShell(self, props, trigger, { presented: picker, describedBy: [VALUE_ID] })
    shell.attach(binding)
    return shell.root
  },
}

export const treeSelect = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(messages),
  )(...args)
