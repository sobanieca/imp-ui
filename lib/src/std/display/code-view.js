import { code, div, span } from '../../api/html.js'
import { lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { createState } from '../../state.js'
import { stopOnRemove } from '../shared/args.js'
import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { tooltip } from './tooltip.js'
import { luCheck, luCopy } from '../../icons/lucide-icons.js'
import { tokenizeLines } from './code-tokens.js'
import { tokenNodes, tokenStyles } from './code-css.js'
import { focusRing, token, visuallyHidden } from '../shared/css.js'

const COPY_KEY = 'imp.code.copy'

const COPIED_KEY = 'imp.code.copied'

export const LINE_KEY = 'imp.code.line'

export const CODE_MESSAGES = {
  [COPY_KEY]: 'Copy code',
  [COPIED_KEY]: 'Copied',
  [LINE_KEY]: 'Line {number}',
}

const COPIED_FEEDBACK_MS = 1500

const MARKER_WIDTH = '3px'

const copyInset = () => `calc(${token('space-3')} + 2.5rem)`

const railSize = () =>
  `calc(${MARKER_WIDTH} + ${token('space-3')} * 2 + var(--code-digits, 2) * 1ch + ${
    token('space-2')
  })`

export const codeViewStyles = () => `
  .code,
  textarea {
    box-sizing: border-box;
    margin: 0;
    padding-block: ${token('space-3')};
    border: 0;
    font-family: ${token('font-family-mono')};
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-normal')};
    line-height: ${token('line-height-normal')};
    letter-spacing: normal;
    tab-size: 2;
    white-space: pre;
    overflow-wrap: normal;
  }

  textarea {
    padding-inline-start: ${token('space-3')};
    padding-inline-end: ${copyInset()};
  }

  .lines {
    display: block;
    min-inline-size: max-content;
    font: inherit;
    counter-reset: line;
  }

  .line {
    display: inline-block;
    box-sizing: border-box;
    inline-size: 100%;
    min-block-size: 1lh;
    vertical-align: top;
    padding-inline-start: ${token('space-3')};
    padding-inline-end: ${copyInset()};
    counter-increment: line;
  }

  .numbered .line {
    padding-inline-start: 0;
  }

  .numbered textarea {
    padding-inline-start: ${railSize()};
  }

  .number {
    position: sticky;
    inset-inline-start: 0;
    z-index: 1;
    display: inline-block;
    box-sizing: content-box;
    min-inline-size: calc(var(--code-digits, 2) * 1ch);
    padding-inline: ${token('space-3')};
    margin-inline-end: ${token('space-2')};
    border-inline-start: ${MARKER_WIDTH} solid transparent;
    text-align: end;
    color: ${token('color-secondary')};
    background-color: var(--code-surface, ${token('color-surface')});
    text-decoration: none;
    user-select: none;
  }

  .number::before {
    content: counter(line);
  }

  a.number:hover {
    color: ${token('color-text')};
  }

  .number:focus-visible {${focusRing()}
    outline-offset: -${token('focus-ring-width')};
  }

  .toolbar {
    position: absolute;
    inset-block-start: ${token('space-2')};
    inset-inline-end: ${token('space-2')};
    z-index: 2;
    user-select: none;
  }

  .status {${visuallyHidden}}

${tokenStyles()}

  @media (forced-colors: active) {
    .number { color: GrayText }
    a.number { color: LinkText }
  }
`

export const codeNumber = () => span({ class: 'number' })

export const createCodeView = ({ language, scope = null, createNumber = null }) => {
  const listing = code({ class: 'lines' })
  const digitsOn = scope ?? listing
  const render = (source) => {
    const lines = tokenizeLines(source, language)
    digitsOn.style.setProperty('--code-digits', String(String(lines.length).length))
    const nodes = []
    lines.forEach((tokens, index) => {
      const line = span({ class: 'line' })
      if (createNumber !== null) line.append(createNumber(index + 1))
      line.append(...tokenNodes(tokens, (className, text) => span({ class: className }, text)))
      nodes.push(line)
      if (index < lines.length - 1) nodes.push('\n')
    })
    listing.replaceChildren(...nodes)
  }
  return { listing, render }
}

export const copyControl = (self, name, readSource) => {
  const copied = createState('imp.code.copied', false)
  const label = createState('imp.code.label', t(COPY_KEY))
  const status = span({ class: 'status', role: 'status', 'aria-live': 'polite' })
  const relabel = () => label.set(t(copied.get() ? COPIED_KEY : COPY_KEY))
  lang.watch(self, relabel)
  copied.watch(self, relabel)
  let timer = 0
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(readSource())
    } catch (error) {
      impLogger.warn(`${name}: the clipboard refused the text`, error)
      return
    }
    copied.set(true)
    status.textContent = t(COPIED_KEY)
    clearTimeout(timer)
    timer = setTimeout(() => {
      copied.set(false)
      status.textContent = ''
    }, COPIED_FEEDBACK_MS)
  }
  stopOnRemove(self, () => clearTimeout(timer))
  const control = tooltip(
    { text: label },
    button(
      { size: 'sm', variant: 'ghost', label, events: { click: copy } },
      copied.view((done) => icon(done ? luCheck : luCopy)),
    ),
  )
  return div({ class: 'toolbar' }, control, status)
}
