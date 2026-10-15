import { defineComponent } from '../shared/define.js'
import { div, el, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import { icon } from '../general/icon.js'
import { luCheck } from '../../icons/lucide-icons.js'
import { chevronDownIcon, closeIcon } from '../shared/icons.js'
import { comboBoxStyles } from './combo-box-css.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form-state.js'
import { asValueList, isEmptyList, lowered as lowerCased, normalizeOptions } from './options.js'
import { BINDING_PROPS, CONTROL_ID, createShell, SHELL_PROPS } from './shell.js'

const NAME = 'comboBox'

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  'options',
  'multiple',
  'custom',
  'onSearch',
  'minSearch',
  'placeholder',
  'validate',
  'validateAsync',
]

const LISTBOX_ID = 'listbox'

const SEARCH_DELAY = 250

const SEPARATOR = ','

const NO_MATCHES_KEY = 'imp.comboBox.noMatches'

const SEARCHING_KEY = 'imp.comboBox.searching'

const REMOVE_KEY = 'imp.comboBox.remove'

const messages = {
  [NO_MATCHES_KEY]: 'No matches',
  [SEARCHING_KEY]: 'Searching',
  [REMOVE_KEY]: 'Remove {label}',
}

const lowered = (text) => lowerCased(NAME, text)

const isBlank = (value) => value === undefined || value === null || value === ''

const readOnSearch = (onSearch) => {
  if (onSearch === undefined) return null
  if (typeof onSearch === 'function') return onSearch
  impLogger.warn(`${NAME}: 'onSearch' must be a function of the text that returns the options`)
  return null
}

const readMinSearch = (value, onSearch) => {
  if (value === undefined) return 0
  if (onSearch === null) {
    impLogger.warn(`${NAME}: 'minSearch' applies to 'onSearch' only - ignoring it`)
    return 0
  }
  if (Number.isInteger(value) && value >= 0) return value
  impLogger.warn(`${NAME}: 'minSearch' must be a whole number of characters - using 0`)
  return 0
}

