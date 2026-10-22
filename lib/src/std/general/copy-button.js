import { defineComponent } from '../shared/define.js'
import { span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { createState } from '../../state.js'
import { isStateShaped } from '../../render.js'
import { stopOnRemove } from '../shared/args.js'
import { ownEvents } from '../shared/own-events.js'
import { visuallyHidden } from '../shared/css.js'
import { luCheck, luCopy } from '../../icons/lucide-icons.js'
import { button } from './button.js'
import { icon } from './icon.js'
import { tooltip } from '../display/tooltip.js'

const NAME = 'copyButton'

const KNOWN_PROPS = ['value', 'label', 'variant', 'size', 'disabled', 'events']

const COPY_KEY = 'imp.copy.copy'

const COPIED_KEY = 'imp.copy.copied'

const messages = {
  [COPY_KEY]: 'Copy',
  [COPIED_KEY]: 'Copied',
}

const COPY_EVENT = 'copyResult'

const COPIED_FEEDBACK_MS = 1500

const styles = () => `
  .box {
    display: inline-flex;
  }

  .status {${visuallyHidden}}
`

const readValue = (value) => {
  const current = isStateShaped(value) ? value.get() : typeof value === 'function' ? value() : value
  return current === undefined || current === null ? '' : String(current)
}

const reportCopy = (box, value, copied) =>
  box.dispatchEvent(
    new CustomEvent(COPY_EVENT, {
      bubbles: true,
      composed: true,
      detail: { value, copied },
    }),
  )

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (props.value === undefined) {
      impLogger.warn(`${NAME}: pass the text to copy as 'value'`)
    }
    const copied = createState('imp.copy.done', false)
    const label = createState('imp.copy.label', props.label ?? t(COPY_KEY))
    const relabel = () => {
      if (props.label === undefined) label.set(t(copied.get() ? COPIED_KEY : COPY_KEY))
    }
    lang.watch(self, relabel)
    copied.watch(self, relabel)
    const status = span({ class: 'status', role: 'status', 'aria-live': 'polite' })
    let timer = 0
    stopOnRemove(self, () => clearTimeout(timer))
    const copy = async () => {
      const value = readValue(props.value)
      try {
        await navigator.clipboard.writeText(value)
      } catch (error) {
        impLogger.warn(`${NAME}: the clipboard refused the text`, error)
        reportCopy(box, value, false)
        return
      }
      copied.set(true)
      status.textContent = t(COPIED_KEY)
      reportCopy(box, value, true)
      clearTimeout(timer)
      timer = setTimeout(() => {
        copied.set(false)
        status.textContent = ''
      }, COPIED_FEEDBACK_MS)
    }
    const iconOnly = children.length === 0
    const trigger = button(
      {
        variant: props.variant,
        size: props.size,
        disabled: props.disabled,
        square: iconOnly,
        ...(iconOnly || props.label !== undefined ? { label } : {}),
        events: { click: copy },
      },
      copied.view((done) => icon(done ? luCheck : luCopy, { size: '1em' })),
      ...children,
    )
    const box = span(
      { class: 'box', events: ownEvents(props.events, [COPY_EVENT]) },
      iconOnly ? tooltip({ text: label }, trigger) : trigger,
      status,
    )
    return box
  },
}

export const copyButton = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(messages),
  )(...args)
