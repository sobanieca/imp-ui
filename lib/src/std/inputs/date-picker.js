import { defineComponent } from '../shared/define.js'
import { div, el, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { createState } from '../../state.js'
import { luCalendar, luX } from '../../icons/lucide-icons.js'
import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { anchoredStyles } from '../shared/anchored.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import {
  controlBox,
  fontFamily,
  groupableSeam,
  hiddenRule,
  seamLift,
  token,
} from '../shared/css.js'
import {
  formatDate,
  formatDateTime,
  formatLocal,
  formatTime,
  isWithinDays,
  parseDate,
  parseDateTime,
  parseTime,
  today,
  withTime,
} from '../shared/dates.js'
import { controlStyles } from './control-css.js'
import { createDateGrid, DATE_GRID_MESSAGES, dateGridStyles } from './date-grid.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form-state.js'
import { BINDING_PROPS, CONTROL_ID, createShell, SHELL_PROPS, shellStyles } from './shell.js'
import { closeOnTabOut } from '../shared/tab-out.js'

const NAME = 'datePicker'

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  'validate',
  'validateAsync',
  'min',
  'max',
  'time',
  'placeholder',
]

const PANEL_ID = 'panel'

const VALUE_ID = 'value'

const TIME_ID = 'time'

const DEFAULT_TIME = { hours: 12, minutes: 0 }

const CHOOSE_KEY = 'imp.datePicker.choose'

const CLEAR_KEY = 'imp.datePicker.clear'

const TIME_KEY = 'imp.datePicker.time'

const DONE_KEY = 'imp.datePicker.done'

const MIN_KEY = 'imp.datePicker.min'

const MAX_KEY = 'imp.datePicker.max'

const messages = {
  ...FORM_MESSAGES,
  ...DATE_GRID_MESSAGES,
  [CHOOSE_KEY]: 'Choose a date',
  [CLEAR_KEY]: 'Clear the date',
  [TIME_KEY]: 'Time',
  [DONE_KEY]: 'Done',
  [MIN_KEY]: 'Choose {min} or a later date',
  [MAX_KEY]: 'Choose {max} or an earlier date',
}

const DAY_FORMAT = { dateStyle: 'medium' }

const MOMENT_FORMAT = { dateStyle: 'medium', timeStyle: 'short' }

const styles = () => `
  ${hiddenRule}

  .picker {
    position: relative;
    display: flex;
    min-inline-size: 0;
  }

  .trigger {
    display: flex;
    flex: 1;
    align-items: center;
    gap: ${token('space-2')};
    min-inline-size: 0;
    margin: 0;
    ${controlBox('md', 'space-3')}
    border: ${token('border-width')} solid ${token('color-border')};
    ${groupableSeam()}
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    ${fontFamily()}
    text-align: start;
    cursor: pointer;
    transition: border-color ${token('duration-fast')} ease-out;
  }

  .picker.clearable .trigger {
    padding-inline-end: calc(${token('space-3')} + 2rem);
  }

  .trigger:focus-visible {
    outline: ${token('focus-ring-width')} solid ${token('color-primary')};
    outline-offset: 2px;
  }

  ${seamLift('.trigger')}

  .trigger:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .trigger[aria-invalid='true'] {
    border-color: ${token('color-danger')};
  }

  .glyph {
    display: inline-flex;
    flex: none;
    color: ${token('color-secondary')};
  }

  .value {
    flex: 1;
    min-inline-size: 0;
    min-block-size: 1lh;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .value.placeholder {
    color: ${token('color-secondary')};
  }

  .clear {
    position: absolute;
    inset-block: 0;
    inset-inline-end: ${token('space-1')};
    display: flex;
    align-items: center;
    z-index: 2;
  }

  ${anchoredStyles({ trigger: '.picker', panel: '.panel', placement: 'block-end', align: 'start' })}

  .panel {
    display: flex;
    flex-direction: column;
    gap: ${token('space-3')};
    padding: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-md')};
    color: ${token('color-text')};
    ${fontFamily()}
  }

  .time-row {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
  }

  .time-label {
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-bold')};
  }

  .time-row input {
    flex: 1;
    min-inline-size: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .trigger { transition: none }
  }

  @media (forced-colors: active) {
    .panel { border-color: CanvasText }
    .value.placeholder { color: GrayText }
  }
`

const limitOf = (prop, value) => {
  if (value === undefined || value === null) return null
  const date = parseDate(value)
  if (date === null) {
    impLogger.warn(`${NAME}: '${prop}' must be a date like '2026-09-21' - ignoring '${value}'`)
  }
  return date
}

const isBlank = (value) => value === undefined || value === null || value === ''

const parseChosen = (raw) => (typeof raw === 'string' ? parseDateTime(raw) : null)

const readChosen = (raw) => {
  if (isBlank(raw)) return null
  const chosen = parseChosen(raw)
  if (chosen === null) {
    impLogger.warn(`${NAME}: the value must be a date like '2026-09-21' - showing none`)
  }
  return chosen
}