const definition = {
  styles: comboBoxStyles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the choices as 'options'`)
    }
    const multiple = Boolean(props.multiple)
    const custom = Boolean(props.custom)
    const onSearch = readOnSearch(props.onSearch)
    const minSearch = readMinSearch(props.minSearch, onSearch)
    if (props.options === undefined && !custom && !onSearch) {
      impLogger.warn(`${NAME}: has nothing to choose from - pass 'options', 'onSearch' or 'custom'`)
    }
    const binding = createFieldBinding(NAME, props, {
      self,
      emptyWhen: multiple ? isEmptyList : undefined,
    })

    const labels = new Map()
    const remember = (options) => {
      for (const { value, label } of options) labels.set(value, label)
      return options
    }
    const labelOf = (value) => labels.get(value) ?? value

    const known = remember(normalizeOptions(NAME, props.options ?? []))
    let choices = known
    let visible = []
    let active = -1
    let open = false
    let typed = false
    let searching = false
    let searchRun = 0
    let searchTimer = null
    let searchAbort = null
    let disabled = false

    const chosenValues = () => asValueList(binding.read())

    const control = el('input', {
      id: CONTROL_ID,
      type: 'text',
      role: 'combobox',
      autocomplete: 'off',
      autocapitalize: 'none',
      spellcheck: 'false',
      'aria-autocomplete': 'list',
      'aria-expanded': 'false',
      'aria-controls': LISTBOX_ID,
      ...(props.placeholder === undefined ? {} : { placeholder: String(props.placeholder) }),
    })
    const listbox = div({
      id: LISTBOX_ID,
      class: 'listbox',
      role: 'listbox',
      'aria-busy': 'false',
      ...(multiple ? { 'aria-multiselectable': 'true' } : {}),
    })
    const status = div({ class: 'status', role: 'status' })
    const panel = div({ class: 'panel', popover: 'manual' }, status, listbox)
    const chips = multiple ? div({ class: 'chips', role: 'list' }) : null
    const hasList = choices.length > 0 || onSearch !== null
    const frame = div(
      { class: 'frame' },
      chips,
      control,
      hasList ? chevronDownIcon('chevron') : null,
    )
    const root = div({ class: 'combo' }, frame, panel)

    const query = () => (typed ? control.value.trim() : '')

    const matchOf = (text) => {
      const wanted = lowered(text)
      return choices.find(({ label, disabled: blocked }) => !blocked && lowered(label) === wanted)
    }

    const setActive = (index) => {
      listbox.children[active]?.classList.remove('active')
      active = index
      const row = listbox.children[active]
      if (!row) return control.removeAttribute('aria-activedescendant')
      row.classList.add('active')
      control.setAttribute('aria-activedescendant', row.id)
      row.scrollIntoView({ block: 'nearest' })
    }

    const renderList = () => {
      const text = lowered(query())
      visible =
        onSearch || text === ''
          ? choices
          : choices.filter(({ label }) => lowered(label).includes(text))
      const chosen = new Set(chosenValues())
      listbox.replaceChildren(
        ...visible.map((option, index) =>
          div(
            {
              class: 'option',
              id: `option-${index}`,
              role: 'option',
              'aria-selected': String(chosen.has(option.value)),
              ...(option.disabled ? { 'aria-disabled': 'true' } : {}),
              events: { click: () => choose(option) },
            },
            span({ class: 'option-label' }, option.label),
            chosen.has(option.value) ? icon(luCheck, { size: '1em' }) : null,
          ),
        ),
      )
      listbox.setAttribute('aria-busy', String(searching))
      const message = searching ? t(SEARCHING_KEY) : visible.length === 0 ? t(NO_MATCHES_KEY) : ''
      if (status.textContent !== message) status.textContent = message
      active = -1
      control.removeAttribute('aria-activedescendant')
    }

    const firstUsable = (from, direction) => {
      let cursor = from
      for (let attempt = 0; attempt < visible.length; attempt++) {
        cursor = (cursor + direction + visible.length) % visible.length
        if (!visible[cursor].disabled) return cursor
      }
      return -1
    }

    const closePanel = () => {
      if (!open) return
      open = false
      panel.hidePopover()
      control.setAttribute('aria-expanded', 'false')
      setActive(-1)
    }

    const openPanel = () => {
      if (disabled) return
      renderList()
      if (custom && visible.length === 0 && !searching) return closePanel()
      if (!open) {
        open = true
        panel.showPopover()
        control.setAttribute('aria-expanded', 'true')
      }
      if (typed && !custom) return setActive(searching ? -1 : firstUsable(-1, 1))
      if (!multiple) {
        setActive(visible.findIndex(({ value }) => value === String(binding.read() ?? '')))
      }
    }

    const commit = (next) => {
      binding.touch()
      binding.commit(next)
      binding.check()
    }

    const toggleValue = (value) => {
      const current = chosenValues()
      commit(
        current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
      )
    }

    function choose(option) {
      if (option.disabled || disabled) return
      typed = false
      if (multiple) {
        control.value = ''
        toggleValue(option.value)
        openPanel()
        setActive(visible.indexOf(option))
        return
      }
      control.value = option.label
      commit(option.value)
      closePanel()
    }

    const showCurrent = () => {
      const value = binding.read()
      control.value = multiple || isBlank(value) ? '' : labelOf(String(value))
    }

    const commitText = () => {
      const text = control.value.trim()
      const wasTyped = typed
      typed = false
      if (!wasTyped) return
      const match = text === '' ? null : matchOf(text)
      const next = match ? match.value : custom && text !== '' ? text : null
      if (multiple) {
        control.value = ''
        if (next !== null && !chosenValues().includes(next)) toggleValue(next)
        return
      }
      if (next !== null) commit(next)
      else if (text === '' && !isBlank(binding.read())) commit(undefined)
      showCurrent()
    }

    const splitTags = () => {
      if (!multiple || !custom || !control.value.includes(SEPARATOR)) return
      const parts = control.value.split(SEPARATOR)
      const rest = parts.pop()
      const current = chosenValues()
      const added = parts
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => matchOf(part)?.value ?? part)
      const next = [...new Set([...current, ...added])]
      control.value = rest.trimStart()
      if (next.length !== current.length) commit(next)
    }

    const dropSearch = () => {
      clearTimeout(searchTimer)
      searchAbort?.abort()
      searchAbort = null
      searchRun += 1
    }

    const runSearch = async (run) => {
      searchAbort = new AbortController()
      try {
        const found = await onSearch(control.value.trim(), { signal: searchAbort.signal })
        if (run === searchRun) choices = remember(normalizeOptions(NAME, found ?? []))
      } catch (error) {
        if (run === searchRun) {
          impLogger.error(`${NAME}: 'onSearch' failed`, error)
          choices = []
        }
      }
      if (run !== searchRun) return
      searching = false
      if (open) openPanel()
    }

    const search = () => {
      dropSearch()
      if (control.value.trim().length < minSearch) {
        searching = false
        choices = known
        return
      }
      const run = searchRun
      searching = true
      searchTimer = setTimeout(() => {
        runSearch(run)
      }, SEARCH_DELAY)
    }

    const move = (direction) => {
      if (!open) {
        openPanel()
        if (active !== -1) return
      }
      const from = active === -1 && direction === -1 ? 0 : active
      setActive(firstUsable(from, direction))
    }

    const onEscape = () => {
      if (open) {
        closePanel()
        return true
      }
      if (control.value === '') return false
      control.value = ''
      typed = false
      if (!multiple && !isBlank(binding.read())) commit(undefined)
      return true
    }

    const onEnter = () => {
      if (!open && !typed) return false
      if (open && active !== -1) choose(visible[active])
      else commitText()
      if (!multiple || active === -1) closePanel()
      return true
    }

    const onBackspace = () => {
      if (!multiple || control.value !== '') return false
      const current = chosenValues()
      if (current.length > 0) commit(current.slice(0, -1))
      return false
    }

    const moveTo = (index) => {
      setActive(index)
      return true
    }

    const handlers = {
      ArrowDown: () => {
        move(1)
        return true
      },
      ArrowUp: () => {
        move(-1)
        return true
      },
      Home: () => (open && active !== -1 ? moveTo(firstUsable(-1, 1)) : false),
      End: () => (open && active !== -1 ? moveTo(firstUsable(0, -1)) : false),
      Enter: onEnter,
      Escape: onEscape,
      Backspace: onBackspace,
    }

    control.addEventListener('keydown', (event) => {
      if (event.isComposing || !handlers[event.key]?.()) return
      event.preventDefault()
      event.stopPropagation()
    })

    control.addEventListener('input', () => {
      typed = true
      splitTags()
      if (onSearch) search()
      openPanel()
    })

    frame.addEventListener('mousedown', (event) => {
      if (event.target !== control && !event.target.closest?.('.remove')) event.preventDefault()
    })

    frame.addEventListener('click', (event) => {
      if (event.target.closest?.('.remove')) return
      control.focus()
      openPanel()
    })

    panel.addEventListener('mousedown', (event) => event.preventDefault())

    root.addEventListener('focusout', (event) => {
      if (root.contains(event.relatedTarget)) return
      closePanel()
      commitText()
      binding.leave()
      binding.check()
    })

    const renderChips = (values) => {
      chips.replaceChildren(
        ...values.map((value) =>
          span(
            { class: 'chip', role: 'listitem' },
            span({ class: 'chip-label' }, labelOf(value)),
            el(
              'button',
              {
                type: 'button',
                class: 'remove',
                disabled,
                'aria-label': t(REMOVE_KEY, { label: labelOf(value) }),
                events: {
                  click: () => {
                    toggleValue(value)
                    control.focus()
                  },
                },
              },
              closeIcon(),
            ),
          ),
        ),
      )
    }

    const repaint = () => {
      if (multiple) renderChips(chosenValues())
      else if (!typed) showCurrent()
      if (open) {
        const keep = active
        renderList()
        setActive(keep)
      }
    }

    bindValue(self, props.disabled, (value) => {
      disabled = Boolean(value)
      control.disabled = disabled
      if (disabled) closePanel()
      if (multiple) renderChips(chosenValues())
    })
    stopOnRemove(self, binding.watch(repaint))
    stopOnRemove(self, dropSearch)
    lang.watch(self, repaint)

    const shell = createShell(self, props, control, { presented: root })
    shell.attach(binding)
    return shell.root
  },
}

const registerMessages = () => {
  defaultMessages(FORM_MESSAGES)
  defaultMessages(messages)
}

export const comboBox = (...args) =>
  defineComponent(NAME, () => definition, registerMessages)(...args)
