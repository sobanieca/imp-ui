import { defineComponent } from '../shared/define.js'
import { div, el, output, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { createState } from '../../state.js'
import { luArrowRight, luCalendarRange, luClock } from '../../icons/lucide-icons.js'
import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import { chevronDownIcon } from '../shared/icons.js'
import { inlineStep, rovingMove, rovingPick } from '../shared/roving.js'
import {
  formatDate,
  formatDateTime,
  formatLocal,
  formatLocalRange,
  formatTime,
  isDateOnly,
  parseDate,
  parseDateTime,
  parseTime,
  startOfDay,
  today,
  withTime,
} from '../shared/dates.js'
import { createDateGrid, DATE_GRID_MESSAGES } from './date-grid.js'
import { dateRangePickerStyles } from './date-range-picker-css.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form-state.js'
import { BINDING_PROPS, CONTROL_ID, createShell, SHELL_PROPS } from './shell.js'

const NAME = 'dateRangePicker'

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  'presets',
  'min',
  'max',
  'time',
  'placeholder',
  'relativeLabel',
  'customLabel',
  'validate',
  'validateAsync',
]

const PANEL_ID = 'panel'

const VALUE_ID = 'value'

const RELATIVE = 'relative'

const CUSTOM = 'custom'

const MODES = [RELATIVE, CUSTOM]

const tabId = (mode) => `tab-${mode}`

const paneId = (mode) => `pane-${mode}`

const RELATIVE_KEY = 'imp.dateRangePicker.relative'

const CUSTOM_KEY = 'imp.dateRangePicker.custom'

const FROM_KEY = 'imp.dateRangePicker.from'

const TO_KEY = 'imp.dateRangePicker.to'

const APPLY_KEY = 'imp.dateRangePicker.apply'

const CANCEL_KEY = 'imp.dateRangePicker.cancel'

const CHOOSE_KEY = 'imp.dateRangePicker.choose'

const PICK_DAY_KEY = 'imp.dateRangePicker.pickDay'

const START_TIME_KEY = 'imp.dateRangePicker.startTime'

const END_TIME_KEY = 'imp.dateRangePicker.endTime'

const MODE_KEYS = { [RELATIVE]: RELATIVE_KEY, [CUSTOM]: CUSTOM_KEY }

const messages = {
  ...FORM_MESSAGES,
  ...DATE_GRID_MESSAGES,
  [RELATIVE_KEY]: 'Relative',
  [CUSTOM_KEY]: 'Custom',
  [FROM_KEY]: 'From',
  [TO_KEY]: 'To',
  [APPLY_KEY]: 'Apply',
  [CANCEL_KEY]: 'Cancel',
  [CHOOSE_KEY]: 'Choose a date range',
  [PICK_DAY_KEY]: 'Pick a day',
  [START_TIME_KEY]: 'Start time',
  [END_TIME_KEY]: 'End time',
}

const DAY_FORMAT = { dateStyle: 'medium' }

const MINUTE_FORMAT = { dateStyle: 'medium', timeStyle: 'short' }

const SECOND_FORMAT = { dateStyle: 'medium', timeStyle: 'medium' }

const START_TIME_ID = 'start-time'

const END_TIME_ID = 'end-time'

const DEFAULT_START_TIME = '00:00'

const DEFAULT_END_TIME = '23:59'

const SHAPE = "{ start, end } with dates like '2026-09-21' or moments like '2026-09-21T14:30'"

const NO_VALUE = { mode: null }

const NO_RANGE = { start: null, end: null }

const isBlank = (value) => value === undefined || value === null || value === ''

const isMoment = (text) => typeof text === 'string' && !isDateOnly(text)

const parseRange = (raw) => {
  const start = parseDateTime(raw?.start)
  const end = parseDateTime(raw?.end)
  if (!start || !end || start > end) return null
  return { start, end, timed: isMoment(raw.start) || isMoment(raw.end) }
}

