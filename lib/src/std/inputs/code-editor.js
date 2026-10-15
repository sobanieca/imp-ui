import { defineComponent } from '../shared/define.js'
import { div, p, pre, textarea } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue, stopOnRemove } from '../shared/args.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form-state.js'
import {
  BINDING_PROPS,
  CONTROL_ID,
  createShell,
  SHELL_PROPS,
  shellStyles,
  VALIDATION_PROPS,
} from './shell.js'
import { resolveLanguage } from '../display/code-languages.js'
import { tint } from '../display/code-css.js'
import {
  CODE_MESSAGES,
  codeNumber,
  codeViewStyles,
  copyControl,
  createCodeView,
} from '../display/code-view.js'
import { focusRing, forcedColors, token, visuallyHidden } from '../shared/css.js'

const NAME = 'codeEditor'

const KEYS_ID = 'keys'

const KEYS_KEY = 'imp.codeEditor.keys'

const messages = {
  [KEYS_KEY]: 'Tab indents. Press Escape, then Tab, to leave the editor.',
}

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  ...VALIDATION_PROPS,
  'language',
  'lineNumbers',
  'rows',
  'placeholder',
  'readonly',
]

const DEFAULT_ROWS = 10

const INDENT = '  '

const LEADING_SPACE = /^[ \t]*/

const ONE_INDENT = /^(?: {1,2}|\t)/

const styles = () => `
${shellStyles()}

  .editor {
    --code-surface: ${token('color-surface')};
    position: relative;
    overflow: hidden;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    transition: border-color ${token('duration-fast')} ease-out;
  }

  .editor:has(textarea:focus-visible) {
    ${focusRing()}
  }

  .editor:has(textarea:disabled) {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .editor:has(textarea[aria-invalid='true']) {
    border-color: ${token('color-danger')};
  }

  .mirror {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: auto;
    pointer-events: none;
    background: none;
  }

  textarea {
    position: relative;
    z-index: 1;
    display: block;
    inline-size: 100%;
    resize: none;
    overflow: auto;
    outline: none;
    background: transparent;
    color: transparent;
    caret-color: ${token('color-text')};
  }

  textarea::placeholder {
    color: ${token('color-secondary')};
  }

  textarea::selection {
    background-color: ${tint('primary', '28%')};
    color: transparent;
  }

  textarea:disabled {
    cursor: not-allowed;
  }

  .keys {${visuallyHidden}}

${codeViewStyles()}

  @media (prefers-reduced-motion: reduce) {
    .editor {
      transition: none;
    }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .editor { border-color: ButtonBorder }
    .editor:has(textarea:focus-visible) { outline-color: Highlight }
    textarea::selection { background-color: Highlight; color: transparent }
  }
`

const asText = (value) => (value === undefined || value === null ? '' : String(value))

const rowsOf = (value) => {
  if (value === undefined) return DEFAULT_ROWS
  if (Number.isInteger(value) && value > 0) return value
  impLogger.warn(
    `${NAME}: 'rows' must be a positive integer - got '${value}', using ${DEFAULT_ROWS}`,
  )
  return DEFAULT_ROWS
}

const lineStart = (text, index) => text.lastIndexOf('\n', index - 1) + 1

const lineEnd = (text, index) => {
  const end = text.indexOf('\n', index)
  return end === -1 ? text.length : end
}

const outdented = (line) => line.replace(ONE_INDENT, '')

const createKeys = (control) => {
  let released = false

  const replace = (start, end, text) => {
    control.setSelectionRange(start, end)
    document.execCommand('insertText', false, text)
  }

  const shiftLines = (outdent) => {
    const { value, selectionStart, selectionEnd } = control
    const start = lineStart(value, selectionStart)
    const end = lineEnd(value, selectionEnd)
    const lines = value.slice(start, end).split('\n')
    const shifted = lines.map((line) => (outdent ? outdented(line) : INDENT + line))
    const firstDelta = shifted[0].length - lines[0].length
    const totalDelta = shifted.join('\n').length - (end - start)
    replace(start, end, shifted.join('\n'))
    control.setSelectionRange(
      Math.max(start, selectionStart + firstDelta),
      Math.max(start, selectionEnd + totalDelta),
    )
  }

  const indent = (outdent) => {
    const { value, selectionStart, selectionEnd } = control
    const spansLines = value.slice(selectionStart, selectionEnd).includes('\n')
    if (outdent || spansLines) shiftLines(outdent)
    else replace(selectionStart, selectionEnd, INDENT)
  }

  const newLine = () => {
    const { value, selectionStart, selectionEnd } = control
    const line = value.slice(lineStart(value, selectionStart), selectionStart)
    replace(selectionStart, selectionEnd, `\n${LEADING_SPACE.exec(line)[0]}`)
  }

  return (event) => {
    if (control.readOnly || control.disabled || event.isComposing) return
    if (event.key === 'Escape') {
      released = true
      return
    }
    if (event.key === 'Tab') {
      const handled = !released && !event.ctrlKey && !event.altKey && !event.metaKey
      released = false
      if (!handled) return
      event.preventDefault()
      indent(event.shiftKey)
      return
    }
    released = false
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      newLine()
    }
  }
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass 'label' and 'help' instead of children`)
    }
    const language = resolveLanguage(NAME, props.language)
    const numbered = props.lineNumbers === true
    const binding = createFieldBinding(NAME, props, { self })
    const editor = div({ class: numbered ? 'editor numbered' : 'editor' })
    const view = createCodeView({
      language,
      scope: editor,
      createNumber: numbered ? codeNumber : null,
    })
    const mirror = pre({ class: 'code mirror', 'aria-hidden': 'true' }, view.listing)
    const control = textarea({
      id: CONTROL_ID,
      spellcheck: false,
      autocomplete: 'off',
      autocapitalize: 'off',
      ...(props.placeholder === undefined ? {} : { placeholder: props.placeholder }),
      ...(props.readonly ? { readonly: true } : {}),
      events: {
        input: () => binding.commit(control.value),
        blur: () => {
          binding.leave()
          binding.check()
        },
        scroll: () => {
          mirror.scrollTop = control.scrollTop
          mirror.scrollLeft = control.scrollLeft
        },
      },
    })
    control.addEventListener('keydown', createKeys(control))
    const keys = p({ class: 'keys', id: KEYS_ID })
    lang.watch(self, () => {
      keys.textContent = t(KEYS_KEY)
    })

    let shown = null
    const render = (text) => {
      if (text === shown) return
      shown = text
      view.render(text)
    }

    bindValue(self, props.rows, (value) => {
      control.rows = rowsOf(value)
    })
    bindValue(self, props.disabled, (value) => {
      control.disabled = Boolean(value)
    })
    stopOnRemove(
      self,
      binding.watch((value) => {
        const next = asText(value)
        if (control.value !== next) control.value = next
        render(next)
      }),
    )
    editor.append(
      mirror,
      control,
      keys,
      copyControl(self, NAME, () => control.value),
    )
    const shell = createShell(self, props, control, {
      presented: editor,
      describedBy: [KEYS_ID],
    })
    shell.attach(binding)
    return shell.root
  },
}

export const codeEditor = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages({ ...FORM_MESSAGES, ...CODE_MESSAGES, ...messages }),
  )(...args)
