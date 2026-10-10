import { defineComponent } from '../shared/define.js'
import { div, el, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { createState } from '../../state.js'
import { luFaceSlightlySmiling, luX } from '../../icons/lucide-icons.js'
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
import { createEmojiPanel, EMOJI_PANEL_MESSAGES, emojiPanelStyles } from '../shared/emoji-panel.js'
import { controlStyles } from './control-css.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form-state.js'
import { BINDING_PROPS, CONTROL_ID, createShell, SHELL_PROPS, shellStyles } from './shell.js'
import { closeOnTabOut } from '../shared/tab-out.js'

const NAME = 'emojiPicker'

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  'validate',
  'validateAsync',
  'emojis',
  'placeholder',
]

const PANEL_ID = 'panel'

const VALUE_ID = 'value'

const CHOOSE_KEY = 'imp.emojiPicker.choose'

const CLEAR_KEY = 'imp.emojiPicker.clear'

const messages = {
  ...FORM_MESSAGES,
  ...EMOJI_PANEL_MESSAGES,
  [CHOOSE_KEY]: 'Choose an emoji',
  [CLEAR_KEY]: 'Clear the emoji',
}

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
    align-items: center;
    justify-content: center;
    min-inline-size: 1.5rem;
    color: ${token('color-secondary')};
    font-size: 1.25rem;
    line-height: 1;
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

  @media (prefers-reduced-motion: reduce) {
    .trigger { transition: none }
  }

  @media (forced-colors: active) {
    .value.placeholder { color: GrayText }
  }
`

const isBlank = (value) => value === undefined || value === null || value === ''

const definition = {
  styles: () => `${shellStyles()}\n${controlStyles()}\n${emojiPanelStyles()}\n${styles()}`,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the set of emoji as 'emojis'`)
    }
    const binding = createFieldBinding(NAME, props, { self })

    let chosen = ''
    let placeholder = ''
    let disabled = false
    let open = false

    const glyph = span({ class: 'glyph' })
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
      glyph,
      valueBox,
    )

    const clearLabel = createState('imp.emojiPicker.clearLabel', t(CLEAR_KEY))
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

    const emojiPanel = createEmojiPanel({
      self,
      name: NAME,
      emojis: props.emojis,
      onPick: (emoji) => {
        binding.touch()
        binding.commit(emoji)
        panel.hidePopover()
      },
    })
    const panel = div(
      { id: PANEL_ID, class: 'panel', role: 'dialog', popover: 'auto' },
      emojiPanel.root,
    )
    trigger.popoverTargetElement = panel
    closeOnTabOut(panel)

    const emptyGlyph = icon(luFaceSlightlySmiling, { size: 'sm' })
    const paintValue = () => {
      if (chosen === '') glyph.replaceChildren(emptyGlyph)
      else glyph.replaceChildren(chosen)
      const shownText = chosen === '' ? placeholder : emojiPanel.nameOf(chosen)
      if (valueText.data !== shownText) valueText.data = shownText
      valueBox.classList.toggle('placeholder', chosen === '')
      if (clearBox !== null) clearBox.hidden = chosen === '' || disabled
      picker.classList.toggle('clearable', clearBox !== null && !clearBox.hidden)
    }

    const picker = div({ class: 'picker' }, trigger, clearBox, panel)

    let heldFocus = false

    panel.addEventListener('beforetoggle', (event) => {
      open = event.newState === 'open'
      trigger.setAttribute('aria-expanded', String(open))
      heldFocus = !open && panel.contains(panel.getRootNode().activeElement)
      if (open) emojiPanel.reset()
    })

    panel.addEventListener('toggle', (event) => {
      if (event.newState === 'open') return emojiPanel.focusStart()
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
        chosen = typeof value === 'string' ? value : ''
        if (!isBlank(value) && typeof value !== 'string') {
          impLogger.warn(`${NAME}: the value must be an emoji string - showing none`)
        }
        paintValue()
      }),
    )
    lang.watch(self, () => {
      panel.setAttribute('aria-label', t(CHOOSE_KEY))
      clearLabel.set(t(CLEAR_KEY))
    })

    const shell = createShell(self, props, trigger, { presented: picker, describedBy: [VALUE_ID] })
    shell.attach(binding)
    return shell.root
  },
}

export const emojiPicker = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