const parseValue = (raw) => {
  if (isBlank(raw) || typeof raw !== 'object') return NO_VALUE
  if (!isBlank(raw.preset)) return { mode: RELATIVE, preset: String(raw.preset) }
  const range = parseRange(raw)
  return range === null ? NO_VALUE : { mode: CUSTOM, ...range }
}

const readValue = (raw) => {
  const parsed = parseValue(raw)
  if (parsed.mode === null && !isBlank(raw)) {
    impLogger.warn(
      `${NAME}: the value must be { preset } or ${SHAPE} - showing none`,
    )
  }
  return parsed
}

const isNoValue = (raw) => parseValue(raw).mode === null

const limitOf = (prop, value) => {
  if (value === undefined || value === null) return null
  const date = parseDate(value)
  if (date === null) {
    impLogger.warn(`${NAME}: '${prop}' must be a date like '2026-09-21' - ignoring '${value}'`)
  }
  return date
}

const normalizePresets = (list) => {
  if (!Array.isArray(list)) {
    impLogger.warn(`${NAME}: 'presets' must be an array of { value, label, range? } - showing none`)
    return []
  }
  return list.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || isBlank(entry.value)) {
      impLogger.warn(`${NAME}: a preset is not an object with a 'value' - skipping it`)
      return []
    }
    const range = entry.range === undefined ? null : parseRange(entry.range)
    if (entry.range !== undefined && range === null) {
      impLogger.warn(
        `${NAME}: the range of preset '${entry.value}' must be ${SHAPE} - ignoring it`,
      )
    }
    return [{ value: String(entry.value), label: String(entry.label ?? entry.value), range }]
  })
}

const formatOf = ({ start, end, timed }) => {
  if (!timed) return DAY_FORMAT
  return start.getSeconds() === 0 && end.getSeconds() === 0 ? MINUTE_FORMAT : SECOND_FORMAT
}

const describeRange = (range) => formatLocalRange(range.start, range.end, formatOf(range))

const daysOf = ({ start, end }) => ({ start: startOfDay(start), end: startOfDay(end) })

const timesOf = (range) =>
  range?.timed
    ? { start: formatTime(range.start), end: formatTime(range.end) }
    : { start: DEFAULT_START_TIME, end: DEFAULT_END_TIME }

const bindingProps = (props) => {
  const keepsObject = props.value !== undefined && !isStateShaped(props.value) &&
    typeof props.value === 'object' && props.value !== null
  return {
    ...props,
    value: keepsObject ? createState('imp.dateRangePicker.value', props.value) : props.value,
    min: undefined,
    max: undefined,
  }
}

