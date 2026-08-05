import { defineComponent } from '../shared/define.js'
import { a, div, input, kbd, mark, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { url } from '../../router.js'
import { impLogger } from '../../logger.js'
import { bindValue } from '../shared/args.js'
import { fuzzyMatch } from '../shared/fuzzy.js'
import { followHref, opensElsewhere } from '../shared/links.js'
import { focusRing, fontFamily, forcedColors, hiddenRule, token } from '../shared/css.js'
import { searchIcon } from '../shared/icons.js'

const NAME = 'commandPalette'

const KNOWN_PROPS = [
  'items',
  'label',
  'placeholder',
  'shortcut',
  'limit',
  'emptyMessage',
  'events',
]

const SELECT_EVENT = 'select'

const LISTBOX_ID = 'results'
const OPTION_ID = 'option-'

const DEFAULT_LIMIT = 50

const LABEL_MATCH_BONUS = 30

const messages = {
  'imp.palette.label': 'Search',
  'imp.palette.placeholder': 'Search',
  'imp.palette.noMatches': 'No matches',
  'imp.palette.results': '{count} results',
}

const MODIFIER_KEYWORDS = {
  ctrl: 'ctrl',
  cmd: 'ctrl',
  meta: 'ctrl',
  mod: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
}

const APPLE_SYMBOLS = { ctrl: '⌘', alt: '⌥', shift: '⇧' }
const KEY_WORDS = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift' }

const styles = () => `
  ${hiddenRule}

  .root {
    position: relative;
    ${fontFamily()}
    inline-size: 100%;
    min-inline-size: 0;
  }

  .field {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    box-sizing: border-box;
    inline-size: 100%;
    padding-inline: ${token('space-3')};
    background-color: ${token('color-surface')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-lg')};
    transition: border-color ${token('duration-fast')} ease-out;
  }

  .field:hover {
    border-color: ${token('color-primary')};
  }

  .field:focus-within {${focusRing()}}

  .icon {
    flex: none;
    inline-size: 1.15em;
    block-size: 1.15em;
    color: ${token('color-secondary')};
  }

  input {
    flex: 1;
    min-inline-size: 0;
    margin: 0;
    border: none;
    padding-block: ${token('space-3')};
    padding-inline: 0;
    background-color: transparent;
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-tight')};
  }

  input:focus {
    outline: none;
  }

  input::placeholder {
    color: ${token('color-secondary')};
  }

  input::-webkit-search-cancel-button {
    display: none;
  }

  kbd {
    flex: none;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-sm')};
    padding-block: 2px;
    padding-inline: ${token('space-2')};
    background-color: ${token('color-surface-hover')};
    color: ${token('color-secondary')};
    font-family: ${token('font-family-mono')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
    white-space: nowrap;
  }

  .results {
    position: absolute;
    inset-inline: 0;
    inset-block-start: calc(100% + ${token('space-1')});
    z-index: 30;
    max-block-size: min(60vh, 32rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-block: ${token('space-1')};
    background-color: ${token('color-surface')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-lg')};
    box-shadow: ${token('shadow-lg')};
  }

  .option {
    display: flex;
    align-items: baseline;
    gap: ${token('space-3')};
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    border-inline-start: ${token('focus-ring-width')} solid transparent;
    color: ${token('color-text')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
    text-decoration: none;
    cursor: pointer;
  }

  .option[aria-selected='true'] {
    background-color: ${token('color-surface-hover')};
    border-inline-start-color: ${token('color-primary')};
  }

  .option[aria-disabled='true'] {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .path {
    min-inline-size: 0;
    font-family: ${token('font-family-mono')};
    overflow-wrap: anywhere;
  }

  .group {
    color: ${token('color-secondary')};
  }

  mark {
    background-color: transparent;
    color: ${token('color-primary')};
    font-weight: ${token('font-weight-bold')};
  }

  .description {
    margin-inline-start: auto;
    color: ${token('color-secondary')};
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .empty {
    padding-block: ${token('space-4')};
    padding-inline: ${token('space-3')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    text-align: center;
  }

  .status {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .field { transition: none }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .option[aria-selected='true'] {
      background-color: Highlight;
      color: HighlightText;
    }

    mark {
      color: inherit;
      text-decoration: underline;
    }
  }
`

const normalizeItems = (value) => {
  if (!Array.isArray(value)) {
    impLogger.warn(`${NAME}: 'items' must be an array of { id, label, group, href } - showing none`)
    return []
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || entry.label === undefined) {
      impLogger.warn(`${NAME}: an item is not an object with a 'label' - skipping it`)
      return []
    }
    const label = String(entry.label)
    const group = entry.group === undefined || entry.group === null ? '' : String(entry.group)
    return [{
      id: entry.id === undefined ? String(index) : String(entry.id),
      label,
      group,
      path: group === '' ? label : `${group}/${label}`,
      description: entry.description === undefined ? '' : String(entry.description),
      href: typeof entry.href === 'string' && entry.href !== '' ? entry.href : null,
      disabled: Boolean(entry.disabled),
    }]
  })
}