const limitCheck = (min, max) => (raw) => {
  const chosen = parseChosen(raw)
  if (chosen === null) return null
  if (!isWithinDays(chosen, min, null)) {
    return { key: MIN_KEY, params: { min: formatLocal(min, DAY_FORMAT) } }
  }
  if (!isWithinDays(chosen, null, max)) {
    return { key: MAX_KEY, params: { max: formatLocal(max, DAY_FORMAT) } }
  }
  return null
}

const bindingProps = (props, min, max) => {
  const checkLimits = limitCheck(min, max)
  const custom = typeof props.validate === 'function' ? props.validate : null
  if (props.validate !== undefined && custom === null) {
    impLogger.warn(
      `${NAME}: 'validate' must be a function returning a message or null - ignoring it`,
    )
  }
  return {
    ...props,
    min: undefined,
    max: undefined,
    validate: (value) => checkLimits(value) ?? custom?.(value) ?? null,
  }
}

const definition = {
  styles: () => `${shellStyles()}\n${controlStyles()}\n${dateGridStyles()}\n${styles()}`,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - it renders its own calendar`)
    }
    const time = Boolean(props.time)
    const min = limitOf('min', props.min)
    const max = limitOf('max', props.max)
    const binding = createFieldBinding(NAME, bindingProps(props, min, max), { self })

    let chosen = null
    let placeholder = ''
    let disabled = false
    let open = false

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
        },
      },
      span({ class: 'glyph' }, icon(luCalendar, { size: 'sm' })),
      valueBox,
    )

    const clearLabel = createState('imp.datePicker.clearLabel', t(CLEAR_KEY))
    const clearBox = props.required ? null : span(
      { class: 'clear', hidden: true },
      button({
        variant: 'ghost',
        size: 'sm',
        square: true,
        label: clearLabel,
        events: {
          click: () => {
            binding.touch()
            binding.commit(undefined)
            trigger.focus()
          },
        },
      }, icon(luX, { size: 'sm' })),
    )

    const timeInput = time
      ? el('input', {
        id: TIME_ID,
        type: 'time',
        events: { change: () => commitMoment(chosen) },
      })
      : null

    const grid = createDateGrid({
      self,
      min,
      max,
      selection: () => ({ start: chosen, end: chosen, pending: null }),
      onPick: (day) => {
        binding.touch()
        if (time) return commitMoment(day)
        binding.commit(formatDate(day))
        panel.hidePopover()
      },
    })

    function commitMoment(day) {
      if (!day) return
      binding.commit(formatDateTime(withTime(day, parseTime(timeInput.value) ?? DEFAULT_TIME)))
    }

    const panel = div(
      { id: PANEL_ID, class: 'panel', role: 'dialog', popover: 'auto' },
      grid.root,
      timeInput === null ? null : div(
        { class: 'time-row' },
        el('label', { class: 'time-label', for: TIME_ID }, lang.text(() => t(TIME_KEY))),
        timeInput,
        button(
          { variant: 'primary', size: 'sm', events: { click: () => panel.hidePopover() } },
          lang.text(() => t(DONE_KEY)),
        ),
      ),
    )
    trigger.popoverTargetElement = panel
    closeOnTabOut(panel)

    const paintValue = () => {
      const text = chosen === null ? '' : formatLocal(chosen, time ? MOMENT_FORMAT : DAY_FORMAT)
      const shownText = text === '' ? placeholder : text
      if (valueText.data !== shownText) valueText.data = shownText
      valueBox.classList.toggle('placeholder', text === '')
      if (clearBox !== null) clearBox.hidden = text === '' || disabled
      picker.classList.toggle('clearable', clearBox !== null && !clearBox.hidden)
    }

    const picker = div({ class: 'picker' }, trigger, clearBox, panel)

    let heldFocus = false

    panel.addEventListener('beforetoggle', (event) => {
      open = event.newState === 'open'
      trigger.setAttribute('aria-expanded', String(open))
      heldFocus = !open && panel.contains(panel.getRootNode().activeElement)
      if (!open) return
      if (timeInput !== null) {
        timeInput.value = formatTime(chosen ?? withTime(today(), DEFAULT_TIME))
      }
      grid.show(chosen ?? today())
    })

    panel.addEventListener('toggle', (event) => {
      if (event.newState === 'open') return grid.focusCursor()
      if (heldFocus) trigger.focus()
      binding.leave()
      binding.check()
    })

    bindValue(self, props.placeholder, (value) => {
      placeholder = isBlank(value) ? '' : String(value)
      paintValue()
    })
    bindValue(self, props.disabled, (value) => {
      disabled = Boolean(value)
      trigger.disabled = disabled
      if (disabled && open) panel.hidePopover()
      paintValue()
    })
    stopOnRemove(
      self,
      binding.watch((value) => {
        chosen = readChosen(value)
        paintValue()
        if (open) grid.paint()
      }),
    )
    lang.watch(self, () => {
      panel.setAttribute('aria-label', t(CHOOSE_KEY))
      clearLabel.set(t(CLEAR_KEY))
      paintValue()
    })

    const shell = createShell(self, props, trigger, { presented: picker, describedBy: [VALUE_ID] })
    shell.attach(binding)
    return shell.root
  },
}

export const datePicker = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