const definition = {
  styles: dateRangePickerStyles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the relative ranges as 'presets'`)
    }
    const min = limitOf('min', props.min)
    const max = limitOf('max', props.max)
    const time = Boolean(props.time)
    const binding = createFieldBinding(NAME, bindingProps(props), { self, emptyWhen: isNoValue })

    let presets = []
    let current = NO_VALUE
    let mode = RELATIVE
    let pendingPreset = null
    let draft = NO_RANGE
    let pending = null
    let placeholder = null
    let disabled = false
    let open = false
    let heldFocus = false
    let leavingByTab = false

    const mainText = document.createTextNode('')
    const main = span({ class: 'main' }, mainText)
    const detailText = document.createTextNode('')
    const detail = span({ class: 'detail', hidden: true }, detailText)
    const badgeText = document.createTextNode('')
    const badge = span({ class: 'badge', hidden: true }, badgeText)
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
        },
      },
      span({ class: 'glyph' }, icon(luCalendarRange, { size: 'sm' })),
      span({ class: 'summary', id: VALUE_ID }, main, detail, badge),
      chevronDownIcon('chevron'),
    )

    const tabs = Object.fromEntries(MODES.map((each) => {
      const text = document.createTextNode('')
      const node = el(
        'button',
        {
          id: tabId(each),
          class: 'tab',
          type: 'button',
          role: 'tab',
          'aria-controls': paneId(each),
          'aria-selected': 'false',
          tabindex: '-1',
          events: { click: () => showMode(each) },
        },
        icon(each === RELATIVE ? luClock : luCalendarRange, { size: 'sm' }),
        span({}, text),
      )
      return [each, { node, text }]
    }))
    const tablist = div(
      { class: 'switch', role: 'tablist' },
      tabs[RELATIVE].node,
      tabs[CUSTOM].node,
    )

    const presetList = div({
      class: 'presets',
      role: 'radiogroup',
      'aria-labelledby': tabId(RELATIVE),
    })
    let rows = []

    const fromText = document.createTextNode('')
    const toText = document.createTextNode('')
    const fromValue = output({ class: 'readout-value', 'aria-labelledby': 'from-label' }, fromText)
    const toValue = output({ class: 'readout-value', 'aria-labelledby': 'to-label' }, toText)
    const timeInput = (id) =>
      time
        ? el('input', { id, class: 'time', type: 'time', events: { input: paintReadouts } })
        : null
    const startTime = timeInput(START_TIME_ID)
    const endTime = timeInput(END_TIME_ID)
    const fromBox = div(
      { class: 'readout' },
      span({ class: 'readout-label', id: 'from-label' }, lang.text(() => t(FROM_KEY))),
      fromValue,
      startTime,
    )
    const toBox = div(
      { class: 'readout' },
      span({ class: 'readout-label', id: 'to-label' }, lang.text(() => t(TO_KEY))),
      toValue,
      endTime,
    )
    const incomplete = createState('imp.dateRangePicker.incomplete', true)

    const grid = createDateGrid({
      self,
      min,
      max,
      selection: () => ({ ...draft, pending }),
      onPick: (day) => {
        if (pending === null) {
          pending = day
        } else {
          const [start, end] = pending <= day ? [pending, day] : [day, pending]
          pending = null
          draft = { start, end }
        }
        paintReadouts()
      },
    })

    const panes = {
      [RELATIVE]: div(
        {
          id: paneId(RELATIVE),
          class: 'pane',
          role: 'tabpanel',
          'aria-labelledby': tabId(RELATIVE),
        },
        presetList,
      ),
      [CUSTOM]: div(
        { id: paneId(CUSTOM), class: 'pane', role: 'tabpanel', 'aria-labelledby': tabId(CUSTOM) },
        div(
          { class: 'readouts' },
          fromBox,
          span({ class: 'arrow', 'aria-hidden': 'true' }, icon(luArrowRight, { size: 'sm' })),
          toBox,
        ),
        grid.root,
        div(
          { class: 'actions' },
          button(
            { variant: 'ghost', size: 'sm', events: { click: () => panel.hidePopover() } },
            lang.text(() => t(CANCEL_KEY)),
          ),
          button(
            { variant: 'primary', size: 'sm', disabled: incomplete, events: { click: apply } },
            lang.text(() => t(APPLY_KEY)),
          ),
        ),
      ),
    }

    const panel = div(
      { id: PANEL_ID, class: 'panel', role: 'dialog', popover: 'auto' },
      tablist,
      div({ class: 'panes' }, panes[RELATIVE], panes[CUSTOM]),
    )
    trigger.popoverTargetElement = panel
    const picker = div({ class: 'picker' }, trigger, panel)

    const presetOf = (value) => presets.find((preset) => preset.value === value) ?? null

    const overrides = { [RELATIVE]: null, [CUSTOM]: null }
    const modeLabel = (each) => overrides[each] ?? t(MODE_KEYS[each])

    const draftMoments = () => ({
      start: withTime(draft.start, parseTime(startTime.value) ?? parseTime(DEFAULT_START_TIME)),
      end: withTime(draft.end, parseTime(endTime.value) ?? parseTime(DEFAULT_END_TIME)),
    })

    const isBackwards = () => {
      if (!time || draft.start === null) return false
      const { start, end } = draftMoments()
      return start > end
    }

    const isIncomplete = () => draft.start === null || pending !== null || isBackwards()

    const draftValue = () => {
      if (!time) return { start: formatDate(draft.start), end: formatDate(draft.end) }
      const { start, end } = draftMoments()
      return { start: formatDateTime(start), end: formatDateTime(end) }
    }

    function apply() {
      if (isIncomplete()) return
      binding.touch()
      binding.commit(draftValue())
      panel.hidePopover()
    }

    const choosePreset = (preset) => {
      binding.touch()
      binding.commit({ preset: preset.value })
      panel.hidePopover()
    }

    const paintRows = () => {
      const tabStop = rows.find(({ preset }) => preset.value === pendingPreset) ?? rows[0]
      for (const row of rows) {
        row.node.setAttribute('aria-checked', String(row.preset.value === pendingPreset))
        row.node.tabIndex = row === tabStop ? 0 : -1
      }
    }

    const renderRows = () => {
      rows = presets.map((preset) => ({
        preset,
        node: el(
          'button',
          {
            class: 'preset',
            type: 'button',
            role: 'radio',
            'aria-checked': 'false',
            events: { click: () => choosePreset(preset) },
          },
          span({ class: 'dot', 'aria-hidden': 'true' }),
          span({ class: 'preset-label' }, preset.label),
          preset.range === null
            ? null
            : span({ class: 'preset-range' }, describeRange(preset.range)),
        ),
      }))
      presetList.replaceChildren(...rows.map(({ node }) => node))
      paintRows()
    }

    presetList.addEventListener('keydown', (event) => {
      const move = rovingMove(event.key, { orientation: 'both', element: presetList })
      if (move === null) return
      const from = rows.findIndex(({ node }) => node === presetList.getRootNode().activeElement)
      const target = rovingPick(move, rows, from)
      if (!target) return
      event.preventDefault()
      pendingPreset = target.preset.value
      paintRows()
      target.node.focus()
    })

    function paintReadouts() {
      const start = pending ?? draft.start
      const end = pending === null ? draft.end : null
      const fromShown = start ? formatLocal(start, DAY_FORMAT) : t(PICK_DAY_KEY)
      const toShown = end ? formatLocal(end, DAY_FORMAT) : t(PICK_DAY_KEY)
      if (fromText.data !== fromShown) fromText.data = fromShown
      if (toText.data !== toShown) toText.data = toShown
      fromValue.classList.toggle('empty', !start)
      toValue.classList.toggle('empty', !end)
      fromBox.classList.toggle('active', open && mode === CUSTOM && pending === null && !end)
      toBox.classList.toggle('active', open && mode === CUSTOM && pending !== null)
      incomplete.set(isIncomplete())
    }

    const hasPresets = () => presets.length > 0

    function showMode(next, { focus = false } = {}) {
      mode = hasPresets() ? next : CUSTOM
      tablist.classList.toggle('custom', mode === CUSTOM)
      for (const each of MODES) {
        const selected = each === mode
        tabs[each].node.setAttribute('aria-selected', String(selected))
        tabs[each].node.tabIndex = selected ? 0 : -1
        panes[each].hidden = !selected
      }
      if (focus) tabs[mode].node.focus()
      paintReadouts()
    }

    const paintSwitch = () => {
      tablist.hidden = !hasPresets()
      for (const each of MODES) {
        if (hasPresets()) {
          panes[each].setAttribute('role', 'tabpanel')
          panes[each].setAttribute('aria-labelledby', tabId(each))
        } else {
          panes[each].removeAttribute('role')
          panes[each].removeAttribute('aria-labelledby')
        }
      }
      showMode(mode)
    }

    tablist.addEventListener('keydown', (event) => {
      const step = inlineStep(event.key, tablist)
      const edge = event.key === 'Home' ? RELATIVE : event.key === 'End' ? CUSTOM : null
      if (step === 0 && edge === null) return
      event.preventDefault()
      showMode(edge ?? (mode === RELATIVE ? CUSTOM : RELATIVE), { focus: true })
    })

    const focusContent = () => {
      if (mode === CUSTOM) return grid.focusCursor()
      const target = rows.find(({ node }) => node.tabIndex === 0)
      if (target) target.node.focus()
      else tabs[mode].node.focus()
    }

    const paintTrigger = () => {
      const preset = current.mode === RELATIVE ? presetOf(current.preset) : null
      const text = current.mode === null
        ? placeholder ?? t(CHOOSE_KEY)
        : current.mode === CUSTOM
        ? describeRange(current)
        : preset?.label ?? current.preset
      const secondary = preset?.range ? describeRange(preset.range) : ''
      if (mainText.data !== text) mainText.data = text
      if (detailText.data !== secondary) detailText.data = secondary
      main.classList.toggle('placeholder', current.mode === null)
      detail.hidden = secondary === ''
      badge.hidden = current.mode === null || !hasPresets()
      badge.classList.toggle('custom', current.mode === CUSTOM)
      const badgeShown = current.mode === null ? '' : modeLabel(current.mode)
      if (badgeText.data !== badgeShown) badgeText.data = badgeShown
    }

    function paint() {
      for (const each of MODES) {
        const label = modeLabel(each)
        if (tabs[each].text.data !== label) tabs[each].text.data = label
      }
      paintTrigger()
      paintReadouts()
    }

    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') leavingByTab = true
    })

    panel.addEventListener('keyup', () => {
      leavingByTab = false
    })

    panel.addEventListener('focusout', (event) => {
      const wasTab = leavingByTab
      leavingByTab = false
      const next = event.relatedTarget
      if (!wasTab || !open || next === null || panel.contains(next)) return
      panel.hidePopover()
    })

    panel.addEventListener('beforetoggle', (event) => {
      open = event.newState === 'open'
      trigger.setAttribute('aria-expanded', String(open))
      heldFocus = !open && panel.contains(panel.getRootNode().activeElement)
      if (!open) return
      const preset = current.mode === RELATIVE ? presetOf(current.preset) : null
      pendingPreset = preset?.value ?? null
      const seed = current.mode === CUSTOM ? current : preset?.range ?? null
      draft = seed === null ? NO_RANGE : daysOf(seed)
      if (time) {
        const times = timesOf(seed)
        startTime.value = times.start
        endTime.value = times.end
      }
      pending = null
      paintRows()
      showMode(current.mode === CUSTOM ? CUSTOM : RELATIVE)
      grid.show(draft.end ?? today())
    })

    panel.addEventListener('toggle', (event) => {
      if (event.newState === 'open') return focusContent()
      pending = null
      paintReadouts()
      if (heldFocus) trigger.focus()
      binding.leave()
      binding.check()
    })

    bindValue(self, props.presets, (value) => {
      presets = normalizePresets(value ?? [])
      renderRows()
      paintSwitch()
      paintTrigger()
    })
    bindValue(self, props.placeholder, (value) => {
      placeholder = isBlank(value) ? null : String(value)
      paintTrigger()
    })
    bindValue(self, props.relativeLabel, (value) => {
      overrides[RELATIVE] = isBlank(value) ? null : String(value)
      paint()
    })
    bindValue(self, props.customLabel, (value) => {
      overrides[CUSTOM] = isBlank(value) ? null : String(value)
      paint()
    })
    bindValue(self, props.disabled, (value) => {
      disabled = Boolean(value)
      trigger.disabled = disabled
      if (disabled && open) panel.hidePopover()
    })
    stopOnRemove(
      self,
      binding.watch((value) => {
        current = readValue(value)
        paintTrigger()
      }),
    )
    lang.watch(self, () => {
      panel.setAttribute('aria-label', t(CHOOSE_KEY))
      startTime?.setAttribute('aria-label', t(START_TIME_KEY))
      endTime?.setAttribute('aria-label', t(END_TIME_KEY))
      renderRows()
      paint()
    })
    paintSwitch()

    const shell = createShell(self, props, trigger, { presented: picker, describedBy: [VALUE_ID] })
    shell.attach(binding)
    return shell.root
  },
}

export const dateRangePicker = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