const matchItem = (item, query) => {
  const onLabel = fuzzyMatch(item.label, query)
  const offset = item.path.length - item.label.length
  if (onLabel) {
    return {
      score: onLabel.score + LABEL_MATCH_BONUS,
      matched: onLabel.matched.map((index) => index + offset),
    }
  }
  return fuzzyMatch(item.path, query)
}

const rankedMatches = (items, query, limit) =>
  items
    .map((item, index) => ({ item, index, ...(matchItem(item, query) ?? {}) }))
    .filter((entry) => entry.matched !== undefined)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)

const highlightedText = (text, matched, offset) => {
  const nodes = []
  let plain = ''
  let marked = ''
  const flushPlain = () => {
    if (plain !== '') nodes.push(document.createTextNode(plain))
    plain = ''
  }
  const flushMarked = () => {
    if (marked !== '') nodes.push(mark(marked))
    marked = ''
  }
  for (let index = 0; index < text.length; index++) {
    if (matched.has(index + offset)) {
      flushPlain()
      marked += text[index]
      continue
    }
    flushMarked()
    plain += text[index]
  }
  flushPlain()
  flushMarked()
  return nodes
}

const parseShortcut = (value) => {
  if (value === undefined || value === null) return null
  const parts = String(value).toLowerCase().split('+').map((part) => part.trim()).filter(Boolean)
  const key = parts.pop()
  if (!key) {
    impLogger.warn(
      `${NAME}: 'shortcut' must name a key, like 'ctrl+p' - got '${value}', ignoring it`,
    )
    return null
  }
  const modifiers = { ctrl: false, alt: false, shift: false }
  for (const part of parts) {
    const modifier = MODIFIER_KEYWORDS[part]
    if (!modifier) {
      impLogger.warn(
        `${NAME}: 'shortcut' has no modifier '${part}' - use 'ctrl', 'alt' or 'shift', like 'ctrl+p'`,
      )
      continue
    }
    modifiers[modifier] = true
  }
  return { ...modifiers, key }
}

const onApplePlatform = () => {
  const platform = globalThis.navigator?.userAgentData?.platform ??
    globalThis.navigator?.platform ?? ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

const shortcutHint = (shortcut) => {
  const apple = onApplePlatform()
  const parts = ['ctrl', 'alt', 'shift']
    .filter((modifier) => shortcut[modifier])
    .map((modifier) => (apple ? APPLE_SYMBOLS[modifier] : KEY_WORDS[modifier]))
  parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key)
  return apple ? parts.join('') : parts.join(' ')
}

const matchesShortcut = (event, shortcut) =>
  event.key.toLowerCase() === shortcut.key &&
  (event.ctrlKey || event.metaKey) === shortcut.ctrl &&
  event.altKey === shortcut.alt && event.shiftKey === shortcut.shift

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass every destination as 'items'`)
    }
    const limit = Number.isInteger(props.limit) && props.limit > 0 ? props.limit : DEFAULT_LIMIT
    const shortcut = parseShortcut(props.shortcut)

    const control = input({
      id: 'control',
      type: 'text',
      role: 'combobox',
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-autocomplete': 'list',
      'aria-expanded': 'false',
      'aria-controls': LISTBOX_ID,
    })
    const hint = shortcut === null ? null : kbd({ 'aria-hidden': 'true' }, shortcutHint(shortcut))
    const listbox = div({ id: LISTBOX_ID, role: 'listbox', class: 'listbox' })
    const results = div({ class: 'results', hidden: true }, listbox)
    const status = div({ class: 'status', role: 'status' })
    const root = div(
      { class: 'root', events: props.events },
      div({ class: 'field' }, searchIcon(), control, hint),
      results,
      status,
    )

    let items = []
    let shown = []
    let options = []
    let activeIndex = -1
    let open = false

    const paintActive = () => {
      for (const [index, option] of options.entries()) {
        option.setAttribute('aria-selected', String(index === activeIndex))
      }
      const active = options[activeIndex]
      if (active) {
        control.setAttribute('aria-activedescendant', active.id)
        active.scrollIntoView?.({ block: 'nearest' })
        return
      }
      control.removeAttribute('aria-activedescendant')
    }

    const optionNode = (entry, index) => {
      const { item } = entry
      const matched = new Set(entry.matched)
      const offset = item.path.length - item.label.length
      const content = [
        span(
          { class: 'path' },
          item.group === ''
            ? null
            : span({ class: 'group' }, ...highlightedText(`${item.group}/`, matched, 0)),
          span({ class: 'label' }, ...highlightedText(item.label, matched, offset)),
        ),
        item.description === '' ? null : span({ class: 'description' }, item.description),
      ]
      const shared = {
        class: 'option',
        id: `${OPTION_ID}${index}`,
        role: 'option',
        'aria-selected': 'false',
        events: {
          click: (event) => {
            if (opensElsewhere(event)) return
            event.preventDefault()
            activate(index)
          },
          pointerenter: () => {
            if (item.disabled) return
            activeIndex = index
            paintActive()
          },
        },
      }
      if (item.disabled) shared['aria-disabled'] = 'true'
      return item.href === null
        ? div(shared, ...content)
        : a({ ...shared, href: url(item.href) }, ...content)
    }

    const firstEnabled = () => shown.findIndex(({ item }) => !item.disabled)

    const paintResults = () => {
      options = shown.map(optionNode)
      listbox.replaceChildren(...options)
      if (options.length === 0) {
        listbox.append(
          div(
            { class: 'empty' },
            props.emptyMessage === undefined
              ? t('imp.palette.noMatches')
              : String(props.emptyMessage),
          ),
        )
      }
      activeIndex = firstEnabled()
      paintActive()
      status.textContent = t('imp.palette.results', { count: options.length })
    }

    const filter = () => {
      shown = rankedMatches(items, control.value, limit)
      paintResults()
    }

    const setOpen = (next) => {
      if (open === next) return
      open = next
      results.hidden = !open
      control.setAttribute('aria-expanded', String(open))
      if (open) paintActive()
      else control.removeAttribute('aria-activedescendant')
    }

    const activate = (index) => {
      const entry = shown[index]
      if (!entry || entry.item.disabled) return
      setOpen(false)
      const followed = root.dispatchEvent(
        new CustomEvent(SELECT_EVENT, {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { id: entry.item.id, item: entry.item },
        }),
      )
      const { href } = entry.item
      if (followed && href !== null) followHref(href)
    }

    const move = (step) => {
      if (options.length === 0) return
      let cursor = activeIndex === -1 ? (step === 1 ? -1 : 0) : activeIndex
      for (let attempt = 0; attempt < options.length; attempt++) {
        cursor = (cursor + step + options.length) % options.length
        if (!shown[cursor].item.disabled) {
          activeIndex = cursor
          paintActive()
          return
        }
      }
    }

    control.addEventListener('input', () => {
      hint?.toggleAttribute('hidden', control.value !== '')
      setOpen(true)
      filter()
    })

    control.addEventListener('focus', () => setOpen(true))

    control.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        setOpen(true)
        move(event.key === 'ArrowDown' ? 1 : -1)
      } else if (event.key === 'Enter') {
        if (!open || activeIndex === -1) return
        activate(activeIndex)
      } else if (event.key === 'Escape') {
        if (control.value !== '') {
          control.value = ''
          hint?.removeAttribute('hidden')
          filter()
          return
        }
        if (!open) return
        setOpen(false)
      } else {
        return
      }
      event.preventDefault()
    })

    root.addEventListener('focusout', (event) => {
      if (!root.contains(event.relatedTarget)) setOpen(false)
    })

    if (shortcut !== null) {
      document.addEventListener('keydown', (event) => {
        if (!matchesShortcut(event, shortcut)) return
        event.preventDefault()
        control.focus()
        control.select?.()
        setOpen(true)
      }, { signal: instance.abortSignal })
    }

    let label = props.label
    let placeholder = props.placeholder

    const paintWording = () => {
      const name = label === undefined ? t('imp.palette.label') : String(label)
      control.setAttribute('aria-label', name)
      control.placeholder = placeholder === undefined
        ? t('imp.palette.placeholder')
        : String(placeholder)
      listbox.setAttribute('aria-label', name)
    }

    bindValue(props.label, (value) => {
      label = value
      paintWording()
    })
    bindValue(props.placeholder, (value) => {
      placeholder = value
      paintWording()
    })
    lang.watch(() => {
      paintWording()
      paintResults()
    })
    bindValue(props.items ?? [], (value) => {
      items = normalizeItems(value)
      filter()
    })
    return root
  },
}

export const commandPalette = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
